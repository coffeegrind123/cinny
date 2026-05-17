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
export async function fetchAsBlobUrl(url: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<ArrayBuffer>('fetch_remote_bytes', { url });
    const blob = new Blob([bytes]);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[media-proxy] fetch failed for', url, err);
    return null;
  }
}
