import React, { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';

/**
 * Wraps room content with a left-edge swipe gesture that navigates back
 * to the room list (Discord-style back gesture on mobile).
 */
export function MobileSwipeBack({ children }: { children: React.ReactNode }) {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const handleSwipe = useCallback(
    () => {
      navigate(-1 as any);
    },
    [navigate]
  );

  useSwipeGesture(ref, {
    edge: 'left',
    anywhere: true,
    threshold: 80,
    onSwipe: handleSwipe,
    trackElement: ref,
  });

  if (screenSize !== ScreenSize.Mobile) {
    return <>{children}</>;
  }

  // Participate in the parent flex chain instead of using `height: 100%`.
  // Room.tsx places this wrapper as a flex item; a block-level
  // `height: 100%` collapses inside a flex container so the inner
  // timeline ends up unbounded vertically — symptom on Android: the
  // chat opens scrolled to the top, lags heavily, and touch-scroll
  // down stops working because the scroll container is taller than
  // the visible viewport allows.
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flex: '1 1 0%',
        minWidth: 0,
        minHeight: 0,
        width: '100%',
        touchAction: 'pan-y',
      }}
    >
      {children}
    </div>
  );
}
