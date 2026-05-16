import { isTauri } from './desktop-notifications';

// Fetch a cross-origin media URL via Tauri's HTTP plugin (Rust reqwest), which
// is not bound by browser CORS or Referer policies. Returns a blob: URL the
// WebView can pass to <video src=...> / <img src=...>.
//
// We need this for video.twimg.com — browser <video referrerpolicy="no-referrer">
// is supposed to drop the Referer but WebView2 still 403s on those URLs.
export async function fetchAsBlobUrl(
  url: string,
  refererOrigin = 'https://x.com/',
): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const mod = await import('@tauri-apps/plugin-http');
    const response = await mod.fetch(url, {
      method: 'GET',
      headers: {
        Referer: refererOrigin,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      console.warn('[media-proxy] HTTP', response.status, 'for', url);
      return null;
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[media-proxy] fetch failed for', url, err);
    return null;
  }
}
