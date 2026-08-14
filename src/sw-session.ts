/**
 * The bridge that hands the access token to the service worker, which is what
 * authenticates every authenticated-media request (`/_matrix/client/v1/media/…`).
 *
 * An `<img src>` cannot carry an `Authorization` header, so the service worker
 * intercepting the fetch is the only mechanism available for images and avatars.
 * That makes this bridge load-bearing: when it fails the homeserver answers
 * `401 M_MISSING_TOKEN` and every image, avatar and voice message in the app
 * breaks at once, with nothing in the UI to say why.
 *
 * It used to fail in three ways, all silent:
 *
 *  1. `postMessage` was skipped whenever `navigator.serviceWorker.controller`
 *     was null. That is exactly the state of the page that *installs* the
 *     worker, and of any page loaded with a shift-reload, so the token was
 *     dropped on the floor precisely when the worker had never been told it.
 *  2. Nothing re-sent the token when the page later became controlled, so the
 *     worker stayed empty for the rest of the page's life.
 *  3. A shift-reloaded page is never claimed — `clients.claim()` only runs in
 *     the worker's `activate` handler, which does not re-run for an already
 *     active worker. The page stayed uncontrolled, no fetch was ever
 *     intercepted, and no amount of ordinary reloading fixed it.
 *
 * So: remember the session here, deliver it to the active worker whether or not
 * it is controlling yet, ask it to claim the page when it is not, and re-deliver
 * on every controller change. `getMediaAuthHeaders` additionally lets `fetch`-based
 * callers authenticate themselves and skip the worker entirely.
 */

type SWSession = {
  baseUrl: string;
  accessToken: string;
};

/**
 * The session as last pushed. Mirrors what the worker should be holding, and is
 * the source for `getMediaAuthHeaders`.
 */
let currentSession: SWSession | undefined;

const MEDIA_PATHS = ['/_matrix/client/v1/media/download', '/_matrix/client/v1/media/thumbnail'];

const swSupported = (): boolean => typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/**
 * The worker to talk to: the one controlling us if there is one, otherwise the
 * active worker of the registration. The second case is the important one — an
 * uncontrolled page still has a perfectly good worker to talk to, and dropping
 * the message there is what left the worker tokenless.
 */
const targetWorker = async (): Promise<ServiceWorker | undefined> => {
  if (!swSupported()) return undefined;
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;

  const registration = await navigator.serviceWorker.ready.catch(() => undefined);
  return registration?.active ?? undefined;
};

export function pushSessionToSW(baseUrl?: string, accessToken?: string) {
  currentSession =
    typeof baseUrl === 'string' && typeof accessToken === 'string'
      ? { baseUrl, accessToken }
      : undefined;

  if (!swSupported()) return;

  targetWorker().then((worker) => {
    worker?.postMessage({
      type: 'setSession',
      accessToken,
      baseUrl,
    });
  });
}

/**
 * `Authorization` for a media URL we know belongs to the signed-in homeserver,
 * or undefined for anything else — an unauthenticated `/_matrix/media/v3/…`
 * URL, another homeserver's media, or no session at all.
 *
 * Callers that use `fetch` (file downloads, voice messages, encrypted images,
 * the image viewer) can therefore authenticate themselves rather than depending
 * on the worker. The worker re-issues requests it has a token for with its own
 * header, and passes the rest through untouched, so this header is what carries
 * those requests whenever the worker is missing, tokenless, or not yet
 * controlling the page.
 */
export function getMediaAuthHeaders(src: string): Record<string, string> | undefined {
  const session = currentSession;
  if (!session) return undefined;

  try {
    const url = new URL(src, window.location.href);
    const base = new URL(session.baseUrl);
    if (url.origin !== base.origin) return undefined;
    if (!MEDIA_PATHS.some((path) => url.pathname.startsWith(path))) return undefined;
  } catch {
    return undefined;
  }

  return { Authorization: `Bearer ${session.accessToken}` };
}

/**
 * Make sure the page is controlled, so media fetches are actually intercepted.
 *
 * Resolves true once controlled. A page that installed the worker becomes
 * controlled on its own via the `clients.claim()` in `activate`; a
 * shift-reloaded page never does, because `activate` does not re-run — hence the
 * explicit `claimClients` request, which the worker answers by claiming. Bounded
 * so a browser with the worker disabled (or a failed registration) degrades to
 * the unauthenticated path instead of hanging the caller.
 */
export async function ensureSWControl(timeoutMs = 5000): Promise<boolean> {
  if (!swSupported()) return false;
  if (navigator.serviceWorker.controller) return true;

  const registration = await navigator.serviceWorker.ready.catch(() => undefined);
  if (!registration?.active) return false;
  if (navigator.serviceWorker.controller) return true;

  const controlled = new Promise<boolean>((resolve) => {
    const onChange = () => resolve(true);
    navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true });
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(!!navigator.serviceWorker.controller);
    }, timeoutMs);
  });

  registration.active.postMessage({ type: 'claimClients' });

  return controlled;
}
