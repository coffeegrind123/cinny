import { useMatrixClient } from '../hooks/useMatrixClient';
import { getLastOpenedRoomId } from '../state/lastOpenedRoom';
import { RoomProvider } from '../hooks/useRoom';
import { Room } from '../features/room';
import { RoomBackdropProvider } from '../hooks/useRoomBackdrop';

/**
 * Renders the last-opened room behind the room list on mobile, so a
 * forward-swipe uncovers the actual conversation instead of flat colour.
 *
 * This is the mirror of what already happens in the other direction: on a room
 * sub-path MobileFriendlyPageNav renders the nav as an absolute backdrop at
 * z-index 0 with the room on top, which is why swiping *out* of a chat reveals
 * the list. On the parent path there was nothing on the other side — the room
 * outlet is empty until navigation happens — so swiping toward a chat had
 * nothing to show.
 *
 * Two properties matter and are easy to lose:
 *
 * - `RoomBackdropProvider` suppresses read receipts for this tree. Mounting a
 *   room otherwise reports it read (RoomTimeline settles at the live edge, and
 *   Room answers Escape on `window`), which would clear unread badges for a
 *   room the user never opened. `pointer-events: none` does not help — neither
 *   path is driven by input.
 * - `z-index: 0` puts this under the nav, which MobileSwipeOpen raises to
 *   z-index 1. A positioned element paints above a static one regardless of
 *   document order, so the nav has to be positioned too or this would cover it.
 */
export function MobileRoomBackdrop() {
  const mx = useMatrixClient();
  const roomId = getLastOpenedRoomId();
  const room = roomId ? mx.getRoom(roomId) : undefined;

  // No conversation visited yet this session — nothing to reveal, and no
  // reason to pay for a timeline.
  if (!room) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        pointerEvents: 'none',
      }}
    >
      <RoomBackdropProvider>
        <RoomProvider key={room.roomId} value={room}>
          <Room />
        </RoomProvider>
      </RoomBackdropProvider>
    </div>
  );
}
