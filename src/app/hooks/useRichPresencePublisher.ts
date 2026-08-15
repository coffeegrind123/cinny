import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { richPresenceBridgeStatusAtom } from '../state/richPresenceBridge';
import { MSC4320_RPC } from '../../types/matrix/richPresence';
import {
  isMediaPayload,
  mapDiscordActivity,
  sameActivityPayload,
  withCoverArt,
  type ActivityPayload,
  type DiscordRichPresenceActivity,
} from '../utils/discordActivity';
import { isTauriDesktop } from '../utils/platform';

// Minimum interval between profile writes. Discord-RPC clients can fire
// SET_ACTIVITY on every progress tick; coalesce to avoid hammering the HS.
const MIN_WRITE_INTERVAL = 5000;

/** Event the Rust bridge emits whenever the current activity changes. */
const ACTIVITY_EVENT = 'rich-presence-activity';

type BridgeStarted = { path: string; index: number };

/**
 * Publishes whatever the local Discord-RPC bridge captures as the user's
 * MSC4320 rich presence. Desktop-only and off by default; on web and mobile the
 * effect returns immediately, because there is no pipe to listen on.
 *
 * The socket server itself is Rust — `start_rich_presence_bridge` in the
 * prinny-client repo — because a webview cannot bind a named pipe or a unix
 * socket. This half owns only the mapping and the throttled profile write.
 *
 * Cover art is resolved through the homeserver's preview_url endpoint: it
 * fetches and caches the external image and returns an mxc://, which the reader
 * renders natively. No client-side download or upload, and no SSRF surface here.
 */
export const useRichPresencePublisher = () => {
  const mx = useMatrixClient();
  const [enabled] = useSetting(settingsAtom, 'publishRichPresence');
  const setStatus = useSetAtom(richPresenceBridgeStatusAtom);

  useEffect(() => {
    if (!enabled) {
      setStatus(undefined);
      return undefined;
    }

    let stopped = false;
    let started = false;
    let pending: ActivityPayload | null = null;
    let lastWritten: ActivityPayload | null = null;
    let lastWriteAt = 0;
    let inFlight = false;
    let unlisten: (() => void) | undefined;

    // Cover-art resolution: turn an external image URL into an MXC via the
    // homeserver's preview_url endpoint. Deduped by URL so a repeated cover
    // (same album) never re-fetches.
    const coverCache = new Map<string, string | null>(); // url -> mxc, or null if unavailable
    const resolving = new Set<string>();
    let currentCoverUrl: string | undefined;

    const tick = async () => {
      if (stopped || inFlight) return;
      if (sameActivityPayload(pending, lastWritten)) return;
      inFlight = true;
      try {
        if (pending) {
          await mx.setExtendedProfileProperty(MSC4320_RPC, pending);
        } else {
          await mx.deleteExtendedProfileProperty(MSC4320_RPC);
        }
        lastWritten = pending;
        lastWriteAt = Date.now();
      } catch {
        // Server may not support MSC4133 extended profiles; stay silent.
      }
      inFlight = false;
    };

    const applyCover = (url: string, mxc: string | null) => {
      if (stopped || !mxc || currentCoverUrl !== url || !pending) return;
      const hasCover = isMediaPayload(pending) ? !!pending.cover_art : !!pending.image;
      if (hasCover) return;
      pending = withCoverArt(pending, mxc);
      tick();
    };

    const resolveCover = (url: string) => {
      if (coverCache.has(url)) {
        applyCover(url, coverCache.get(url) ?? null);
        return;
      }
      if (resolving.has(url)) return;
      resolving.add(url);
      mx.getUrlPreview(url, Date.now())
        .then((prev) => {
          const img = prev?.['og:image'];
          const mxc = typeof img === 'string' && img.startsWith('mxc://') ? img : null;
          coverCache.set(url, mxc);
          resolving.delete(url);
          applyCover(url, mxc);
        })
        .catch(() => {
          // Preview disabled / blocked / unreachable: skip the cover silently.
          coverCache.set(url, null);
          resolving.delete(url);
        });
    };

    const handleActivity = (activity: DiscordRichPresenceActivity | null) => {
      if (stopped) return;
      if (!activity) {
        pending = null;
        currentCoverUrl = undefined;
      } else {
        const { payload, coverUrl } = mapDiscordActivity(activity);
        pending = payload;
        currentCoverUrl = coverUrl;
        // Synchronous apply when the cover was resolved on a previous track.
        if (coverUrl) resolveCover(coverUrl);
      }
      // Leading-edge write when the throttle window has elapsed; otherwise the
      // interval tick below flushes it within MIN_WRITE_INTERVAL.
      if (Date.now() - lastWriteAt >= MIN_WRITE_INTERVAL) tick();
    };

    const interval = setInterval(() => {
      tick();
    }, MIN_WRITE_INTERVAL);

    const init = async () => {
      if (!(await isTauriDesktop())) {
        // Not an error: the web and mobile builds simply have no bridge.
        setStatus(undefined);
        return;
      }
      if (stopped) return;
      setStatus({ state: 'starting' });

      const [{ invoke }, { listen }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/event'),
      ]);
      if (stopped) return;

      let bound: BridgeStarted;
      try {
        bound = await invoke<BridgeStarted>('start_rich_presence_bridge');
      } catch (err) {
        if (!stopped) setStatus({ state: 'error', error: String(err) });
        return;
      }
      started = true;
      if (stopped) return;

      const unlistenFn = await listen<DiscordRichPresenceActivity | null>(
        ACTIVITY_EVENT,
        (event) => handleActivity(event.payload)
      );
      if (stopped) {
        unlistenFn();
        return;
      }
      unlisten = unlistenFn;
      setStatus({ state: 'running', path: bound.path, index: bound.index });
    };
    init().catch((err) => {
      if (!stopped) setStatus({ state: 'error', error: String(err) });
    });

    return () => {
      stopped = true;
      clearInterval(interval);
      unlisten?.();
      // Leave no stale presence behind when disabling or tearing down.
      mx.deleteExtendedProfileProperty(MSC4320_RPC).catch(() => undefined);
      if (started) {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => invoke('stop_rich_presence_bridge'))
          .catch(() => undefined);
      }
      setStatus({ state: 'stopped' });
    };
  }, [mx, enabled, setStatus]);
};

/** Renders nothing; exists to host the publisher hook inside the client tree. */
export function RichPresencePublisher() {
  useRichPresencePublisher();
  return null;
}
