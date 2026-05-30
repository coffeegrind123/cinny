import { atom } from 'jotai';

// Controls visibility of the in-room message search drawer. Ephemeral (not
// persisted) — reset to false when switching rooms. Shared between
// RoomViewHeader (the toggle button) and Room (which renders the drawer).
export const roomSearchOpenAtom = atom<boolean>(false);
