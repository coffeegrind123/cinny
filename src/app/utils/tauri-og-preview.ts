import { isTauri } from './desktop-notifications';

// Fallback link-preview fetcher for the desktop/mobile app. When the
// homeserver's `preview_url` fails (commonly a 504 because the target site
// rejects Synapse's non-browser User-Agent), our Rust `fetch_og_preview`
// command fetches the page itself with a real Chrome UA — server-to-server,
// so CORS doesn't apply — and parses the OG/Twitter meta tags. The result is
// keyed exactly like a Matrix preview response (og:title, og:image, …) so the
// preview card renders it with no special-casing.
//
// The Rust side keeps full SSRF protection (private-IP rejection, DNS pinning,
// per-hop redirect re-vetting, response-size cap). This wrapper is only ever
// called when the user has opted into the (default-off) fallback setting.
export async function fetchOgPreview(
  url: string
): Promise<Record<string, string> | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const data = await invoke<Record<string, string>>('fetch_og_preview', { url });
    return data ?? null;
  } catch (err) {
    console.warn('[og-preview] fallback fetch failed for', url, err);
    return null;
  }
}
