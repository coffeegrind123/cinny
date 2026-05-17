import { useEffect, useRef, useCallback, useState } from 'react';

interface SwipeGestureOptions {
  /** Which edge to detect swipe from */
  edge: 'left' | 'right';
  /** How close to the edge (in px) the touch must start */
  edgeWidth?: number;
  /** Minimum horizontal distance to trigger the swipe */
  threshold?: number;
  /** Called when a valid swipe completes. direction: 1 = inward from edge, -1 = outward toward edge */
  onSwipe: (info: { startY: number; direction: number }) => void;
}

/**
 * Detects edge-swipe gestures on a ref'd element.
 *
 * Left edge: swipe right = inward (direction 1), swipe left = outward (-1)
 * Right edge: swipe left = inward (direction 1), swipe right = outward (-1)
 */
export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  { edge, edgeWidth = 32, threshold = 80, onSwipe }: SwipeGestureOptions
): { isTracking: boolean } {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const [isTracking, setIsTracking] = useState(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const atEdge =
        edge === 'left'
          ? touch.clientX <= edgeWidth
          : touch.clientX >= window.innerWidth - edgeWidth;

      if (atEdge) {
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        tracking.current = true;
        setIsTracking(true);
      }
    },
    [edge, edgeWidth]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!tracking.current || e.touches.length !== 1) return;
      // Don't preventDefault — let scrolling happen. We only care about the final swipe.
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!tracking.current) return;
      tracking.current = false;
      setIsTracking(false);

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      // Require horizontal movement to dominate (not a diagonal scroll)
      if (Math.abs(dx) < threshold || Math.abs(dx) < dy * 1.5) return;

      const direction =
        edge === 'left'
          ? dx > 0 ? 1 : -1   // left edge: right = inward
          : dx < 0 ? 1 : -1;  // right edge: left = inward

      if (direction > 0) {
        onSwipe({ startY: startY.current, direction });
      }
    },
    [edge, threshold, onSwipe]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isTracking };
}
