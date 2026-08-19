import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useId, useMemo } from 'react';
import { navRoomOrderAtom, NavRoomOrder } from '../navRoomOrder';

const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Publishes a nav list's rendered room order for as long as it is mounted.
 *
 * Registration is per hook instance, not per list: the mobile nav can have two
 * copies of one list mounted at once, and a shared key would let whichever
 * copy unmounts first delete the entry the other is still keeping current.
 * Two copies therefore publish two identical sections, which the reader below
 * collapses.
 *
 * @param order Where this list sits among the ones rendered beside it, top to
 *   bottom. Home shows rooms above chats, so its two lists are 10 and 20.
 * @param roomIds The rooms in render order, including any scrolled out of view:
 *   this is the list as it reads, not the slice the virtualizer has mounted.
 *   Memoize it — an unstable array only costs an extra equality check, but a
 *   stable one skips the work entirely.
 */
export const useRegisterNavRoomOrder = (order: number, roomIds: string[]): void => {
  const setNavRoomOrder = useSetAtom(navRoomOrderAtom);
  const instance = useId();

  useEffect(() => {
    setNavRoomOrder((prev) => {
      const current = prev.get(instance);
      if (current && current.order === order && sameIds(current.roomIds, roomIds)) {
        // Nothing changed. Returning the same Map keeps every reader from
        // re-rendering on a list that merely recomputed to the same answer.
        return prev;
      }
      const next: NavRoomOrder = new Map(prev);
      next.set(instance, { order, roomIds });
      return next;
    });
  }, [setNavRoomOrder, order, roomIds, instance]);

  // Unmount only — kept apart from the write above so a changing list does not
  // churn the registration.
  useEffect(
    () => () => {
      setNavRoomOrder((prev) => {
        if (!prev.has(instance)) return prev;
        const next: NavRoomOrder = new Map(prev);
        next.delete(instance);
        return next;
      });
    },
    [setNavRoomOrder, instance],
  );
};

/**
 * Every room the navigation is currently showing, in visible order, with the
 * sections concatenated top to bottom.
 *
 * `undefined` when no room list is mounted at all (Explore, the inbox, a
 * settings route) — distinct from an empty array, which means a list IS on
 * screen and showing nothing, e.g. "show unread only" with everything read. A
 * caller with a fallback must not run it in the second case: there is a visible
 * order and it is empty, so there is nowhere to move.
 *
 * Duplicates are dropped, keeping the first: a room listed twice would be
 * stepped onto twice, and a second copy of a whole list would silently double
 * its length.
 */
export const useNavRoomOrder = (): string[] | undefined => {
  const navRoomOrder = useAtomValue(navRoomOrderAtom);

  return useMemo(() => {
    if (navRoomOrder.size === 0) return undefined;
    const seen = new Set<string>();
    return Array.from(navRoomOrder.values())
      .sort((a, b) => a.order - b.order)
      .flatMap((section) => section.roomIds)
      .filter((roomId) => {
        if (seen.has(roomId)) return false;
        seen.add(roomId);
        return true;
      });
  }, [navRoomOrder]);
};
