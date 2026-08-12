import { atom } from 'jotai';

export type ThreadViewState = {
  roomId: string;
  rootId: string;
};

/**
 * The thread currently open in the side panel, if any.
 *
 * Holds the room id as well as the root so that switching rooms closes a thread
 * belonging to the room you just left, rather than showing it over the new one.
 */
export const threadViewAtom = atom<ThreadViewState | undefined>(undefined);
