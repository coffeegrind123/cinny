import { useMemo } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

/**
 * Returns a Map of eventId → userIds — which users' read receipts
 * stop at each event in the timeline. Used for Element-style
 * avatar dots at last-read positions.
 */
export function useElementReadReceipts(room: Room, enabled: boolean): Map<string, string[]> {
  const mx = useMatrixClient();
  const ownUserId = mx.getUserId()!;

  return useMemo(() => {
    if (!enabled) return new Map();

    const members = room.getJoinedMembers();
    const timeline = room.getLiveTimeline().getEvents();
    const eventSet = new Set(timeline.map((e) => e.getId()));

    const receiptMap = new Map<string, string[]>();

    for (const member of members) {
      if (member.userId === ownUserId) continue;
      const readUpTo = room.getEventReadUpTo(member.userId);
      if (!readUpTo) continue;

      // If the receipt points to an event not in the current timeline,
      // find the closest ancestor that IS in the timeline
      let resolvedId: string | null = readUpTo;
      if (!eventSet.has(readUpTo)) {
        for (let i = timeline.length - 1; i >= 0; i--) {
          if (timeline[i].getId() === readUpTo) {
            resolvedId = timeline[i].getId();
            break;
          }
        }
        if (!eventSet.has(resolvedId)) {
          resolvedId = null;
        }
      }
      if (!resolvedId) continue;

      const list = receiptMap.get(resolvedId);
      if (list) {
        list.push(member.userId);
      } else {
        receiptMap.set(resolvedId, [member.userId]);
      }
    }

    return receiptMap;
  }, [room, enabled, ownUserId]);
}
