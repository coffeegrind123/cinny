import { useEffect, useMemo, useState } from 'react';
import { User, UserEvent, UserEventHandlerMap } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export enum Presence {
  Online = 'online',
  Unavailable = 'unavailable',
  Offline = 'offline',
}

export type UserPresence = {
  presence: Presence;
  status?: string;
  active: boolean;
  lastActiveTs?: number;
};

const getUserPresence = (user: User): UserPresence => ({
  presence: user.presence as Presence,
  status: user.presenceStatusMsg,
  active: user.currentlyActive,
  lastActiveTs: user.getLastActiveTs(),
});

export const useUserPresence = (userId: string): UserPresence | undefined => {
  const mx = useMatrixClient();

  const [presence, setPresence] = useState<UserPresence | undefined>(() => {
    const u = userId ? mx.getUser(userId) : null;
    return u ? getUserPresence(u) : undefined;
  });

  useEffect(() => {
    if (!userId) {
      setPresence(undefined);
      return undefined;
    }

    // Sync immediately from whatever the store currently holds. The lazy
    // useState initializer above runs once; if the peer's `User` object
    // didn't exist yet at first render (common — it's created lazily from the
    // first presence EDU / membership), the captured value would otherwise
    // stay stale (or `undefined`, hiding the badge) until a live event fired.
    // Re-running this on every `userId` change also keeps the badge correct
    // when a single nav item is reused for a different room.
    const sync = () => {
      const u = mx.getUser(userId);
      setPresence(u ? getUserPresence(u) : undefined);
    };
    sync();

    // Presence events are re-emitted on the MatrixClient for every `User`
    // (see `User.createUser`'s reEmitter wiring), so subscribe at the client
    // level rather than on one `User` instance. This way we still receive
    // updates for a peer whose `User` object only materialises *after* this
    // hook mounted — the per-User listener the old code used would miss those
    // entirely, leaving the indicator stuck on a stale state.
    const onPresence: UserEventHandlerMap[UserEvent.Presence] = (_event, u) => {
      if (u.userId === userId) {
        setPresence(getUserPresence(u));
      }
    };
    mx.on(UserEvent.Presence, onPresence);
    mx.on(UserEvent.CurrentlyActive, onPresence);
    mx.on(UserEvent.LastPresenceTs, onPresence);
    return () => {
      mx.removeListener(UserEvent.Presence, onPresence);
      mx.removeListener(UserEvent.CurrentlyActive, onPresence);
      mx.removeListener(UserEvent.LastPresenceTs, onPresence);
    };
  }, [mx, userId]);

  return presence;
};

export const usePresenceLabel = (): Record<Presence, string> =>
  useMemo(
    () => ({
      [Presence.Online]: 'Active',
      [Presence.Unavailable]: 'Busy',
      [Presence.Offline]: 'Away',
    }),
    []
  );
