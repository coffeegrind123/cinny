import { atom } from 'jotai';

/**
 * Pinned-banner dismissals, keyed by room id and holding the event id that was
 * dismissed.
 *
 * Deliberately in memory only, and keyed by event rather than by room: a
 * dismissal means "I have seen this pin", so pinning something new must bring
 * the banner back. Persisting it would mean a pin made while you were away
 * could stay hidden forever, which is the opposite of what pinning is for.
 */
export const dismissedPinBannerAtom = atom<Record<string, string>>({});
