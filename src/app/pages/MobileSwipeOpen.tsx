import React, { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';

/**
 * Wraps a room/channel nav list with a right-edge swipe gesture.
 * On right-to-left swipe, finds the room list item nearest the touch
 * point and navigates to it (Discord-style open-room gesture on mobile).
 */
export function MobileSwipeOpen({ children }: { children: React.ReactNode }) {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const handleSwipe = useCallback(
    ({ startY }: { startY: number }) => {
      // Find the room link at the touch Y coordinate, near the right edge
      const midX = Math.round(window.innerWidth / 2);
      const elements = document.elementsFromPoint(midX, Math.round(startY));

      for (const el of elements) {
        if (el instanceof HTMLAnchorElement) {
          const href = el.getAttribute('href');
          if (href) {
            // Match room paths: /home/room/:id, /direct/room/:id, /space/:id/room/:id
            const roomMatch = href.match(/\/(home|direct|space\/[^/]+)\/room\//);
            if (roomMatch) {
              navigate(href);
              return;
            }
          }
        }
      }
    },
    [navigate]
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
