import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
} from 'folds';
import { useSetAtom } from 'jotai';
import { MediaItem } from '../../../hooks/useRoomMedia';
import { useRoomMediaContext } from './RoomMediaProvider';
import { useMediaThumbnail } from './useMediaThumbnail';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { mxcUrlToHttp } from '../../../utils/matrix';
import { millisecondsToMinutesAndSeconds } from '../../../utils/common';
import { inSameDay, timeDayMonthYear, today, yesterday } from '../../../utils/time';
import { BlurhashCanvas } from '../../../components/BlurhashCanvas';
import { mediaFeedRequestAtom, roomGalleryOpenAtom } from '../../../state/roomGallery';
import * as css from './RoomGallery.css';

type MediaFilter = 'all' | 'image' | 'video';

/** Rounds of history a filter with no matches will dig through on its own. */
const AUTO_DIG_ROUNDS = 3;

type GalleryTileProps = {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
};

function GalleryTile({ item, onOpen }: GalleryTileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const tileRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  // Tiles fetch nothing until they are close to the viewport. In an encrypted
  // room every still costs a download and a decrypt, so a screenful of tiles
  // must not mean a whole room's worth of them.
  useEffect(() => {
    const el = tileRef.current;
    if (!el || visible) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const thumbnail = useMediaThumbnail(item, visible);

  // An unencrypted video with no sender thumbnail still has a first frame, and
  // `preload="metadata"` is enough to draw it without fetching the file.
  const videoPosterUrl =
    !thumbnail.src && item.type === 'video' && !item.encInfo && visible
      ? (mxcUrlToHttp(mx, item.mxcUrl, useAuthentication) ?? undefined)
      : undefined;

  const duration =
    item.type === 'video' && typeof item.duration === 'number' && item.duration > 0
      ? millisecondsToMinutesAndSeconds(item.duration)
      : undefined;

  const label = `${item.type === 'video' ? 'Video' : 'Photo'}: ${item.filename}`;

  return (
    <button
      type="button"
      className={css.GalleryTile}
      ref={tileRef}
      onClick={() => onOpen(item)}
      aria-label={label}
      title={item.caption || item.filename}
    >
      {typeof item.blurHash === 'string' && !thumbnail.src && (
        <BlurhashCanvas
          style={{ width: '100%', height: '100%' }}
          width={32}
          height={32}
          hash={item.blurHash}
          punch={1}
        />
      )}
      {thumbnail.src && (
        <img
          className={`${css.GalleryTileMedia}${item.spoiler ? ` ${css.GalleryTileBlur}` : ''}`}
          src={thumbnail.src}
          alt={item.filename}
          loading="lazy"
          draggable={false}
        />
      )}
      {!thumbnail.src && videoPosterUrl && (
        <video
          className={`${css.GalleryTileMedia}${item.spoiler ? ` ${css.GalleryTileBlur}` : ''}`}
          src={videoPosterUrl}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
        />
      )}
      {!thumbnail.src && !videoPosterUrl && thumbnail.loading && (
        <Box className={css.GalleryTileCenter}>
          <Spinner variant="Secondary" size="300" />
        </Box>
      )}
      {item.type === 'video' && (
        <Box className={css.GalleryTileCenter}>
          <Icon size="400" src={Icons.Play} filled style={{ color: 'white', opacity: 0.9 }} />
        </Box>
      )}
      {item.spoiler && (
        <Box className={css.GalleryTileCenter}>
          <span className={css.GalleryTilePill}>
            <Icon size="50" src={Icons.EyeBlind} />
            <Text as="span" size="L400">
              Spoiler
            </Text>
          </span>
        </Box>
      )}
      {item.gif && (
        <Box className={css.GalleryTileHeader}>
          <span className={css.GalleryTilePill}>
            <Text as="span" size="L400">
              GIF
            </Text>
          </span>
        </Box>
      )}
      {duration && (
        <Box className={css.GalleryTileFooter} justifyContent="End">
          <span className={css.GalleryTilePill}>
            <Text as="span" size="L400">
              {duration}
            </Text>
          </span>
        </Box>
      )}
    </button>
  );
}

const dayLabel = (ts: number): string => {
  if (today(ts)) return 'Today';
  if (yesterday(ts)) return 'Yesterday';
  return timeDayMonthYear(ts);
};

type DayGroup = {
  ts: number;
  items: MediaItem[];
};

const groupByDay = (items: MediaItem[]): DayGroup[] => {
  const groups: DayGroup[] = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && inSameDay(last.ts, item.ts)) {
      last.items.push(item);
      return;
    }
    groups.push({ ts: item.ts, items: [item] });
  });
  return groups;
};

/**
 * The conversation as a wall of its own photos and videos, newest first.
 *
 * Takes the place of the timeline rather than opening over it: "turn this
 * conversation into a gallery" is a mode, not a dialog, and the composer stays
 * where it is underneath so the room is still a room while you are in it.
 *
 * Grouped by day, because the question people actually arrive with is "that
 * photo from Tuesday", and because it gives the scan something to show the
 * moment the first page of history lands rather than after all of it does.
 */
export function RoomGallery() {
  const media = useRoomMediaContext();
  const setGalleryOpen = useSetAtom(roomGalleryOpenAtom);
  const setFeedRequest = useSetAtom(mediaFeedRequestAtom);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { items, loading, hasMore, loadMore, scanned } = media;

  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((item) => item.type === 'image').length,
      video: items.filter((item) => item.type === 'video').length,
    }),
    [items],
  );

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.type === filter)),
    [items, filter],
  );

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  // Walk further back as the bottom of the grid comes into view. The sentinel
  // sits inside the scroller, so this is the grid's own end rather than the
  // window's.
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: root ?? null, rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, filtered.length]);

  // A filter that hides everything found so far is not an answer — keep
  // reading history until it has something to show. Bounded, because "no
  // videos in this room" is a perfectly ordinary answer and chasing it to the
  // start of a years-old room is not something to do behind the user's back:
  // after a few rounds the "Load older media" button takes over.
  const autoDigRef = useRef(0);
  useEffect(() => {
    autoDigRef.current = 0;
  }, [filter]);
  useEffect(() => {
    if (filter === 'all') return;
    if (filtered.length > 0 || !hasMore || loading) return;
    if (autoDigRef.current >= AUTO_DIG_ROUNDS) return;
    autoDigRef.current += 1;
    loadMore();
  }, [filter, filtered.length, hasMore, loading, loadMore]);

  const openItem = useCallback(
    (item: MediaItem) => {
      setFeedRequest({ roomId: item.roomId, eventId: item.eventId });
    },
    [setFeedRequest],
  );

  const filterChip = (value: MediaFilter, label: string, count: number) => (
    <Chip
      variant={filter === value ? 'Primary' : 'SurfaceVariant'}
      fill="Soft"
      radii="Pill"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
    >
      <Text size="B300">{`${label}${count > 0 ? ` · ${count}` : ''}`}</Text>
    </Chip>
  );

  return (
    <Box grow="Yes" direction="Column">
      <Box className={css.GalleryBar} shrink="No" direction="Column" gap="200">
        <Box alignItems="Center" gap="200">
          <Icon size="100" src={Icons.Photo} />
          <Text size="H4">Gallery</Text>
          <Box grow="Yes" />
          {loading && <Spinner variant="Secondary" size="100" />}
          <TooltipProvider
            position="Bottom"
            align="End"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Back to conversation</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                size="300"
                radii="300"
                ref={triggerRef}
                onClick={() => setGalleryOpen(false)}
                aria-label="Back to conversation"
              >
                <Icon size="100" src={Icons.Cross} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
        <Box alignItems="Center" gap="200" wrap="Wrap">
          {filterChip('all', 'All', counts.all)}
          {filterChip('image', 'Photos', counts.image)}
          {filterChip('video', 'Videos', counts.video)}
        </Box>
      </Box>

      <Box grow="Yes">
        <Scroll ref={scrollRef} size="300" hideTrack visibility="Hover">
          <Box className={css.GalleryContent} direction="Column" gap="400">
            {groups.map((group) => (
              <Box key={group.ts} direction="Column" gap="200">
                <Box className={css.GalleryDateHeader}>
                  <Text size="L400" priority="300">
                    {dayLabel(group.ts)}
                  </Text>
                </Box>
                <div className={css.GalleryGrid}>
                  {group.items.map((item) => (
                    <GalleryTile key={item.eventId} item={item} onOpen={openItem} />
                  ))}
                </div>
              </Box>
            ))}

            {filtered.length === 0 && (
              <Box
                direction="Column"
                alignItems="Center"
                justifyContent="Center"
                gap="300"
                style={{ padding: config.space.S700 }}
              >
                {loading ? (
                  <>
                    <Spinner variant="Secondary" size="400" />
                    <Text size="T300" priority="300">
                      {`Reading back through the conversation… ${scanned} messages so far.`}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon size="600" src={Icons.Photo} />
                    <Text size="T300" priority="300" align="Center">
                      {hasMore
                        ? 'Nothing here yet in the part of the conversation that has been read.'
                        : 'No photos or videos have been sent in this conversation.'}
                    </Text>
                    {hasMore && (
                      <Chip variant="Primary" radii="Pill" onClick={loadMore}>
                        <Text size="B300">Look further back</Text>
                      </Chip>
                    )}
                  </>
                )}
              </Box>
            )}

            <Box
              className={css.GallerySentinel}
              direction="Column"
              alignItems="Center"
              justifyContent="Center"
              gap="200"
            >
              <div ref={sentinelRef} />
              {filtered.length > 0 && loading && <Spinner variant="Secondary" size="300" />}
              {filtered.length > 0 && !loading && hasMore && (
                <Chip variant="SurfaceVariant" radii="Pill" outlined onClick={loadMore}>
                  <Text size="B300">Load older media</Text>
                </Chip>
              )}
              {filtered.length > 0 && !hasMore && !loading && (
                <Badge variant="Secondary" fill="Soft" radii="Pill">
                  <Text size="L400">
                    {`${counts.all} attachment${counts.all === 1 ? '' : 's'} · that is everything`}
                  </Text>
                </Badge>
              )}
            </Box>
          </Box>
        </Scroll>
      </Box>
    </Box>
  );
}
