import { MatrixClient, ReceiptType } from 'matrix-js-sdk';

export async function markAsRead(mx: MatrixClient, roomId: string, privateReceipt: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;

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
