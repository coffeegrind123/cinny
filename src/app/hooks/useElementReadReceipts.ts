import { useEffect, useState } from 'react';
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
 */
function computeReceipts(
  room: Room,
  enabled: boolean,
  ownUserId: string
): Map<string, string[]> {
  if (!enabled) return new Map();

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

export function useElementReadReceipts(room: Room, enabled: boolean): Map<string, string[]> {
  const mx = useMatrixClient();
  const ownUserId = mx.getUserId()!;
  const [receipts, setReceipts] = useState<Map<string, string[]>>(() =>
    computeReceipts(room, enabled, ownUserId)
  );

  useEffect(() => {
    setReceipts(computeReceipts(room, enabled, ownUserId));
    if (!enabled) return undefined;

    const handleReceipt: RoomEventHandlerMap[RoomEvent.Receipt] = (event, r) => {
      if (r.roomId !== room.roomId) return;
      setReceipts(computeReceipts(room, enabled, ownUserId));
    };
    const handleTimeline = () => {
      // A new event landed in the live timeline — readUpTo may now point
      // at it, so recompute. Cheap (joined-members count × eventSet
      // lookup) and bounded by member count.
      setReceipts(computeReceipts(room, enabled, ownUserId));
    };

    room.on(RoomEvent.Receipt, handleReceipt);
    room.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      room.removeListener(RoomEvent.Receipt, handleReceipt);
      room.removeListener(RoomEvent.Timeline, handleTimeline);
    };
  }, [room, enabled, ownUserId]);

  return receipts;
}
