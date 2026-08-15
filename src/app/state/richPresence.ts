import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { RichPresence } from '../../types/matrix/richPresence';

// Shared per-user rich-presence state. All components that call
// useUserRichPresence for the same userId read from and write to the same
// atom, so a re-fetch in one (heartbeat, song-end, push update) immediately
// propagates to every other mounted consumer.
const createRichPresenceAtom = () => atom<RichPresence | undefined>(undefined);

export const userRichPresenceAtomFamily = atomFamily<
  string,
  ReturnType<typeof createRichPresenceAtom>
>(() => createRichPresenceAtom());
