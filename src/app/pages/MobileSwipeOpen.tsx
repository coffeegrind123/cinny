import React, { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * Highlights the selected room during the swipe gesture for visual feedback.
 */
export function MobileSwipeOpen({ children }: { children: React.ReactNode }) {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
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

  const { isTracking } = useSwipeGesture(ref, {
    edge: 'right',
    threshold: 80,
    onSwipe: handleSwipe,
  });

  if (screenSize !== ScreenSize.Mobile) {
    return <>{children}</>;
  }

  return (
    <>
      {isTracking && (
        <style>{`
          [data-mobile-swipe-open] [aria-selected="true"] {
            background: var(--folds-color-primary-container) !important;
            box-shadow: inset 4px 0 0 var(--folds-color-primary) !important;
          }
        `}</style>
      )}
      <div
        ref={ref}
        data-mobile-swipe-open={isTracking ? 'true' : undefined}
        style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </>
  );
}
