import { useCallback, useSyncExternalStore } from 'react';
import { Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

/**
 * Returns a Map of eventId → userIds — which users' read receipts
 * stop at each event in the timeline. Used for Element-style
 * avatar dots at last-read positions.
 *
 * The map is rebuilt whenever the room emits `RoomEvent.Receipt`
 * (someone's read marker moved), so every Message component sees
 * consistent receipt positions instead of a stale snapshot from its
 * mount time. The previous `useMemo([room, enabled, ownUserId])`
 * never recomputed once mounted — each Message captured receipts at
 * the position they were when it scrolled into view, and as receipts
 * advanced the indicator visibly multiplied across old messages.
 *
 * ONE subscription per room, shared by every caller. `Message` calls this,
 * so there is a caller per rendered message: subscribing per component put
 * a `Room.receipt` AND a `Room.timeline` listener on the same emitter for
 * every message on screen, which tripped matrix-js-sdk's own
 * `MaxListenersExceededWarning: 51 Room.timeline listeners added` and,
 * worse, ran the whole joined-members × timeline recompute 51 times for a
 * single incoming event. The room-wide answer does not depend on which
 * message asks for it, so it is computed once and handed to all of them.
 */
function computeReceipts(room: Room, ownUserId: string): Map<string, string[]> {
  const members = room.getJoinedMembers();
  const timeline = room.getLiveTimeline().getEvents();
  const eventSet = new Set(timeline.map((e) => e.getId()));

  const receiptMap = new Map<string, string[]>();

  for (const member of members) {
    if (member.userId === ownUserId) continue;
    const readUpTo = room.getEventReadUpTo(member.userId);
    if (!readUpTo) continue;
    if (!eventSet.has(readUpTo)) continue;

    const list = receiptMap.get(readUpTo);
    if (list) {
      list.push(member.userId);
    } else {
      receiptMap.set(readUpTo, [member.userId]);
    }
  }

  return receiptMap;
}

/**
 * Whether a recompute actually changed anything.
 *
 * `useSyncExternalStore` compares snapshots by identity, so handing back a
 * fresh Map on every timeline event would re-render every message on screen
 * even when no receipt moved — which is most events. Keeping the previous
 * Map when the contents match is what turns "one recompute" into "one
 * recompute and no render".
 */
function sameReceipts(a: Map<string, string[]>, b: Map<string, string[]>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [eventId, userIds] of a) {
    const other = b.get(eventId);
    if (!other || other.length !== userIds.length) return false;
    for (let i = 0; i < userIds.length; i += 1) {
      if (userIds[i] !== other[i]) return false;
    }
  }
  return true;
}

const EMPTY_RECEIPTS: Map<string, string[]> = new Map();

type ReceiptStore = {
  snapshot: Map<string, string[]>;
  subscribers: Set<() => void>;
  detach?: () => void;
};

/**
 * Keyed by Room so a store dies with the room object it describes. Entries are
 * also deleted when the last subscriber leaves, so a room revisited later
 * recomputes rather than serving a snapshot frozen at the moment everything
 * unmounted.
 */
const storeByRoom = new WeakMap<Room, ReceiptStore>();

function getStore(room: Room, ownUserId: string): ReceiptStore {
  const existing = storeByRoom.get(room);
  if (existing) return existing;

  const store: ReceiptStore = {
    snapshot: computeReceipts(room, ownUserId),
    subscribers: new Set(),
  };
  storeByRoom.set(room, store);
  return store;
}

function refresh(room: Room, ownUserId: string, store: ReceiptStore): void {
  const next = computeReceipts(room, ownUserId);
  if (sameReceipts(store.snapshot, next)) return;
  store.snapshot = next;
  store.subscribers.forEach((notify) => notify());
}

function subscribeToReceipts(room: Room, ownUserId: string, onChange: () => void): () => void {
  const store = getStore(room, ownUserId);
  store.subscribers.add(onChange);

  if (!store.detach) {
    const handleReceipt: RoomEventHandlerMap[RoomEvent.Receipt] = (event, r) => {
      if (r.roomId !== room.roomId) return;
      refresh(room, ownUserId, store);
    };
    // A new event landed in the live timeline — readUpTo may now point at it,
    // so recompute. Cheap (joined-members count × eventSet lookup) and bounded
    // by member count.
    const handleTimeline = () => refresh(room, ownUserId, store);

    room.on(RoomEvent.Receipt, handleReceipt);
    room.on(RoomEvent.Timeline, handleTimeline);
    store.detach = () => {
      room.removeListener(RoomEvent.Receipt, handleReceipt);
      room.removeListener(RoomEvent.Timeline, handleTimeline);
    };

    // Anything that moved between the snapshot getStore took and the listeners
    // going on is invisible otherwise.
    refresh(room, ownUserId, store);
  }

  return () => {
    store.subscribers.delete(onChange);
    if (store.subscribers.size > 0) return;
    store.detach?.();
    store.detach = undefined;
    storeByRoom.delete(room);
  };
}

export function useElementReadReceipts(room: Room, enabled: boolean): Map<string, string[]> {
  const mx = useMatrixClient();
  const ownUserId = mx.getUserId()!;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return () => undefined;
      return subscribeToReceipts(room, ownUserId, onChange);
    },
    [room, ownUserId, enabled]
  );

  const getSnapshot = useCallback(
    () => (enabled ? getStore(room, ownUserId).snapshot : EMPTY_RECEIPTS),
    [room, ownUserId, enabled]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
