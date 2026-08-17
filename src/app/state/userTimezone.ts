import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

/**
 * A user's MSC4175 time zone, shared across every component that asks for it.
 *
 * Three states, and they are not the same:
 * - `undefined` — never looked up. The fetch is still to come.
 * - `null` — looked up, and they have not set one. Do not ask again.
 * - a string — their zone.
 *
 * Collapsing "not asked" into "hasn't got one" would make every hover re-issue
 * a profile request for a user who will never have an answer, which on a busy
 * timeline is a request per pointer movement.
 */
const createUserTimezoneAtom = () => atom<string | null | undefined>(undefined);

export const userTimezoneAtomFamily = atomFamily<string, ReturnType<typeof createUserTimezoneAtom>>(
  () => createUserTimezoneAtom(),
);
