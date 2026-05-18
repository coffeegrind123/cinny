import React, { useRef, useCallback, useEffect, useState } from 'react';
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

  // Remember the last room the user was in. After a back-swipe out, the URL
  // no longer has a roomId, so `selectedRoomId` is undefined and a fresh
  // forward-swipe would have nowhere to navigate to. Persisting the last
  // value lets the user toggle in/out of the same DM via swipe.
  const [lastRoomId, setLastRoomId] = useState<string | undefined>(selectedRoomId);
  useEffect(() => {
    if (selectedRoomId) setLastRoomId(selectedRoomId);
  }, [selectedRoomId]);

  const handleSwipe = useCallback(
    () => {
      const target = selectedRoomId ?? lastRoomId;
      if (!target) return;

      const room = mx.getRoom(target);
      if (!room) return;

      const aliasOrId = getCanonicalAliasOrRoomId(mx, target);

      const isDM = Array.from(mDirects.values()).some((roomIds) =>
        roomIds.includes(target)
      );

      const path = isDM
        ? getDirectRoomPath(aliasOrId)
        : getHomeRoomPath(aliasOrId);

      navigate(path);
    },
    [selectedRoomId, lastRoomId, mx, mDirects, navigate]
  );

  const { isTracking } = useSwipeGesture(ref, {
    edge: 'right',
    anywhere: true,
    threshold: 80,
    onSwipe: handleSwipe,
    trackElement: ref,
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
