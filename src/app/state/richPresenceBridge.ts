import { atom } from 'jotai';

// Reflects the Discord-IPC bridge lifecycle for the settings UI. Set by the
// publisher hook (src/app/hooks/useRichPresencePublisher.ts); read by the
// account settings tile. `index` is the discord-ipc slot we bound: 0 means we
// hold the slot clients try first; >0 means a lower-slot server (Discord or
// arRPC) is live and will receive activity before us.
export type RichPresenceBridgeStatus =
  | { state: 'starting' }
  | { state: 'running'; path: string; index: number }
  | { state: 'error'; error: string }
  | { state: 'stopped' };

export const richPresenceBridgeStatusAtom = atom<RichPresenceBridgeStatus | undefined>(undefined);
