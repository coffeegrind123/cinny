import { useCallback } from 'react';
import { Room } from 'matrix-js-sdk';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MediaFeed } from './MediaFeed';
import { useRoomMediaContext } from './RoomMediaProvider';
import { mediaFeedRequestAtom, roomGalleryOpenAtom } from '../../../state/roomGallery';
import { MediaItem } from '../../../hooks/useRoomMedia';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';

/**
 * Mounts the feed when something asks for it.
 *
 * The ask comes from three places — a photo tapped in the timeline, a gallery
 * tile, the button on a video — and lands in one atom, so this is the only
 * component that has to know how to open a feed.
 */
export function MediaFeedHost({ room }: { room: Room }) {
  const media = useRoomMediaContext();
  const [request, setRequest] = useAtom(mediaFeedRequestAtom);
  const galleryOpen = useAtomValue(roomGalleryOpenAtom);
  const setGalleryOpen = useSetAtom(roomGalleryOpenAtom);
  const { navigateRoom } = useRoomNavigate();

  const requestClose = useCallback(() => setRequest(undefined), [setRequest]);

  const handleJump = useCallback(
    (item: MediaItem) => {
      setRequest(undefined);
      setGalleryOpen(false);
      navigateRoom(item.roomId, item.eventId);
    },
    [setRequest, setGalleryOpen, navigateRoom],
  );

  const handleOpenGallery = useCallback(() => {
    setRequest(undefined);
    setGalleryOpen(true);
  }, [setRequest, setGalleryOpen]);

  if (!request || request.roomId !== room.roomId) return null;

  return (
    <MediaFeed
      room={room}
      items={media.items}
      initialEventId={request.eventId}
      loading={media.loading}
      hasMore={media.hasMore}
      loadMore={media.loadMore}
      requestClose={requestClose}
      onOpenGallery={galleryOpen ? undefined : handleOpenGallery}
      onJump={handleJump}
    />
  );
}
