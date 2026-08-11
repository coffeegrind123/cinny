/**
 * The room a mobile forward-swipe should open, remembered across remounts.
 *
 * Module-scoped rather than component state on purpose. MobileFriendlyPageNav
 * swaps its return between bare children (on the parent path) and a wrapping
 * backdrop div (on a room sub-path), which remounts everything underneath on
 * every in/out transition — a useState would reset to undefined each time and
 * break swiping back into the conversation you just left.
 */
let lastOpenedRoomId: string | undefined;

export const setLastOpenedRoomId = (roomId: string): void => {
  lastOpenedRoomId = roomId;
};

export const getLastOpenedRoomId = (): string | undefined => lastOpenedRoomId;
