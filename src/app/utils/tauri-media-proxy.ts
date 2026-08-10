import { isTauri } from './desktop-notifications';

// Fetch a cross-origin media URL via our Rust `fetch_remote_bytes` command
// and return a blob: URL the WebView can pass to <video src=...> /
// <img src=...>.
//
// We don't use @tauri-apps/plugin-http here because its guest-js layer wraps
// headers in a browser `Headers` object, which silently strips forbidden
// headers (User-Agent, Referer). The request then reaches Rust reqwest with
// the default `reqwest/x.x` UA and twimg.com 403s it. Our Rust command sets
// a real Chrome UA and sends no Referer (twimg serves when Referer is empty).

// Hosts the frontend is allowed to proxy through `fetch_remote_bytes`
// (Twitter/X CDN via vxtwitter, Bluesky image/video CDN). Suffix-matched, so
// every subdomain (video.twimg.com, pbs.twimg.com, video.bsky.app, …) is
// covered.
//
// MUST STAY IN SYNC WITH `ALLOWED_MEDIA_HOSTS` in the Tauri shell's
// `src-tauri/src/lib.rs`. The native side enforces the real boundary, but the
// URLs that reach this command come from third-party API JSON (vxtwitter,
// public.api.bsky.app) — i.e. attacker-influenced data — and every caller here
// used to hand them to the IPC with zero JS-side checking. Duplicating the
// contract locally makes the coupling explicit instead of leaving the only
// copy of it in a different repository, and stops obviously-out-of-scope URLs
// (other hosts, non-https schemes, `file:`) from ever crossing the IPC.
export const ALLOWED_MEDIA_HOSTS: readonly string[] = ['twimg.com', 'bsky.app'];

// Upper bound on a proxied media response. `fetch_remote_bytes` hands us the
// whole body as one buffer, so without a cap a hostile (or merely broken) CDN
// response can be turned into unbounded renderer memory by anyone who can post
// a link. 64 MiB comfortably covers Twitter/Bluesky video and images.
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

/** True when `value` is an https URL on an allowlisted media host. */
export function isAllowedMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.replace(/\.$/, '').toLowerCase();
  return ALLOWED_MEDIA_HOSTS.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * Validated wrapper around the `fetch_remote_bytes` IPC command.
 *
 * Rejects before invoking when the URL is not an https URL on an allowlisted
 * media host, and rejects after the fact when the response exceeds
 * `MAX_MEDIA_BYTES`. Every proxied-media path (blob URLs for <img>/<video>,
 * the HLS loader) goes through here so the check cannot be bypassed by adding
 * a new call site.
 */
export async function fetchRemoteMediaBytes(url: string): Promise<ArrayBuffer> {
  if (!isAllowedMediaUrl(url)) {
    throw new Error(`[media-proxy] refusing to proxy non-allowlisted URL: ${url}`);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<ArrayBuffer | Uint8Array>('fetch_remote_bytes', { url });

  // tauri::ipc::Response → JS comes through as ArrayBuffer in most Tauri 2
  // builds, but defensively handle Uint8Array too.
  const buffer: ArrayBuffer =
    result instanceof ArrayBuffer
      ? result
      : ((result as Uint8Array).buffer.slice(
          (result as Uint8Array).byteOffset,
          (result as Uint8Array).byteOffset + (result as Uint8Array).byteLength
          // .buffer is typed ArrayBufferLike (the SharedArrayBuffer arm can
          // never occur for an IPC response), and slice() preserves that.
        ) as ArrayBuffer);

  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(
      `[media-proxy] response too large (${buffer.byteLength} > ${MAX_MEDIA_BYTES}): ${url}`
    );
  }
  return buffer;
}

export async function fetchAsBlobUrl(url: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const bytes = await fetchRemoteMediaBytes(url);
    const blob = new Blob([bytes]);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[media-proxy] fetch failed for', url, err);
    return null;
  }
}
