import { atom } from 'jotai';

/** One nav list's rooms, in the order that list renders them. */
export type NavRoomSection = {
  /** Position among the lists rendered beside it, low to high, top to bottom. */
  order: number;
  roomIds: string[];
};

/** Keyed by the registering hook instance, so two copies of one list can coexist. */
export type NavRoomOrder = Map<string, NavRoomSection>;

/**
 * What the room navigation is showing right now, published by the lists
 * themselves.
 *
 * Keyboard navigation between sibling rooms has to move through the list the
 * user is looking at, and that list is not derivable from the room state alone:
 * it is pinned-first, then sorted by activity or A-Z depending on which nav it
 * is, filtered by "show unread only", and inside a space it is a hierarchy with
 * custom order, sort mode and collapsed categories. Recomputing it anywhere
 * else is a copy that drifts — Alt+Up/Down did exactly that and stepped through
 * an unsorted internal list, so it skipped around the visible order seemingly
 * at random.
 *
 * So the lists publish what they render, and everything else reads it.
 */
export const navRoomOrderAtom = atom<NavRoomOrder>(new Map());
