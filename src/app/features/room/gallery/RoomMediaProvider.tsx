import { ReactNode, createContext, useContext } from 'react';
import { Room } from 'matrix-js-sdk';
import { RoomMedia, useRoomMedia } from '../../../hooks/useRoomMedia';

const RoomMediaContext = createContext<RoomMedia | undefined>(undefined);

type RoomMediaProviderProps = {
  room: Room;
  /**
   * Start (and keep) scanning. False costs nothing: the scan is what walks the
   * room's history, and nobody should pay for that just by opening a room.
   */
  enabled: boolean;
  children: ReactNode;
};

/**
 * One media scan per room view, shared by the gallery grid and the feed.
 *
 * They are separate components that can be on screen at the same time — the
 * feed opens over the grid — and each needs the same list. Without this they
 * would run two independent scans of the same history, paginating the same
 * timeline twice.
 */
export function RoomMediaProvider({ room, enabled, children }: RoomMediaProviderProps) {
  // Already memoised by the hook, so this is a stable context value.
  const media = useRoomMedia(room, enabled);

  return <RoomMediaContext.Provider value={media}>{children}</RoomMediaContext.Provider>;
}

export const useRoomMediaContext = (): RoomMedia => {
  const media = useContext(RoomMediaContext);
  if (!media) throw new Error('Room media is not provided!');
  return media;
};
