import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EventTimeline,
  EventTimelineSetHandlerMap,
  MatrixEvent,
  MsgType,
  Room,
  RoomEvent,
  RoomEventHandlerMap,
} from 'matrix-js-sdk';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useMatrixClient } from './useMatrixClient';
import { MessageEvent } from '../../types/matrix/room';
import {
  IEncryptedFile,
  IImageInfo,
  IThumbnailContent,
  IVideoInfo,
  MATRIX_BLUR_HASH_PROPERTY_NAME,
  MATRIX_GIF_PROPERTY_NAME,
  MATRIX_SPOILER_PROPERTY_NAME,
  MATRIX_SPOILER_REASON_PROPERTY_NAME,
} from '../../types/matrix/common';
import { getBlobSafeMimeType, getImageSafeMimeType } from '../utils/mimeTypes';
import { validBlurHash } from '../utils/blurHash';

/**
 * The parts of `m.image` / `m.video` content this reads.
 *
 * Written out rather than using `IImageContent | IVideoContent`, because the
 * two disagree on `msgtype` and on the shape of `info` — narrowing them apart
 * before knowing which one it is puts the check the wrong way round.
 */
type MediaMessageContent = {
  msgtype?: string;
  body?: string;
  filename?: string;
  url?: string;
  info?: IImageInfo & IVideoInfo & IThumbnailContent;
  file?: IEncryptedFile;
  [MATRIX_GIF_PROPERTY_NAME]?: boolean;
  [MATRIX_SPOILER_PROPERTY_NAME]?: boolean;
  [MATRIX_SPOILER_REASON_PROPERTY_NAME]?: string;
};

export type MediaItemType = 'image' | 'video';

export type MediaItem = {
  eventId: string;
  roomId: string;
  sender: string;
  ts: number;
  type: MediaItemType;
  /** What the attachment is called — used for the download and as alt text. */
  filename: string;
  /**
   * The sender's own words about the attachment, when they wrote any.
   *
   * A plain attachment repeats its filename in `body`, and captioning it
   * (MSC2530) is what moves the filename into `filename` and leaves `body` as
   * prose. So a caption exists only when the two differ — the same test
   * RenderMessageContent uses to decide whether to render one.
   */
  caption?: string;
  mxcUrl: string;
  mimeType: string;
  encInfo?: EncryptedAttachmentInfo;
  width?: number;
  height?: number;
  size?: number;
  /** Video length in milliseconds, when the sender reported one. */
  duration?: number;
  blurHash?: string;
  /** The sender-supplied still, if there is one. Required for encrypted video. */
  thumbnail?: IThumbnailContent;
  gif: boolean;
  spoiler: boolean;
  spoilerReason?: string;
};

/**
 * Read an image or video attachment out of a timeline event.
 *
 * Returns undefined for everything that is not one — including redacted
 * events, stickers (which are furniture, not attachments anybody goes looking
 * for) and videos whose declared mimetype is not actually a video, which is the
 * same case MVideo hands off to the file renderer.
 */
export const mediaItemFromEvent = (mEvent: MatrixEvent): MediaItem | undefined => {
  if (mEvent.isRedacted()) return undefined;
  if (mEvent.getType() !== MessageEvent.RoomMessage) return undefined;

  const eventId = mEvent.getId();
  const roomId = mEvent.getRoomId();
  if (!eventId || !roomId) return undefined;

  const content = mEvent.getContent<MediaMessageContent>();
  let type: MediaItemType;
  if (content.msgtype === MsgType.Image) type = 'image';
  else if (content.msgtype === MsgType.Video) type = 'video';
  else return undefined;

  const mxcUrl = content.file?.url ?? content.url;
  if (typeof mxcUrl !== 'string') return undefined;

  const info = content.info;
  const mimeType =
    type === 'image'
      ? getImageSafeMimeType(info?.mimetype)
      : getBlobSafeMimeType(info?.mimetype ?? '');
  // A video the browser will refuse to play is a file, not gallery media.
  if (type === 'video' && !mimeType.startsWith('video')) return undefined;

  const body = typeof content.body === 'string' ? content.body : '';
  const filename = content.filename || body || (type === 'image' ? 'Image' : 'Video');
  const caption = content.filename && content.filename !== body ? body : undefined;

  return {
    eventId,
    roomId,
    sender: mEvent.getSender() ?? '',
    ts: mEvent.getTs(),
    type,
    filename,
    caption: caption || undefined,
    mxcUrl,
    mimeType,
    encInfo: content.file,
    width: typeof info?.w === 'number' ? info.w : undefined,
    height: typeof info?.h === 'number' ? info.h : undefined,
    size: typeof info?.size === 'number' ? info.size : undefined,
    duration: typeof info?.duration === 'number' ? info.duration : undefined,
    blurHash:
      validBlurHash(info?.[MATRIX_BLUR_HASH_PROPERTY_NAME]) ??
      validBlurHash(info?.thumbnail_info?.[MATRIX_BLUR_HASH_PROPERTY_NAME]),
    thumbnail:
      info?.thumbnail_file || info?.thumbnail_url
        ? {
            thumbnail_file: info.thumbnail_file,
            thumbnail_url: info.thumbnail_url,
            thumbnail_info: info.thumbnail_info,
          }
        : undefined,
    gif: content[MATRIX_GIF_PROPERTY_NAME] === true,
    spoiler: content[MATRIX_SPOILER_PROPERTY_NAME] === true,
    spoilerReason: content[MATRIX_SPOILER_REASON_PROPERTY_NAME],
  };
};

export type RoomMedia = {
  /** Every image and video found so far, newest first. */
  items: MediaItem[];
  /** A scan is in flight. */
  loading: boolean;
  /** Older history remains to be walked. */
  hasMore: boolean;
  /** Walk further back. A no-op while a scan is running, or once exhausted. */
  loadMore: () => void;
  /** Timeline events examined so far — the denominator for "found 4 of 900". */
  scanned: number;
  /** Set when the whole scan has produced nothing yet and is still working. */
  started: boolean;
};

type MediaCursor = {
  roomId: string;
  timeline: EventTimeline;
  seen: Set<string>;
  items: MediaItem[];
  scanned: number;
  exhausted: boolean;
};

/** Events fetched per `/messages` round trip while hunting for attachments. */
const PAGINATION_LIMIT = 80;
/** Round trips one `loadMore()` will spend before handing control back. */
const MAX_PAGINATIONS_PER_LOAD = 6;
/** New attachments that satisfy a `loadMore()` — roughly two grid screens. */
const TARGET_NEW_ITEMS = 24;

const sortNewestFirst = (items: MediaItem[]): MediaItem[] => [...items].sort((a, b) => b.ts - a.ts);

/**
 * Every image and video in a room, newest first, gathered by walking its
 * timeline backwards.
 *
 * Deliberately a client-side scan rather than a server-side `contains_url`
 * filter. That filter is the obvious implementation and it is wrong here: it
 * matches on a `url` field in the *cleartext* content, and an encrypted room
 * has none — so the fast path would return an empty gallery in exactly the
 * rooms this client is usually used in, and would do it silently. The scan
 * costs `/messages` round trips instead, decrypts what it walks, and returns
 * the same answer everywhere. It is the same trade `useClientRoomSearch`
 * already makes for search.
 *
 * `enabled` gates the whole thing so a room view costs nothing until the
 * gallery or the feed is actually opened. Once enabled, what has been found is
 * kept even if it is disabled again — closing and reopening the gallery should
 * not re-walk the room.
 */
export const useRoomMedia = (room: Room, enabled: boolean): RoomMedia => {
  const mx = useMatrixClient();

  const cursorRef = useRef<MediaCursor | undefined>(undefined);
  const runningRef = useRef(false);
  const aliveRef = useRef(true);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const getCursor = useCallback((): MediaCursor => {
    const cursor = cursorRef.current;
    if (cursor && cursor.roomId === room.roomId) {
      // A limited sync detaches the timeline we were paginating and starts a
      // fresh one. Pick that up rather than paginating a token that no longer
      // leads anywhere; `seen` keeps the re-walk from duplicating anything.
      const live = room.getLiveTimeline();
      if (cursor.timeline !== live) {
        cursor.timeline = live;
        cursor.exhausted = false;
      }
      return cursor;
    }
    const fresh: MediaCursor = {
      roomId: room.roomId,
      timeline: room.getLiveTimeline(),
      seen: new Set<string>(),
      items: [],
      scanned: 0,
      exhausted: false,
    };
    cursorRef.current = fresh;
    return fresh;
  }, [room]);

  /** Fold everything currently in the timeline into the cursor. */
  const scanLoaded = useCallback(
    async (cursor: MediaCursor): Promise<number> => {
      const events = cursor.timeline.getEvents();
      const fresh: MatrixEvent[] = [];
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const mEvent = events[i];
        const id = mEvent.getId();
        if (id && !cursor.seen.has(id)) {
          cursor.seen.add(id);
          cursor.scanned += 1;
          fresh.push(mEvent);
        }
      }

      // Decrypt in parallel — serialising this is what made the equivalent
      // scan in search feel slow. Already-decrypted events report their clear
      // type and are skipped.
      await Promise.all(
        fresh.map((mEvent) =>
          mEvent.isEncrypted() &&
          mEvent.getType() === MessageEvent.RoomMessageEncrypted &&
          !mEvent.isDecryptionFailure()
            ? mx.decryptEventIfNeeded(mEvent).catch(() => undefined)
            : undefined,
        ),
      );

      let added = 0;
      fresh.forEach((mEvent) => {
        const item = mediaItemFromEvent(mEvent);
        if (item) {
          cursor.items.push(item);
          added += 1;
        }
      });
      if (added > 0) cursor.items = sortNewestFirst(cursor.items);
      return added;
    },
    [mx],
  );

  const publish = useCallback((cursor: MediaCursor) => {
    if (!aliveRef.current) return;
    setItems([...cursor.items]);
    setScanned(cursor.scanned);
    setExhausted(cursor.exhausted);
  }, []);

  const loadMore = useCallback(() => {
    if (runningRef.current) return;
    const cursor = getCursor();
    if (cursor.exhausted) return;

    runningRef.current = true;
    setLoading(true);
    setStarted(true);

    (async () => {
      let added = await scanLoaded(cursor);
      publish(cursor);

      let paginations = 0;
      while (
        aliveRef.current &&
        added < TARGET_NEW_ITEMS &&
        !cursor.exhausted &&
        paginations < MAX_PAGINATIONS_PER_LOAD
      ) {
        const token = cursor.timeline.getPaginationToken(EventTimeline.BACKWARDS);
        if (!token) {
          cursor.exhausted = true;
          break;
        }
        paginations += 1;
        let ok = false;
        try {
          ok = await mx.paginateEventTimeline(cursor.timeline, {
            backwards: true,
            limit: PAGINATION_LIMIT,
          });
        } catch {
          // A homeserver that will not serve older history leaves us with what
          // we have, which is still a usable gallery.
          ok = false;
        }
        if (!ok) {
          cursor.exhausted = true;
          break;
        }
        added += await scanLoaded(cursor);
        publish(cursor);
      }

      publish(cursor);
      runningRef.current = false;
      if (aliveRef.current) setLoading(false);
    })();
  }, [getCursor, mx, publish, scanLoaded]);

  // First scan when the gallery (or feed) is opened.
  useEffect(() => {
    if (!enabled) return;
    const cursor = getCursor();
    if (cursor.items.length === 0 && cursor.scanned === 0) {
      loadMore();
      return;
    }
    // Re-opened: show what was already found without re-walking.
    publish(cursor);
    setStarted(true);
  }, [enabled, getCursor, loadMore, publish]);

  // Attachments sent while the gallery is open belong at the top of it, and a
  // redaction has to take one back out — a deleted photo that stays in the grid
  // is worse than one that was never listed.
  useEffect(() => {
    if (!enabled) return undefined;

    const addLive = async (mEvent: MatrixEvent) => {
      const cursor = getCursor();
      const id = mEvent.getId();
      if (!id) return;
      if (
        mEvent.isEncrypted() &&
        mEvent.getType() === MessageEvent.RoomMessageEncrypted &&
        !mEvent.isDecryptionFailure()
      ) {
        await mx.decryptEventIfNeeded(mEvent).catch(() => undefined);
      }
      const item = mediaItemFromEvent(mEvent);
      if (!item) return;
      if (!cursor.seen.has(id)) {
        cursor.seen.add(id);
        cursor.scanned += 1;
      }
      if (cursor.items.some((existing) => existing.eventId === id)) return;
      cursor.items = sortNewestFirst([item, ...cursor.items]);
      publish(cursor);
    };

    const handleTimeline: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      toStartOfTimeline,
      removed,
      data,
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      addLive(mEvent);
    };

    const handleRedaction: RoomEventHandlerMap[RoomEvent.Redaction] = (mEvent, eventRoom) => {
      if (eventRoom?.roomId !== room.roomId) return;
      const targetId = mEvent.getAssociatedId();
      if (!targetId) return;
      const cursor = getCursor();
      const next = cursor.items.filter((item) => item.eventId !== targetId);
      if (next.length === cursor.items.length) return;
      cursor.items = next;
      publish(cursor);
    };

    room.on(RoomEvent.Timeline, handleTimeline);
    room.on(RoomEvent.Redaction, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimeline);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
    };
  }, [enabled, room, mx, getCursor, publish]);

  return useMemo(
    () => ({
      items,
      loading,
      hasMore: !exhausted,
      loadMore,
      scanned,
      started,
    }),
    [items, loading, exhausted, loadMore, scanned, started],
  );
};
