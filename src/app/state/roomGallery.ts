import { atom } from 'jotai';

/**
 * Whether the room view is showing its media gallery instead of the timeline.
 *
 * Ephemeral, like `roomSearchOpenAtom` — a gallery belongs to the room you
 * opened it in, so switching rooms puts you back in the conversation.
 */
export const roomGalleryOpenAtom = atom<boolean>(false);

export type MediaFeedRequest = {
  roomId: string;
  /** The attachment the feed opens on. The rest of the room's media surrounds it. */
  eventId: string;
};

/**
 * A request to open the full-screen media feed at one attachment.
 *
 * An atom rather than a callback passed down through the message renderers:
 * the request is raised from inside a timeline message (a tap on a photo), from
 * a gallery tile, and from the video overlay button, and all three are many
 * levels below the room view that actually mounts the feed. Only one feed is
 * ever open, so a single atom is the whole state.
 */
export const mediaFeedRequestAtom = atom<MediaFeedRequest | undefined>(undefined);
