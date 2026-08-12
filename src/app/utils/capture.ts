import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './desktop-notifications';
import { getSettings } from '../state/settings';
import { setForegroundMicrophoneActive } from './mobile-push';

/**
 * Tells the desktop shell that the *application* is about to capture, so its
 * permission handler can tell our own request apart from one made by an iframe.
 *
 * Only the Linux shell acts on this: WebKitGTK fires `permission-request` for
 * every frame in the webview and gives no way to learn which frame asked, so
 * the handler grants capture only inside a short window after this call and
 * denies everything else. Android checks the frame origin itself; Windows and
 * macOS prompt the user. The command exists on all of them so callers need no
 * platform branch.
 */
export async function armCaptureIntent(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('arm_capture_intent');
  } catch (e) {
    // An older shell without the command must not stop the web build, or a
    // desktop build mid-upgrade, from trying to record.
    console.warn('arm_capture_intent unavailable', e);
  }
}

export type MicrophoneHandle = {
  stream: MediaStream;
  release: () => void;
};

/**
 * Microphone constraints from the user's settings.
 *
 * Read at call time rather than captured once: someone who changes their input
 * device in settings expects the next recording to use it, without reloading.
 *
 * The device id is an `ideal` rather than an `exact` constraint on purpose — a
 * saved device that is currently unplugged should fall back to the system
 * default instead of failing the whole capture with OverconstrainedError.
 */
const audioConstraints = (): MediaTrackConstraints => {
  const settings = getSettings();
  return {
    channelCount: 1,
    echoCancellation: { ideal: settings.echoCancellation },
    noiseSuppression: { ideal: settings.noiseSuppression },
    autoGainControl: { ideal: settings.autoGainControl },
    ...(settings.audioInputId ? { deviceId: { ideal: settings.audioInputId } } : undefined),
  };
};

/**
 * Opens the microphone and hands back a handle whose `release()` is the only
 * thing that closes it.
 *
 * Releasing is not optional bookkeeping: a track left running keeps the OS
 * capture indicator lit and, on Android, keeps the foreground service claiming
 * the microphone type — which reads to the user as the client listening after
 * they cancelled. Call `release()` on cancel, on send, on unmount and on room
 * change, and let it be safe to call twice.
 */
export async function acquireMicrophone(
  constraints?: MediaTrackConstraints,
): Promise<MicrophoneHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This app build cannot access the microphone.');
  }

  await armCaptureIntent();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: constraints ?? audioConstraints(),
  });

  // Android 14+ revokes the mic when the activity loses focus unless the
  // foreground service declares the microphone type.
  setForegroundMicrophoneActive(true).catch(() => undefined);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    stream.getTracks().forEach((track) => track.stop());
    setForegroundMicrophoneActive(false).catch(() => undefined);
  };

  return { stream, release };
}

/**
 * Turns a getUserMedia rejection into something a person can act on. The raw
 * DOMException names are the only thing that distinguishes "you said no" from
 * "this build cannot do it at all", and that difference decides whether the
 * user should retry or file a bug.
 */
export function describeCaptureError(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Microphone access was denied. Allow it for Prinny in your system settings and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found.';
    case 'NotReadableError':
      return 'The microphone is in use by another application.';
    case 'SecurityError':
      return 'This build is not allowed to use the microphone.';
    default:
      return e instanceof Error ? e.message : 'Could not start recording.';
  }
}
