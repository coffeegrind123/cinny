import { acquireMicrophone, armCaptureIntent, MicrophoneHandle } from './capture';
import { checkScreenShareSupport } from './screen-share';
import { isTauri } from './desktop-notifications';

// Capability probe for the WebView engines we ship on: Chromium (WebView2 /
// Android WebView), WebKitGTK and WKWebView. Every one of them refuses media
// capture differently, and all of them refuse it *silently* from the page's
// point of view — getUserMedia just rejects, and a denied engine is
// indistinguishable from a user who clicked "no" unless you look at the error
// name. Building recording UI on an assumption about which of these works is
// how you end up debugging the wrong layer for a day.
//
// Everything here reports the raw result, not a verdict.

export type ProbeResult = {
  label: string;
  value: string;
  ok?: boolean;
};

const describeError = (e: unknown): string => {
  if (e instanceof DOMException) return `${e.name}: ${e.message}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
};

const trackSummary = (track: MediaStreamTrack): string => {
  const settings = track.getSettings();
  const bits = [
    track.label || '<no label>',
    settings.channelCount !== undefined ? `${settings.channelCount}ch` : undefined,
    settings.sampleRate !== undefined ? `${settings.sampleRate}Hz` : undefined,
    settings.echoCancellation !== undefined ? `echo=${settings.echoCancellation}` : undefined,
    settings.noiseSuppression !== undefined ? `noise=${settings.noiseSuppression}` : undefined,
    settings.autoGainControl !== undefined ? `agc=${settings.autoGainControl}` : undefined,
  ].filter(Boolean);
  return bits.join(', ');
};

export const probeEnvironment = (): ProbeResult[] => [
  { label: 'User agent', value: navigator.userAgent },
  { label: 'Origin', value: window.location.origin },
  {
    label: 'Secure context',
    value: String(window.isSecureContext),
    // getUserMedia is gated on this. http://localhost counts as secure, which
    // is why the desktop shell serving on 127.0.0.1:44548 is fine.
    ok: window.isSecureContext,
  },
  { label: 'Tauri shell', value: String(isTauri()) },
  {
    label: 'navigator.mediaDevices',
    value: navigator.mediaDevices ? 'present' : 'MISSING',
    ok: !!navigator.mediaDevices,
  },
  {
    label: 'MediaRecorder',
    value: typeof MediaRecorder === 'undefined' ? 'MISSING' : 'present',
    ok: typeof MediaRecorder !== 'undefined',
  },
  {
    label: 'AudioWorklet',
    value:
      typeof AudioContext !== 'undefined' && 'audioWorklet' in AudioContext.prototype
        ? 'present'
        : 'MISSING',
  },
  {
    label: 'WebAssembly',
    value: typeof WebAssembly === 'object' ? 'present' : 'MISSING',
    // opus-recorder is a WASM encoder — no WASM, no voice messages.
    ok: typeof WebAssembly === 'object',
  },
];

export const probeCodecs = (): ProbeResult[] => {
  if (typeof MediaRecorder === 'undefined') {
    return [{ label: 'MediaRecorder codecs', value: 'MediaRecorder unavailable', ok: false }];
  }
  const types = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg'];
  return types.map((type) => {
    const supported = MediaRecorder.isTypeSupported(type);
    return { label: type, value: supported ? 'supported' : 'no', ok: supported };
  });
};

export const probeMicrophone = async (): Promise<ProbeResult[]> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return [
      { label: 'getUserMedia(audio)', value: 'mediaDevices.getUserMedia missing', ok: false },
    ];
  }

  // Deliberately goes through the same helper the recorder uses, so the probe
  // exercises the real path — intent arming, foreground-service mic type and
  // all — rather than a simplified one that could succeed where recording fails.
  let mic: MicrophoneHandle | undefined;
  try {
    mic = await acquireMicrophone();
    const tracks = mic.stream.getAudioTracks();
    const results: ProbeResult[] = [
      { label: 'getUserMedia(audio)', value: `granted, ${tracks.length} track(s)`, ok: true },
      ...tracks.map((track, i) => ({
        label: `Track ${i}`,
        value: trackSummary(track),
      })),
    ];

    const ctx = new AudioContext();
    results.push({ label: 'AudioContext sample rate', value: `${ctx.sampleRate} Hz` });
    await ctx.close();

    return results;
  } catch (e) {
    return [{ label: 'getUserMedia(audio)', value: describeError(e), ok: false }];
  } finally {
    // Release immediately. A probe that leaves the mic open leaves the OS
    // capture indicator lit, which reads to the user as the app spying on them.
    mic?.release();
  }
};

export const probeDevices = async (): Promise<ProbeResult[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [{ label: 'enumerateDevices', value: 'missing', ok: false }];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioIn = devices.filter((d) => d.kind === 'audioinput');
    const audioOut = devices.filter((d) => d.kind === 'audiooutput');
    const videoIn = devices.filter((d) => d.kind === 'videoinput');
    // Labels are only populated once a capture permission has been granted, so
    // "no labels" here means the mic probe has not run or was denied — not that
    // the devices are broken.
    const labelled = devices.filter((d) => d.label).length;
    return [
      {
        label: 'enumerateDevices',
        value: `${audioIn.length} audio in, ${audioOut.length} audio out, ${videoIn.length} video in`,
        ok: audioIn.length > 0,
      },
      { label: 'Device labels', value: `${labelled}/${devices.length} populated` },
    ];
  } catch (e) {
    return [{ label: 'enumerateDevices', value: describeError(e), ok: false }];
  }
};

export const probeDisplayMedia = async (): Promise<ProbeResult[]> => {
  const support = checkScreenShareSupport();
  if (!support.supported) {
    return [{ label: 'Screen capture', value: support.reason, ok: false }];
  }
  let stream: MediaStream | undefined;
  try {
    await armCaptureIntent();
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    return [
      {
        label: 'getDisplayMedia',
        value: track ? `granted: ${track.label || '<no label>'}` : 'granted, no track',
        ok: true,
      },
    ];
  } catch (e) {
    return [{ label: 'getDisplayMedia', value: describeError(e), ok: false }];
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
};

export const formatProbeReport = (sections: [string, ProbeResult[]][]): string =>
  sections
    .map(
      ([title, results]) =>
        `## ${title}\n${results.map((r) => `- ${r.label}: ${r.value}`).join('\n')}`,
    )
    .join('\n\n');
