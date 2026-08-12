import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_DURATION_SECONDS,
  VoiceRecorder,
  VoiceRecording,
  WAVEFORM_SAMPLES,
  WARN_SECONDS_LEFT,
} from '../../../plugins/voice-recorder';
import { describeCaptureError } from '../../../utils/capture';

export enum VoiceRecordStatus {
  Idle = 'idle',
  Starting = 'starting',
  Recording = 'recording',
  Preview = 'preview',
  Sending = 'sending',
}

export type VoiceRecorderControls = {
  status: VoiceRecordStatus;
  waveform: number[];
  durationSeconds: number;
  /** Set once recording stops, cleared on discard/send. */
  recording?: VoiceRecording;
  error?: string;
  /** True inside the last `WARN_SECONDS_LEFT` before the hard cap. */
  endingSoon: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  discard: () => void;
  setSending: (sending: boolean) => void;
  clearError: () => void;
};

const emptyWaveform = () => new Array(WAVEFORM_SAMPLES).fill(0) as number[];

/**
 * @param scopeKey Recording is abandoned whenever this changes. Pass the room
 * id: RoomInput is not remounted when you switch rooms (only the timeline is
 * keyed), so without this a recording started in one room stays live in the
 * next one — and pressing send would post it to whichever room you had ended
 * up in.
 */
export function useVoiceRecorder(scopeKey: string): VoiceRecorderControls {
  const recorderRef = useRef<VoiceRecorder | undefined>(undefined);
  const [status, setStatus] = useState(VoiceRecordStatus.Idle);
  const [waveform, setWaveform] = useState<number[]>(emptyWaveform);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [recording, setRecording] = useState<VoiceRecording>();
  const [error, setError] = useState<string>();

  const discard = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = undefined;
    setRecording(undefined);
    setWaveform(emptyWaveform());
    setDurationSeconds(0);
    setStatus(VoiceRecordStatus.Idle);
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      const result = await recorder.stop();
      recorderRef.current = undefined;
      setRecording(result);
      setWaveform(result.waveform);
      setDurationSeconds(result.durationSeconds);
      setStatus(VoiceRecordStatus.Preview);
    } catch (e) {
      recorderRef.current = undefined;
      setError(e instanceof Error ? e.message : 'Recording failed.');
      setStatus(VoiceRecordStatus.Idle);
    }
  }, []);

  // `stop` is recreated on every render, but the recorder's max-duration
  // callback is registered once — keep a live ref so the auto-stop always calls
  // the current one.
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    setError(undefined);
    setRecording(undefined);
    setWaveform(emptyWaveform());
    setDurationSeconds(0);
    setStatus(VoiceRecordStatus.Starting);

    const recorder = new VoiceRecorder();
    recorder.onUpdate = (update) => {
      setWaveform(update.waveform);
      setDurationSeconds(update.durationSeconds);
    };
    recorder.onMaxDuration = () => {
      stopRef.current();
    };

    try {
      await recorder.start();
      recorderRef.current = recorder;
      setStatus(VoiceRecordStatus.Recording);
    } catch (e) {
      setError(describeCaptureError(e));
      setStatus(VoiceRecordStatus.Idle);
    }
  }, []);

  const setSending = useCallback((sending: boolean) => {
    setStatus(sending ? VoiceRecordStatus.Sending : VoiceRecordStatus.Preview);
  }, []);

  // Closing the app, or unmounting the composer, must not leave the mic open.
  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      recorderRef.current = undefined;
    },
    [],
  );

  // Switching rooms abandons the take. Losing a recording is annoying; sending
  // it to the wrong room is worse, and there is no undo for that.
  useEffect(() => {
    discard();
    // `discard` is stable, and re-running this on anything else would wipe a
    // recording mid-take.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  return {
    status,
    waveform,
    durationSeconds,
    recording,
    error,
    endingSoon:
      status === VoiceRecordStatus.Recording &&
      durationSeconds >= MAX_DURATION_SECONDS - WARN_SECONDS_LEFT,
    start,
    stop,
    discard,
    setSending,
    clearError: useCallback(() => setError(undefined), []),
  };
}
