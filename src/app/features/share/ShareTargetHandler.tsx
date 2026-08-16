import { useEffect, useState } from 'react';
import { SharePayload, onShareReceived } from '../../utils/share-target';
import { SharePrompt } from './SharePrompt';

/**
 * Mount point for the Android share sheet.
 *
 * Lives in ClientNonUIFeatures so it is listening for the whole authenticated
 * session — a share can arrive at any moment, including on cold start before
 * anything is on screen, which is why the Kotlin side stashes and replays.
 *
 * A share that arrives while a previous one is still on screen replaces it.
 * The tokens of the older share have already been revoked by the plugin at
 * that point, so keeping the old prompt around would offer the user a picker
 * for files that can no longer be read.
 */
export function ShareTargetHandler() {
  const [share, setShare] = useState<SharePayload | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    onShareReceived((payload) => setShare(payload)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (!share) return null;

  return <SharePrompt payload={share} requestClose={() => setShare(null)} />;
}
