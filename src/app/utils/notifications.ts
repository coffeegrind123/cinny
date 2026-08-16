import { EventType, MatrixClient, ReceiptType } from 'matrix-js-sdk';
import { getRoomMarkedUnread } from './room';

/**
 * MSC2867: flag a room unread, or clear the flag.
 *
 * Only ever writes the stable `m.marked_unread` key — `com.famedly.marked_unread`
 * is read for compatibility (see `getRoomMarkedUnread`) but writing it too would
 * mean maintaining two sources of truth that can disagree.
 *
 * The no-op guard is load-bearing, not an optimisation: `clearRoomMarkedUnread`
 * is called from `markAsRead`, which the timeline fires on essentially every
 * scroll-to-bottom. Without the guard that is a PUT to the homeserver per
 * scroll event.
 */
export async function setRoomMarkedUnread(mx: MatrixClient, roomId: string, unread: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;
  if (getRoomMarkedUnread(room) === unread) return;

  await mx.setRoomAccountData(roomId, EventType.MarkedUnread, { unread });
}

/**
 * Clears the MSC2867 flag if it is set, and swallows the failure if it is not.
 *
 * Deliberately never rejects: this rides along with every read receipt, and a
 * homeserver that rejects the account-data write must not take the receipt
 * with it. The flag is cosmetic; the receipt is not.
 */
async function clearRoomMarkedUnread(mx: MatrixClient, roomId: string) {
  try {
    await setRoomMarkedUnread(mx, roomId, false);
  } catch {
    // Intentionally ignored — see above.
  }
}

export async function markAsRead(mx: MatrixClient, roomId: string, privateReceipt: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;

  // Reading the room clears an explicit unread flag, per MSC2867. Done before
  // the early returns below: a room that was marked unread but has no new
  // events hits `timeline.length === 0` or `latestEvent === null` and would
  // otherwise stay flagged forever, with "Mark as Read" appearing to do nothing.
  clearRoomMarkedUnread(mx, roomId);

  const timeline = room.getLiveTimeline().getEvents();
  const readEventId = room.getEventReadUpTo(mx.getUserId()!);

  const getLatestValidEvent = () => {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      const latestEvent = timeline[i];
      if (latestEvent.getId() === readEventId) return null;
      if (!latestEvent.isSending()) return latestEvent;
    }
    return null;
  };
  if (timeline.length === 0) return;
  const latestEvent = getLatestValidEvent();
  if (latestEvent === null) return;

  await mx.sendReadReceipt(
    latestEvent,
    privateReceipt ? ReceiptType.ReadPrivate : ReceiptType.Read
  );
}

export async function markAsUnread(mx: MatrixClient, roomId: string, eventId: string) {
  const room = mx.getRoom(roomId);
  if (!room) return;

  const timeline = room.getLiveTimeline().getEvents();

  let targetIndex = -1;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].getId() === eventId) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex <= 0) return;

  const previousEvent = timeline[targetIndex - 1];
  if (!previousEvent || previousEvent.isSending()) return;

  await mx.sendReadReceipt(previousEvent, ReceiptType.Read);
}
