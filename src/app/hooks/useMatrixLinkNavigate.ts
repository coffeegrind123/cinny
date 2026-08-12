import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from './useMatrixClient';
import { useRoomNavigate } from './useRoomNavigate';
import { parseMatrixTarget } from '../plugins/matrix-uri';
import { getHomeRoomPath, withSearchParam } from '../pages/pathUtils';
import { _RoomSearchParams } from '../pages/paths';
import { isRoomId } from '../utils/matrix';

/**
 * Opens a `matrix:` URI or matrix.to link inside the app.
 *
 * Returns true when the link was understood and handled, so callers can fall
 * back to their normal behaviour (opening a browser, say) for anything else
 * rather than swallowing it.
 */
export const useMatrixLinkNavigate = (): ((rawUrl: string) => boolean) => {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const { navigateRoom, navigateSpace } = useRoomNavigate();

  return useCallback(
    (rawUrl: string): boolean => {
      const target = parseMatrixTarget(rawUrl);
      if (!target) return false;

      if (target.kind === 'user') {
        // No profile route exists to deep-link into, so this lands on the DM
        // with that person if there is one and does nothing otherwise. Better
        // than pretending the link was not understood.
        const dm = mx
          .getRooms()
          .find(
            (room) =>
              room.getMyMembership() === 'join' &&
              room.getJoinedMemberCount() === 2 &&
              room.getMember(target.userId),
          );
        if (dm) {
          navigateRoom(dm.roomId);
          return true;
        }
        return false;
      }

      const { roomIdOrAlias, eventId, viaServers } = target;

      // A room we are already in can be opened directly; anything else goes
      // through the join path, which is what needs the via servers.
      if (isRoomId(roomIdOrAlias) && mx.getRoom(roomIdOrAlias)) {
        if (mx.getRoom(roomIdOrAlias)?.isSpaceRoom()) navigateSpace(roomIdOrAlias);
        else navigateRoom(roomIdOrAlias, eventId);
        return true;
      }

      const path = getHomeRoomPath(roomIdOrAlias, eventId);
      navigate(
        viaServers.length > 0
          ? // The route takes a single comma-free value per via server; the
            // existing mention path passes the raw attribute string, so match it.
            withSearchParam<_RoomSearchParams>(path, { viaServers: viaServers.join(',') })
          : path,
      );
      return true;
    },
    [mx, navigate, navigateRoom, navigateSpace],
  );
};
