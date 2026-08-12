import Recorder from 'opus-recorder/dist/recorder.min.js';
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js?url';
import { acquireMicrophone, MicrophoneHandle } from '../../utils/capture';

// Ogg/Opus, mono, 48 kHz, 24 kbps VBR — the settings every other Matrix client
// records voice messages at (Element uses exactly these), which is what makes
// the result play inline for the person receiving it rather than arriving as an
// anonymous attachment.
//
// This uses opus-recorder's WASM encoder rather than the browser's own
// MediaRecorder on purpose: MediaRecorder's codec support differs across the
// four WebViews we ship on, and where it produces webm/opus instead of
// ogg/opus, other clients refuse to play it inline.
export const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const BIT_RATE = 24000;
const ENCODER_APPLICATION_VOIP = 2048;

/** Number of waveform buckets sent with the event, matching Element's. */
export const WAVEFORM_SAMPLES = 44;

/** 15 minutes. Longer is possible, but the file grows and nobody listens. */
export const MAX_DURATION_SECONDS = 900;

/** Warn the user this far from the cap. */
export const WARN_SECONDS_LEFT = 10;

const WAVEFORM_TICK_MS = 50;

export type VoiceRecorderUpdate = {
  /** Newest-last, `WAVEFORM_SAMPLES` long, each 0..1. */
  waveform: number[];
  durationSeconds: number;
};

export type VoiceRecording = {
  blob: Blob;
  durationSeconds: number;
  /** `WAVEFORM_SAMPLES` values, 0..1, one per bucket across the whole clip. */
  waveform: number[];
};

export enum VoiceRecorderState {
  Inactive = 'inactive',
  Recording = 'recording',
  Stopping = 'stopping',
}

/**
 * A single voice recording session.
 *
 * Lifecycle is deliberately one-shot: `start()`, then exactly one of `stop()`
 * or `cancel()`. Both release the microphone. Re-recording means a new
 * instance, so there is no state where a half-disposed recorder still holds
 * the mic.
 */
export class VoiceRecorder {
  private recorder?: Recorder;

  private mic?: MicrophoneHandle;

  private context?: AudioContext;

  private analyser?: AnalyserNode;

  private source?: MediaStreamAudioSourceNode;

  private tickTimer?: number;

  private chunks: ArrayBuffer[] = [];

  private liveWaveform: number[] = new Array(WAVEFORM_SAMPLES).fill(0);

  /** Amplitude peaks over the whole clip, downsampled at send time. */
  private amplitudes: number[] = [];

  private startedAt = 0;

  private stoppedDurationSeconds?: number;

  public state: VoiceRecorderState = VoiceRecorderState.Inactive;

  public onUpdate?: (update: VoiceRecorderUpdate) => void;

  /** Fired when the recording hits `MAX_DURATION_SECONDS` and stops itself. */
  public onMaxDuration?: () => void;

  public get durationSeconds(): number {
    if (this.stoppedDurationSeconds !== undefined) return this.stoppedDurationSeconds;
    if (!this.startedAt) return 0;
    return (Date.now() - this.startedAt) / 1000;
  }

  public async start(): Promise<void> {
    if (this.state !== VoiceRecorderState.Inactive) {
      throw new Error('Recorder already started');
    }

    this.mic = await acquireMicrophone();
    this.state = VoiceRecorderState.Recording;

    try {
      this.context = new AudioContext({ sampleRate: SAMPLE_RATE });
      // Some engines start an AudioContext suspended when it was not created
      // inside the click handler; without this the analyser reports pure
      // silence and the live waveform sits flat while audio records fine.
      if (this.context.state === 'suspended') await this.context.resume();

      this.source = this.context.createMediaStreamSource(this.mic.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;
      this.source.connect(this.analyser);
      // Deliberately not connected to the destination — routing the mic to the
      // speakers is a feedback loop, not a monitor.

      this.recorder = new Recorder({
        encoderPath,
        encoderApplication: ENCODER_APPLICATION_VOIP,
        encoderBitRate: BIT_RATE,
        encoderSampleRate: SAMPLE_RATE,
        numberOfChannels: CHANNELS,
        // Encode as we go rather than in one burst at the end: on a mid-range
        // phone, encoding a 5-minute clip in one go blocks long enough to look
        // like the app has hung after you press stop.
        streamPages: true,
        encoderFrameSize: 20,
        // The library defaults to the highest quality it can manage regardless
        // of CPU. For speech at 24 kbps the difference is inaudible, and the
        // difference in battery and heat on a phone is not.
        encoderComplexity: 3,
        resampleQuality: 3,
        sourceNode: this.source,
      });

      this.recorder.ondataavailable = (data: ArrayBuffer) => {
        this.chunks.push(data);
      };

      await this.recorder.start();
      this.startedAt = Date.now();
      this.startTicking();
    } catch (e) {
      // Never leave the mic open on a failed start.
      this.releaseResources();
      this.state = VoiceRecorderState.Inactive;
      throw e;
    }
  }

  private startTicking(): void {
    const buffer = new Uint8Array(this.analyser?.frequencyBinCount ?? 0);

    this.tickTimer = window.setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteTimeDomainData(buffer);
      // Time-domain data is centred on 128; peak deviation from that is the
      // amplitude. Using the peak rather than RMS keeps quiet speech visible,
      // which is the whole point of drawing the thing.
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const deviation = Math.abs(buffer[i] - 128) / 128;
        if (deviation > peak) peak = deviation;
      }
      // A little headroom so normal speech fills the bar rather than hugging
      // the floor.
      const level = Math.min(1, peak * 1.5);

      this.liveWaveform = [...this.liveWaveform.slice(1), level];
      this.amplitudes.push(level);

      const { durationSeconds } = this;
      this.onUpdate?.({ waveform: [...this.liveWaveform], durationSeconds });

      if (durationSeconds >= MAX_DURATION_SECONDS) {
        this.onMaxDuration?.();
      }
    }, WAVEFORM_TICK_MS);
  }

  private stopTicking(): void {
    if (this.tickTimer !== undefined) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  /** Downsamples the tick-by-tick peaks to the fixed bucket count we send. */
  private buildWaveform(): number[] {
    const { amplitudes } = this;
    if (amplitudes.length === 0) return new Array(WAVEFORM_SAMPLES).fill(0);

    const bucketSize = amplitudes.length / WAVEFORM_SAMPLES;
    const waveform: number[] = [];
    for (let i = 0; i < WAVEFORM_SAMPLES; i += 1) {
      const from = Math.floor(i * bucketSize);
      const to = Math.max(from + 1, Math.floor((i + 1) * bucketSize));
      let peak = 0;
      for (let j = from; j < to && j < amplitudes.length; j += 1) {
        if (amplitudes[j] > peak) peak = amplitudes[j];
      }
      waveform.push(peak);
    }
    return waveform;
  }

  /** Stops, releases the microphone and returns the encoded clip. */
  public async stop(): Promise<VoiceRecording> {
    if (this.state !== VoiceRecorderState.Recording) {
      throw new Error('Recorder is not recording');
    }
    this.state = VoiceRecorderState.Stopping;
    this.stopTicking();
    this.stoppedDurationSeconds = (Date.now() - this.startedAt) / 1000;

    try {
      await this.recorder?.stop();
    } finally {
      this.releaseResources();
      this.state = VoiceRecorderState.Inactive;
    }

    const blob = new Blob(this.chunks as BlobPart[], { type: 'audio/ogg' });
    return {
      blob,
      durationSeconds: this.stoppedDurationSeconds,
      waveform: this.buildWaveform(),
    };
  }

  /** Aborts and throws the audio away. Safe to call in any state. */
  public cancel(): void {
    this.stopTicking();
    try {
      this.recorder?.stop();
    } catch {
      // Already stopped; the only thing that matters here is the release below.
    }
    this.chunks = [];
    this.releaseResources();
    this.state = VoiceRecorderState.Inactive;
  }

  private releaseResources(): void {
    this.recorder?.close();
    this.recorder = undefined;

    this.source?.disconnect();
    this.source = undefined;
    this.analyser = undefined;

    this.context?.close().catch(() => undefined);
    this.context = undefined;

    this.mic?.release();
    this.mic = undefined;
  }
}

export const isVoiceRecordingSupported = (): boolean => {
  try {
    return !!navigator.mediaDevices?.getUserMedia && Recorder.isRecordingSupported();
  } catch {
    return false;
  }
};
