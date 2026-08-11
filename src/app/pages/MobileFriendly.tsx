import { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { EXPLORE_PATH, INBOX_PATH } from './paths';

type MobileFriendlyClientNavProps = {
  children: ReactNode;
};
export function MobileFriendlyClientNav({ children }: MobileFriendlyClientNavProps) {
  const screenSize = useScreenSizeContext();
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const inboxMatch = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });

  if (screenSize === ScreenSize.Mobile) {
    // Home, Direct and Space render the rail themselves, inside MobileSwipeOpen,
    // so it slides out with the room list instead of standing still beside the
    // animation. Rendering it here as well would show two copies of it.
    // Explore and Inbox have no swipe surface, so they still get it from here.
    if (exploreMatch || inboxMatch) return children;
    return null;
  }

  return children;
}

type MobileFriendlyPageNavProps = {
  path: string;
  children: ReactNode;
};
/**
 * Renders the page-nav (room list) for the given parent path.
 *
 * - Desktop: always rendered inline.
 * - Mobile, on the parent path (e.g. `/home`): rendered inline as the
 *   sole visible content.
 * - Mobile, on a sub-path (e.g. `/home/r/<roomId>`): rendered as an
 *   absolute backdrop at z-index 0 so a swipe-back from the room view
 *   reveals it underneath (MobileSwipeBack sits on top at z-index 1).
 *   This is what gives the user the visual continuity of "the main view
 *   sliding to view" during the gesture.
 */
export function MobileFriendlyPageNav({ path, children }: MobileFriendlyPageNavProps) {
  const screenSize = useScreenSizeContext();
  const exactPath = useMatch({
    path,
    caseSensitive: true,
    end: true,
  });

  if (screenSize !== ScreenSize.Mobile) {
    return children;
  }

  if (exactPath) {
    return children;
  }

  // Sub-route on mobile — backdrop mode. `aria-hidden` keeps it out of
  // assistive-tech focus order since it's purely a visual reveal target
  // and not interactive while the foreground (room) is on top.
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        display: 'flex',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}
