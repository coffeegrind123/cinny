import { acquireMicrophone, describeCaptureError } from './capture';

/**
 * What we know about the app's permission to record.
 *
 * `unknown` is a real state, not a placeholder for "not loaded yet": the
 * Permissions API does not have to implement the `microphone` descriptor, and
 * Firefox in particular rejects the query outright. Collapsing that into
 * `prompt` would be a guess, and it is the difference between offering an
 * "Allow" button that will do something and one that cannot.
 */
export type MicPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

/**
 * Remembers a grant across restarts, for the same reason the notification
 * permission does (see `usePermission`): the Tauri WebView starts every launch
 * with nothing to say about permissions, so without a hint the settings screen
 * and the composer would both offer to ask for something the user granted
 * months ago.
 *
 * A rendering hint ONLY. It is plain localStorage — it survives the user
 * revoking the permission in system settings, and it must never be the reason
 * capture is attempted or skipped. The authority is the platform, re-queried
 * below and re-tested by `getUserMedia` on every recording.
 */
const MIC_PERM_CACHE_KEY = 'micPermissionGranted';

export const readCachedMicrophoneGranted = (): boolean => {
  try {
    return localStorage.getItem(MIC_PERM_CACHE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeCachedMicrophoneGranted = (granted: boolean) => {
  try {
    if (granted) localStorage.setItem(MIC_PERM_CACHE_KEY, '1');
    else localStorage.removeItem(MIC_PERM_CACHE_KEY);
  } catch {
    // Private mode or a locked-down origin — the hint is optional.
  }
};

/**
 * The Permissions API descriptor for the microphone, which TypeScript's DOM lib
 * does not list in `PermissionName` even where every engine we ship on
 * implements it.
 */
const MICROPHONE_DESCRIPTOR = { name: 'microphone' } as unknown as PermissionDescriptor;

/**
 * Subscribes to the platform's own answer, calling back on every change.
 *
 * Returns a teardown, and calls back once immediately with whatever the
 * platform says. Where the query is unsupported the callback gets `unknown`
 * and nothing further — the caller is expected to fall back to the cached hint
 * rather than to pretend it knows.
 */
export const observeMicrophonePermission = (
  onState: (state: MicPermissionState) => void
): (() => void) => {
  let status: PermissionStatus | undefined;
  let disposed = false;

  const handleChange = () => {
    if (!status) return;
    const state = status.state as MicPermissionState;
    if (state === 'granted') writeCachedMicrophoneGranted(true);
    if (state === 'denied') writeCachedMicrophoneGranted(false);
    onState(state);
  };

  navigator.permissions
    ?.query(MICROPHONE_DESCRIPTOR)
    .then((permStatus) => {
      if (disposed) return;
      status = permStatus;
      handleChange();
      permStatus.addEventListener('change', handleChange);
    })
    .catch(() => {
      if (!disposed) onState('unknown');
    });

  return () => {
    disposed = true;
    status?.removeEventListener('change', handleChange);
  };
};

export type MicrophoneRequestResult = {
  state: MicPermissionState;
  /** Set when the request failed for a reason worth showing the user. */
  error?: string;
};

/**
 * Asks for the microphone by briefly opening it, then closing it again.
 *
 * There is no "request permission without capturing" call on the web platform:
 * `getUserMedia` IS the request, and every prompt the user sees — the browser's,
 * Android's runtime dialog via the WebView's permission handler, the desktop
 * shell's — is raised by it. So the grant is obtained by taking a stream and
 * immediately releasing it, which is also what makes device labels appear.
 *
 * Releasing straight away matters: a stream left open holds the OS recording
 * indicator on and, on Android, keeps the foreground service claiming the
 * microphone — which is indistinguishable, from the user's side, from the app
 * listening after they only agreed to be asked.
 */
export async function requestMicrophonePermission(): Promise<MicrophoneRequestResult> {
  try {
    const mic = await acquireMicrophone();
    mic.release();
    writeCachedMicrophoneGranted(true);
    return { state: 'granted' };
  } catch (e) {
    const name = e instanceof DOMException || e instanceof Error ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      writeCachedMicrophoneGranted(false);
      return { state: 'denied', error: describeCaptureError(e) };
    }
    // A missing or busy microphone is not a permission answer. Reporting it as
    // "denied" would send the user into system settings to fix a permission
    // that was never the problem.
    return { state: 'unknown', error: describeCaptureError(e) };
  }
}
