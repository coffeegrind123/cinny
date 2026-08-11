import { createContext, ReactNode, useContext } from 'react';

const RoomBackdropContext = createContext(false);

/**
 * Marks the room tree below it as a passive backdrop: mounted purely so a
 * mobile swipe has something real to uncover, never actually looked at.
 *
 * This exists because mounting a room is not a read-only act. RoomTimeline
 * sends a read receipt once its timeline settles at the live edge, and Room
 * binds Escape on `window` to mark the room read. Both are correct for a room
 * the user opened and both are wrong for one rendered behind the room list —
 * without this flag, simply scrolling the conversation list would quietly
 * clear the unread badge on the last room you visited, and no amount of
 * `pointer-events: none` would prevent it, because neither is driven by input.
 */
export function RoomBackdropProvider({ children }: { children: ReactNode }) {
  return <RoomBackdropContext.Provider value>{children}</RoomBackdropContext.Provider>;
}

/** True when this room is a passive backdrop and must not report itself read. */
export const useIsRoomBackdrop = (): boolean => useContext(RoomBackdropContext);
