import React, { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { useSelectedRoom } from '../hooks/router/useSelectedRoom';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { mDirectAtom } from '../state/mDirectList';
import { getCanonicalAliasOrRoomId } from '../utils/matrix';
import { getHomeRoomPath, getDirectRoomPath } from './pathUtils';

/**
 * Wraps room/channel nav list with a right-edge swipe gesture.
 * On right-to-left swipe, navigates to the currently selected room
 * (Discord-style: opens the active chat instead of hit-testing touch position).
 */
export function MobileSwipeOpen({ children }: { children: React.ReactNode }) {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const location = useLocation();
  const mx = useMatrixClient();
  const ref = useRef<HTMLDivElement>(null);

  const selectedRoomId = useSelectedRoom();
  const mDirects = useAtomValue(mDirectAtom);

  const handleSwipe = useCallback(
    () => {
      if (!selectedRoomId) return;

      const room = mx.getRoom(selectedRoomId);
      if (!room) return;

      const aliasOrId = getCanonicalAliasOrRoomId(mx, selectedRoomId);

      // Determine whether this is a DM by checking m.direct account data
      const isDM = Array.from(mDirects.values()).some((roomIds) =>
        roomIds.includes(selectedRoomId)
      );

      const path = isDM
        ? getDirectRoomPath(aliasOrId)
        : getHomeRoomPath(aliasOrId);

      navigate(path);
    },
    [selectedRoomId, mx, mDirects, navigate]
  );

  useSwipeGesture(ref, {
    edge: 'right',
    threshold: 80,
    onSwipe: handleSwipe,
  });

  if (screenSize !== ScreenSize.Mobile) {
    return <>{children}</>;
  }

  return <div ref={ref} style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}>{children}</div>;
}
