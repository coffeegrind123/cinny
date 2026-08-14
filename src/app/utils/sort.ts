import { MatrixClient } from 'matrix-js-sdk';

export type SortFunc<T> = (a: T, b: T) => number;

export const factoryRoomIdByActivity =
  (mx: MatrixClient): SortFunc<string> =>
  (a, b) => {
    const room1 = mx.getRoom(a);
    const room2 = mx.getRoom(b);

    return (
      (room2?.getLastActiveTimestamp() ?? Number.MIN_SAFE_INTEGER) -
      (room1?.getLastActiveTimestamp() ?? Number.MIN_SAFE_INTEGER)
    );
  };

export const factoryRoomIdByAtoZ =
  (mx: MatrixClient): SortFunc<string> =>
  (a, b) => {
    let aName = mx.getRoom(a)?.name ?? '';
    let bName = mx.getRoom(b)?.name ?? '';

    // remove "#" from the room name
    // To ignore it in sorting
    aName = aName.replace(/#/g, '');
    bName = bName.replace(/#/g, '');

    if (aName.toLowerCase() < bName.toLowerCase()) {
      return -1;
    }
    if (aName.toLowerCase() > bName.toLowerCase()) {
      return 1;
    }
    return 0;
  };

/**
 * Pinned rooms first, everything else in whatever order `next` gives.
 *
 * Within the pinned block the `m.tag` `order` wins where both rooms have one —
 * that is the field Element writes when favourites are dragged into a manual
 * order, so honouring it keeps the two clients showing the same sequence. It is
 * optional though, so untagged-order pins fall through to `next` rather than
 * being lumped together arbitrarily.
 */
export const factoryRoomIdByPinned =
  (pinned: Map<string, number | undefined>, next: SortFunc<string>): SortFunc<string> =>
  (a, b) => {
    const aPinned = pinned.has(a);
    const bPinned = pinned.has(b);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    if (aPinned && bPinned) {
      const aOrder = pinned.get(a);
      const bOrder = pinned.get(b);
      if (typeof aOrder === 'number' && typeof bOrder === 'number') {
        if (aOrder !== bOrder) return aOrder - bOrder;
      } else if (typeof aOrder === 'number') {
        return -1;
      } else if (typeof bOrder === 'number') {
        return 1;
      }
    }

    return next(a, b);
  };

export const factoryRoomIdByUnreadCount =
  (getUnreadCount: (roomId: string) => number): SortFunc<string> =>
  (a, b) => {
    const aT = getUnreadCount(a) ?? 0;
    const bT = getUnreadCount(b) ?? 0;
    return bT - aT;
  };

export const byTsOldToNew: SortFunc<number> = (a, b) => a - b;

export const byOrderKey: SortFunc<string | undefined> = (a, b) => {
  if (!a && !b) {
    return 0;
  }

  if (!b) return -1;
  if (!a) return 1;

  if (a < b) {
    return -1;
  }
  return 1;
};
