import { useSetAtom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { useKeybind } from '../../hooks/useKeybind';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getHoveredMessageEventId } from '../../state/hoveredMessage';
import { roomIdToReplyDraftAtomFamily } from '../../state/room/roomInputDrafts';
import { useRoomPinnedEvents } from '../../hooks/useRoomPinnedEvents';
import { copyToClipboard } from '../../utils/dom';
import { markAsUnread } from '../../utils/notifications';
import { StateEvent } from '../../../types/matrix/room';
import { getEditedEvent } from '../../utils/room';

type Props = {
  room: Room;
  onSetEditId: (id: string | undefined) => void;
};

// Bindings keyed to the message currently under the cursor. Mounted once
// inside RoomTimeline so the room context here matches the visible
// timeline. All bindings are no-ops when no message is hovered (or the
// hovered event is no longer in this room's timeline).
export function MessageKeybinds({ room, onSetEditId }: Props) {
  const mx = useMatrixClient();
  const setReplyDraft = useSetAtom(roomIdToReplyDraftAtomFamily(room.roomId));
  const pinnedEvents = useRoomPinnedEvents(room);

  const withHoveredEvent = (cb: (eventId: string) => void) => () => {
    const id = getHoveredMessageEventId();
    if (!id) return;
    const ev = room.findEventById(id);
    if (!ev) return;
    cb(id);
  };

  // Edit own messages only — the server rejects edits from other senders
  // and the existing menu item is gated the same way.
  useKeybind(
    'edit-message',
    withHoveredEvent((id) => {
      const ev = room.findEventById(id);
      if (!ev) return;
      if (ev.getSender() !== mx.getUserId()) return;
      onSetEditId(id);
    })
  );

  useKeybind(
    'delete-message',
    withHoveredEvent((id) => {
      // Confirm via OS prompt so accidental Backspace doesn't nuke a
      // message. Native confirm is OK here — same UX shape as Delete in
      // the right-click menu.
      // eslint-disable-next-line no-alert
      if (!window.confirm('Delete this message?')) return;
      mx.redactEvent(room.roomId, id).catch((err) => {
        console.error('[keybind] redactEvent failed:', err);
      });
    })
  );

  useKeybind(
    'pin-message',
    withHoveredEvent((id) => {
      const userId = mx.getUserId();
      if (!userId) return;
      // Toggle: unpin if already pinned, otherwise pin.
      const isPinned = pinnedEvents.includes(id);
      const next = isPinned
        ? pinnedEvents.filter((p) => p !== id)
        : [...pinnedEvents, id];
      mx.sendStateEvent(
        room.roomId,
        StateEvent.RoomPinnedEvents as any,
        { pinned: next }
      ).catch((err) => {
        console.error('[keybind] pin sendStateEvent failed:', err);
      });
    })
  );

  useKeybind(
    'reply-message',
    withHoveredEvent((id) => {
      const replyEvt = room.findEventById(id);
      if (!replyEvt) return;
      const editedReply = getEditedEvent(id, replyEvt, room.getUnfilteredTimelineSet());
      const content =
        editedReply?.getContent()['m.new_content'] ?? replyEvt.getContent();
      const body = content.body as string | undefined;
      const formattedBody = content.formatted_body as string | undefined;
      const relation = (replyEvt.getWireContent() as any)['m.relates_to'];
      const senderId = replyEvt.getSender();
      if (!senderId || typeof body !== 'string') return;
      setReplyDraft({
        userId: senderId,
        eventId: id,
        body,
        formattedBody,
        relation,
      });
    })
  );

  useKeybind(
    'copy-text',
    () => {
      // Browser's default Mod+C wins if the user has an active selection.
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return false;
      const id = getHoveredMessageEventId();
      if (!id) return false;
      const ev = room.findEventById(id);
      if (!ev) return false;
      const edited = getEditedEvent(id, ev, room.getUnfilteredTimelineSet());
      const content = edited?.getContent()['m.new_content'] ?? ev.getContent();
      const text = (content?.body as string | undefined) ?? '';
      if (!text) return false;
      copyToClipboard(text);
      return undefined;
    },
    { allowInEditable: true } // Mod+C is a modifier binding; let users copy from inputs too
  );

  useKeybind(
    'mark-unread',
    withHoveredEvent((id) => {
      markAsUnread(mx, room.roomId, id);
    })
  );

  return null;
}
