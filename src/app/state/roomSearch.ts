import { atom } from 'jotai';

// Controls visibility of the in-room message search drawer. Ephemeral (not
// persisted) — reset to false when switching rooms. Shared between
// RoomViewHeader (the toggle button) and Room (which renders the drawer).
export const roomSearchOpenAtom = atom<boolean>(false);

// Desktop has no search overlay — people + message search lives in the members
// drawer instead. The toolbar search button therefore has to reach across to
// that drawer's input, which is a sibling component (and may not even be
// mounted yet, since the button opens the drawer in the same click).
//
// This is a *consumable* request, not a flag or a monotonic counter: the header
// bumps it, MembersDrawer focuses its input and immediately resets it to 0.
// Consuming it is what keeps "open the member list normally" from stealing
// focus into the search box — a counter would still be non-zero at mount time
// and fire for every later open. Incrementing (rather than setting 1) means
// repeat clicks while the drawer is already open re-focus as well.
export const roomSearchFocusRequestAtom = atom<number>(0);
