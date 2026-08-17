import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { userTimezoneAtomFamily } from '../state/userTimezone';
import { getProfileTimezone } from '../../types/matrix/profile';

/**
 * A user's time zone (MSC4175 `m.tz`), fetched only once `active` is true.
 *
 * Gated rather than eager because the caller is a message timestamp, and a
 * timeline has one of those per message. Fetching on render would mean an
 * extended-profile request per message on every room you open, to populate
 * something nobody has looked at — so the request waits until a pointer is
 * actually on the timestamp, and the answer is cached per user from then on.
 * Hovering a second message from the same person costs nothing.
 *
 * A failure is cached as "no zone" too. The extended-profile endpoint is absent
 * on homeservers without MSC4133, where it rejects for every user, every time;
 * retrying that on each hover would be a steady stream of requests that cannot
 * succeed.
 */
export const useUserTimezone = (userId: string, active: boolean): string | undefined => {
  const mx = useMatrixClient();
  const [timezone, setTimezone] = useAtom(userTimezoneAtomFamily(userId));

  useEffect(() => {
    // `undefined` is the only state worth a request: null means asked and
    // answered, a string means we already know.
    if (!active || !userId || timezone !== undefined) return undefined;

    let live = true;
    mx.getExtendedProfile(userId).then(
      (profile) => {
        if (live) setTimezone(getProfileTimezone(profile) ?? null);
      },
      () => {
        if (live) setTimezone(null);
      },
    );

    return () => {
      live = false;
    };
  }, [mx, userId, active, timezone, setTimezone]);

  return timezone ?? undefined;
};
