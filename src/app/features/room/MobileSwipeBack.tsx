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
    threshold: 80,
    onSwipe: handleSwipe,
  });

  if (screenSize !== ScreenSize.Mobile) {
    return <>{children}</>;
  }

  return <div ref={ref} style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}>{children}</div>;
}
