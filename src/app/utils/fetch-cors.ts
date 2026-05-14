/**
 * Client-side URL fetch using tauri-plugin-cors-fetch.
 * Uses randomized non-browser User-Agents to bypass Anubis/Invidious bot protection.
 * Falls back to standard fetch when not in Tauri.
 */

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function randomVersionedName(): string {
  let str = LETTERS[(Math.random() * LETTERS.length) | 0].toUpperCase();
  let lowerCount = (8 + 6 * Math.random()) | 0;
  while (lowerCount--) {
    str += LETTERS[(Math.random() * LETTERS.length) | 0];
  }
  // Remove "bot" pattern to avoid triggering protections
  str = str.replace(/(bo)t/gi, (_, start) => `${start}x`);
  str += '/';
  str += (Math.random() * 100) | 0;
  if (Math.random() < 0.5) {
    str += '.';
    str += (Math.random() * 100) | 0;
  }
  return str;
}

function buildFakeUA(): string {
  let partsCount = (3 + 3 * Math.random()) | 0;
  const parts: string[] = [];
  while (partsCount--) {
    parts.push(randomVersionedName());
  }
  return `${randomVersionedName()} (${parts.join('; ')})`;
}

async function isCorsFetchAvailable(): Promise<boolean> {
  try {
    return typeof (window as any).fetchCORS === 'function';
  } catch {
    return false;
  }
}

export async function corsFetch(url: string, init?: RequestInit): Promise<Response> {
  const fakeUA = buildFakeUA();
  const headers = new Headers(init?.headers);
  headers.set('User-Agent', fakeUA);
  // Strip Sec-CH client hint headers that identify browser
  for (const key of headers.keys()) {
    if (key.toLowerCase().startsWith('sec-ch-')) headers.delete(key);
  }

  if (await isCorsFetchAvailable()) {
    return (window as any).fetchCORS(url, { ...init, headers });
  }
  return fetch(url, { ...init, headers });
}

/**
 * Fetch with Discordbot user-agent — specifically for sites that whitelist Discord.
 */
export async function fetchWithDiscordUA(url: string): Promise<Response> {
  return corsFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
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

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) meta['og:title'] = meta['og:title'] || titleMatch[1];

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (descMatch) meta['og:description'] = meta['og:description'] || descMatch[1];

  return meta;
}
