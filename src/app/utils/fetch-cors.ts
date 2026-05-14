/**
 * Client-side URL preview fetch using tauri-plugin-cors-fetch.
 * Falls back to standard fetch when not in Tauri.
 */

const DISCORD_UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

async function isCorsFetchAvailable(): Promise<boolean> {
  try {
    return typeof (window as any).fetchCORS === 'function';
  } catch {
    return false;
  }
}

export async function corsFetch(url: string, init?: RequestInit): Promise<Response> {
  if (await isCorsFetchAvailable()) {
    return (window as any).fetchCORS(url, init);
  }
  return fetch(url, init);
}

export async function fetchWithDiscordUA(url: string): Promise<Response> {
  return corsFetch(url, {
    headers: {
      'User-Agent': DISCORD_UA,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
}

export function extractOgMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const ogRegex = /<meta\s+(?:property|name)="(og:[^"]+)"\s+content="([^"]*)"/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    meta[match[1]] = match[2];
  }

  // Also extract <title>
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) meta['og:title'] = meta['og:title'] || titleMatch[1];

  // Extract description
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (descMatch) meta['og:description'] = meta['og:description'] || descMatch[1];

  return meta;
}
