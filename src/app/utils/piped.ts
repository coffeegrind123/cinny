import { useEffect, useState } from 'react';

// Curated Piped instances (origins only; the embed path is appended per video).
// HTTPS entries first on purpose: the hosted web app is served over https, so an
// http:// iframe is blocked there as mixed content and only loads inside the
// desktop shell. The reachability probe below simply skips whatever the current
// context can't reach — a mixed-content-blocked origin, a bad cert, or a dead
// host — so the list degrades gracefully instead of showing a blank player.
export const PIPED_INSTANCES: string[] = [
  'https://piped.private.coffee',
  'https://183.179.57.169:7000',
  'https://87.184.81.212',
  'http://130.12.171.163:8080',
  'http://82.24.19.217:8083',
  'http://51.154.9.70:8080',
  'http://77.110.101.50',
  'http://51.68.180.170:8090',
];

const DEFAULT_INSTANCE = PIPED_INSTANCES[0];

const trimSlash = (s: string): string => s.replace(/\/+$/, '');

export const pipedEmbedUrl = (origin: string, videoId: string): string =>
  `${trimSlash(origin)}/embed/${videoId}`;

// A reachability probe. `no-cors` means we can't read the response status, but an
// opaque resolve still tells us the host answered and — for https — that its
// certificate was accepted, which is exactly the bar for "can this be embedded
// from here". A mixed-content-blocked http origin, a self-signed cert, or an
// unreachable host rejects, and we pass over it.
const probe = (origin: string, timeoutMs = 4000): Promise<string> =>
  new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
    fetch(trimSlash(origin), { mode: 'no-cors', signal: controller.signal }).then(
      () => {
        clearTimeout(timer);
        resolve(origin);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

// First origin to answer wins — the fastest reachable one — else DEFAULT_INSTANCE
// once every probe has rejected. Hand-rolled rather than Promise.any() because
// the tsconfig lib is ES2020 (Promise.any is ES2021); a Promise settles once, so
// the later resolves are harmless no-ops.
const firstReachable = (origins: string[]): Promise<string> =>
  new Promise((resolve) => {
    let pending = origins.length;
    if (pending === 0) {
      resolve(DEFAULT_INSTANCE);
      return;
    }
    origins.forEach((origin) => {
      probe(origin).then(
        (reachable) => resolve(reachable),
        () => {
          pending -= 1;
          if (pending === 0) resolve(DEFAULT_INSTANCE);
        }
      );
    });
  });

let cached: string | undefined;
let probing: Promise<string> | undefined;

const resolveAuto = (): Promise<string> => {
  if (cached) return Promise.resolve(cached);
  if (!probing) {
    probing = firstReachable(PIPED_INSTANCES).then((origin) => {
      cached = origin;
      return origin;
    });
  }
  return probing;
};

/**
 * Resolve which Piped instance to embed from.
 *
 * @param preferred an explicit user pick. Honoured when reachable; if it is
 *   down we fall back to the auto-probe so a stale choice never leaves a blank
 *   player. Anything not in {@link PIPED_INSTANCES} is ignored (treated as auto).
 */
export const resolvePipedInstance = (preferred?: string): Promise<string> => {
  if (preferred && PIPED_INSTANCES.includes(preferred)) {
    return probe(preferred).then(
      () => preferred,
      () => resolveAuto()
    );
  }
  return resolveAuto();
};

/**
 * React binding for {@link resolvePipedInstance}. Returns the resolved instance,
 * defaulting to the first entry while the probe is in flight so the iframe
 * always has a usable src. Pass '' (or an unknown value) for automatic pick.
 */
export const usePipedInstance = (preferred: string): string => {
  const [instance, setInstance] = useState<string>(cached ?? DEFAULT_INSTANCE);
  useEffect(() => {
    let active = true;
    resolvePipedInstance(preferred || undefined).then((origin) => {
      if (active) setInstance(origin);
    });
    return () => {
      active = false;
    };
  }, [preferred]);
  return instance;
};
