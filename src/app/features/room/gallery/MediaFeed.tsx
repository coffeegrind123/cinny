import {
  MouseEventHandler,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { Room } from 'matrix-js-sdk';
import { MediaItem } from '../../../hooks/useRoomMedia';
import { useMediaSrc } from '../../../hooks/useMediaSrc';
import { useMediaDownload } from '../../../hooks/useMediaDownload';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useMediaThumbnail } from './useMediaThumbnail';
import { useMediaReaction } from './useMediaReaction';
import { AsyncStatus } from '../../../hooks/useAsyncCallback';
import { BlurhashCanvas } from '../../../components/BlurhashCanvas';
import { UserAvatar } from '../../../components/user-avatar';
import { ImageViewer } from '../../../components/image-viewer';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { bytesToSize, nameInitials } from '../../../utils/common';
import { timeDayMonthYear, timeHourMinute } from '../../../utils/time';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import { useKeyDown } from '../../../hooks/useKeyDown';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import * as css from './MediaFeed.css';

/** Pages either side of the active one that get real media elements. */
const WINDOW = 1;
/** Distance from the end of the list at which more history is fetched. */
const LOAD_MORE_DISTANCE = 3;

type FeedContentProps = {
  room: Room;
  item: MediaItem;
  active: boolean;
  muted: boolean;
  hour24Clock: boolean;
  onJump: (item: MediaItem) => void;
};

/**
 * One attachment, filling the stage, with everything that acts on it.
 *
 * Mounted only for the active page and its immediate neighbours — every hook
 * in here fetches something (the media, its thumbnail, its reactions), so
 * mounting it for a hundred pages would be a hundred downloads.
 */
function MediaFeedContent({ room, item, active, muted, hour24Clock, onJump }: FeedContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;

  const { src, state, needsBlob, onSrcError } = useMediaSrc(
    item.mxcUrl,
    item.mimeType,
    item.encInfo,
    item.filename,
  );
  const thumbnail = useMediaThumbnail(item, true);
  const reaction = useMediaReaction(room, item.eventId);
  const download = useMediaDownload(item.filename, item.mxcUrl, item.mimeType, item.encInfo);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(!item.spoiler);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [playbackRefused, setPlaybackRefused] = useState(false);
  // A plain image gets its URL immediately and then spends real time fetching
  // the pixels behind it, so `src` alone is not "ready" — without this the
  // blurhash disappears the moment the URL resolves and leaves a blank stage.
  const [imageLoaded, setImageLoaded] = useState(false);

  const isVideo = item.type === 'video';
  const loading = isVideo
    ? needsBlob && state.status !== AsyncStatus.Success
    : !src || !imageLoaded;
  const failed = state.status === AsyncStatus.Error;

  const senderName =
    getMemberDisplayName(room, item.sender) ?? getMxIdLocalPart(item.sender) ?? item.sender;
  const senderAvatarMxc = getMemberAvatarMxc(room, item.sender);
  const senderAvatarUrl = senderAvatarMxc
    ? (mxcUrlToHttp(mx, senderAvatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined)
    : undefined;

  // A page that scrolls away stops playing and rewinds, so coming back to it
  // starts the clip again rather than resuming a video the user left behind.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (active && !userPaused && revealed) {
      video.play().catch(() => setPlaybackRefused(true));
      return;
    }
    video.pause();
    if (!active) {
      video.currentTime = 0;
      setProgress(0);
      setUserPaused(false);
    }
  }, [active, userPaused, revealed, src]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration || Number.isNaN(video.duration)) return;
    setProgress(video.currentTime / video.duration);
  };

  const seekTo = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !video.duration || Number.isNaN(video.duration)) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    video.currentTime = clamped * video.duration;
    setProgress(clamped);
  }, []);

  const seekFromPointer = (evt: ReactPointerEvent<HTMLDivElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    seekTo((evt.clientX - rect.left) / rect.width);
  };

  const handleSeekDown: PointerEventHandler<HTMLDivElement> = (evt) => {
    evt.currentTarget.setPointerCapture(evt.pointerId);
    seekFromPointer(evt);
  };
  const handleSeekMove: PointerEventHandler<HTMLDivElement> = (evt) => {
    if (!evt.currentTarget.hasPointerCapture(evt.pointerId)) return;
    seekFromPointer(evt);
  };

  // Tapping the stage pauses a video, the way it does in any short-video feed.
  // On a still there is nothing to pause, so the tap expands the caption
  // instead of doing nothing.
  const handleStageClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    if (isVideo) {
      setUserPaused((paused) => !paused);
      setPlaybackRefused(false);
      return;
    }
    setExpandedCaption((expanded) => !expanded);
  };

  const paused = isVideo && (userPaused || playbackRefused);
  const blurred = !revealed;
  let stageActionLabel = 'Show details';
  if (blurred) stageActionLabel = 'Reveal spoiler';
  else if (isVideo) stageActionLabel = 'Play or pause';

  const dimensions = item.width && item.height ? `${item.width}×${item.height}` : undefined;
  const meta = [
    `${timeDayMonthYear(item.ts)} ${timeHourMinute(item.ts, hour24Clock)}`,
    dimensions,
    typeof item.size === 'number' ? bytesToSize(item.size) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* A blurred copy of the still behind the media, so a portrait photo on a
          landscape window is framed rather than floating in flat black. */}
      {thumbnail.src && !blurred && (
        <img className={css.FeedBackdrop} src={thumbnail.src} alt="" aria-hidden />
      )}
      {typeof item.blurHash === 'string' && loading && (
        <BlurhashCanvas
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          width={32}
          height={32}
          hash={item.blurHash}
          punch={1}
        />
      )}

      {src && isVideo && (
        <video
          className={css.FeedMedia}
          ref={videoRef}
          src={src}
          poster={thumbnail.src}
          title={item.filename}
          style={blurred ? { filter: 'blur(44px)' } : undefined}
          loop
          muted={muted}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onError={onSrcError}
        />
      )}
      {src && !isVideo && (
        <img
          className={css.FeedMedia}
          src={src}
          alt={item.filename}
          style={blurred ? { filter: 'blur(44px)' } : undefined}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
        />
      )}

      {loading && !failed && (
        <Box className={css.FeedCenterBadge}>
          <Spinner variant="Secondary" size="400" />
        </Box>
      )}
      {failed && (
        <Box className={css.FeedCenterBadge}>
          <Box className={css.FeedBarGroup} style={{ pointerEvents: 'auto' }}>
            <Icon size="100" src={Icons.Warning} />
            <Text size="T300">Failed to load this attachment.</Text>
          </Box>
        </Box>
      )}

      <button
        type="button"
        className={css.FeedTapTarget}
        onClick={handleStageClick}
        aria-label={stageActionLabel}
      />

      {blurred && (
        <Box className={css.FeedCenterBadge}>
          <Chip
            style={{ pointerEvents: 'auto' }}
            variant="Secondary"
            radii="Pill"
            size="500"
            outlined
            onClick={() => setRevealed(true)}
          >
            <Text size="B300">{item.spoilerReason || 'Spoiler'}</Text>
          </Chip>
        </Box>
      )}
      {paused && revealed && !loading && (
        <Box className={css.FeedCenterBadge}>
          <Box className={css.FeedCenterBadgeInner}>
            <Icon size="600" src={Icons.Play} filled />
          </Box>
        </Box>
      )}

      <Box className={css.FeedScrimTop} />
      <Box className={css.FeedScrimBottom} />

      <Box className={css.FeedInfo} direction="Column" gap="100">
        <Box alignItems="Center" gap="200">
          <Avatar size="200">
            <UserAvatar
              userId={item.sender}
              src={senderAvatarUrl}
              alt={senderName}
              renderFallback={() => <Text size="H6">{nameInitials(senderName)}</Text>}
            />
          </Avatar>
          <Text size="H5" truncate>
            {senderName}
          </Text>
        </Box>
        {item.caption && (
          <Text className={expandedCaption ? css.FeedCaptionExpanded : css.FeedCaption} size="T300">
            {item.caption}
          </Text>
        )}
        <Text size="T200" style={{ opacity: 0.8 }} truncate>
          {item.filename}
        </Text>
        <Text size="T200" style={{ opacity: 0.7 }} truncate>
          {meta}
        </Text>
      </Box>

      <Box className={css.FeedRail}>
        <button
          type="button"
          className={css.FeedRailButton}
          onClick={reaction.toggle}
          aria-pressed={reaction.reacted}
          aria-label={reaction.reacted ? 'Remove reaction' : 'React with a heart'}
        >
          <Icon size="400" src={Icons.Heart} filled={reaction.reacted} />
          <Text as="span" size="L400">
            {reaction.count > 0 ? reaction.count : 'Like'}
          </Text>
        </button>
        <button
          type="button"
          className={css.FeedRailButton}
          onClick={() => onJump(item)}
          aria-label="Go to this message in the conversation"
        >
          <Icon size="400" src={Icons.Message} />
          <Text as="span" size="L400">
            Message
          </Text>
        </button>
        <button
          type="button"
          className={css.FeedRailButton}
          onClick={download.download}
          disabled={download.downloading}
          aria-label={`Download ${download.downloadName}`}
        >
          {download.downloading ? (
            <Spinner variant="Secondary" size="300" />
          ) : (
            <Icon size="400" src={Icons.Download} filled={download.hasError} />
          )}
          <Text as="span" size="L400">
            Save
          </Text>
        </button>
        {!isVideo && src && (
          <button
            type="button"
            className={css.FeedRailButton}
            onClick={() => setZoomed(true)}
            aria-label="Zoom and pan this image"
          >
            <Icon size="400" src={Icons.Plus} />
            <Text as="span" size="L400">
              Zoom
            </Text>
          </button>
        )}
      </Box>

      {isVideo && src && !isMobile && (
        <Box
          className={css.FeedProgress}
          onPointerDown={handleSeekDown}
          onPointerMove={handleSeekMove}
        >
          <Box className={css.FeedProgressTrack}>
            <Box
              className={css.FeedProgressFill}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </Box>
        </Box>
      )}
      {isVideo && src && isMobile && (
        <Box className={css.FeedProgress} style={{ pointerEvents: 'none' }}>
          <Box className={css.FeedProgressTrack}>
            <Box
              className={css.FeedProgressFill}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </Box>
        </Box>
      )}

      {zoomed && src && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                onDeactivate: () => setZoomed(false),
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <ImageViewer alt={item.filename} src={src} requestClose={() => setZoomed(false)} />
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}
    </>
  );
}

export type MediaFeedProps = {
  room: Room;
  items: MediaItem[];
  /** The attachment to open on. Falls back to the newest one. */
  initialEventId?: string;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  requestClose: () => void;
  /** Offered as "Browse all" when the feed was opened from the timeline. */
  onOpenGallery?: () => void;
  onJump: (item: MediaItem) => void;
};

/**
 * Every image and video in the room as one full-screen, snap-scrolling feed.
 *
 * Vertical rather than the usual left/right lightbox because that is what the
 * gesture is on a phone, and because it makes a room's media browsable at the
 * speed you skim it: one flick per attachment, video playing on arrival,
 * nothing to press first.
 *
 * The list it walks is the room's whole media history — the same scan the
 * gallery grid uses — so opening the feed on a photo from the timeline and
 * flicking up keeps going back through the room, fetching older history as it
 * approaches the end.
 */
export function MediaFeed({
  room,
  items,
  initialEventId,
  loading,
  hasMore,
  loadMore,
  requestClose,
  onOpenGallery,
  onJump,
}: MediaFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIdRef = useRef<string | undefined>(initialEventId);
  const scrolledToInitial = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);

  const initialIndex = useMemo(() => {
    if (!initialEventId) return 0;
    const index = items.findIndex((item) => item.eventId === initialEventId);
    return index < 0 ? 0 : index;
  }, [items, initialEventId]);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el || el.clientHeight === 0) return false;
    el.scrollTo({ top: index * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' });
    return true;
  }, []);

  // Land on the attachment the feed was opened from. When it was opened from
  // the timeline the scan may still be running, so this keeps trying until the
  // event actually turns up in the list.
  useLayoutEffect(() => {
    if (scrolledToInitial.current) return;
    if (items.length === 0) return;
    if (initialEventId && !items.some((item) => item.eventId === initialEventId)) return;
    if (scrollToIndex(initialIndex, false)) {
      setActiveIndex(initialIndex);
      activeIdRef.current = items[initialIndex]?.eventId;
      scrolledToInitial.current = true;
    }
  }, [items, initialEventId, initialIndex, scrollToIndex]);

  // Older attachments append, but a newly sent one prepends and shifts every
  // index by one. Re-anchor on the attachment the user is actually looking at
  // rather than letting the page under them change.
  useEffect(() => {
    if (!scrolledToInitial.current) return;
    const el = scrollRef.current;
    const activeId = activeIdRef.current;
    if (!el || !activeId || el.clientHeight === 0) return;
    const index = items.findIndex((item) => item.eventId === activeId);
    if (index < 0) return;
    const expected = index * el.clientHeight;
    if (Math.abs(el.scrollTop - expected) > 4) {
      el.scrollTop = expected;
      setActiveIndex(index);
    }
  }, [items]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== undefined) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = undefined;
      const el = scrollRef.current;
      if (!el || el.clientHeight === 0) return;
      const index = Math.max(
        0,
        Math.min(items.length - 1, Math.round(el.scrollTop / el.clientHeight)),
      );
      setActiveIndex(index);
      activeIdRef.current = items[index]?.eventId;
      // Once the user has moved, the feed is theirs: an attachment the feed was
      // opened on but has not been found yet must not arrive from an older page
      // of history and pull them back to it.
      scrolledToInitial.current = true;
    });
  }, [items]);

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Fetch more history before the user reaches the end of what we have, so a
  // fast scroll does not run into a wall.
  useEffect(() => {
    if (!hasMore || loading) return;
    if (items.length === 0 || activeIndex >= items.length - LOAD_MORE_DISTANCE) {
      loadMore();
    }
  }, [activeIndex, items.length, hasMore, loading, loadMore]);

  const move = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(items.length - 1, activeIndex + delta));
      if (next === activeIndex) return;
      scrollToIndex(next, true);
    },
    [activeIndex, items.length, scrollToIndex],
  );

  useKeyDown(
    window,
    useCallback(
      (evt: KeyboardEvent) => {
        if (evt.altKey || evt.ctrlKey || evt.metaKey) return;
        const { key } = evt;
        // Space and Enter belong to whatever rail button has focus; stealing
        // Space for "next" would make the buttons unusable from the keyboard.
        const activeTag = document.activeElement?.tagName;
        const onControl = activeTag === 'BUTTON' || activeTag === 'INPUT';
        if (onControl && (key === ' ' || key === 'Enter')) return;
        if (key === 'Escape') {
          evt.preventDefault();
          requestClose();
          return;
        }
        if (key === 'ArrowDown' || key === 'PageDown' || key === 'j' || key === ' ') {
          evt.preventDefault();
          move(1);
          return;
        }
        if (key === 'ArrowUp' || key === 'PageUp' || key === 'k') {
          evt.preventDefault();
          move(-1);
          return;
        }
        if (key === 'm') {
          evt.preventDefault();
          setMuted((value) => !value);
        }
      },
      [move, requestClose],
    ),
  );

  const activeItem = items[activeIndex];

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Box
            className={css.Feed}
            direction="Column"
            ref={scrollRef}
            onScroll={handleScroll}
            tabIndex={-1}
          >
            <Box className={css.FeedTopBar} alignItems="Center" gap="200">
              <Box className={css.FeedBarGroup} alignItems="Center" gap="100">
                <IconButton size="300" radii="300" variant="Background" onClick={requestClose}>
                  <Icon size="50" src={Icons.ArrowLeft} />
                </IconButton>
                <Text size="L400">
                  {items.length === 0 ? '0' : `${activeIndex + 1} / ${items.length}`}
                  {hasMore ? '+' : ''}
                </Text>
              </Box>
              <Box grow="Yes" />
              <Box className={css.FeedBarGroup} alignItems="Center" gap="100">
                {loading && <Spinner variant="Secondary" size="100" />}
                {onOpenGallery && (
                  <TooltipProvider
                    position="Bottom"
                    align="End"
                    offset={4}
                    tooltip={
                      <Tooltip>
                        <Text>Browse all media</Text>
                      </Tooltip>
                    }
                  >
                    {(triggerRef) => (
                      <IconButton
                        size="300"
                        radii="300"
                        variant="Background"
                        ref={triggerRef}
                        onClick={onOpenGallery}
                        aria-label="Browse all media"
                      >
                        <Icon size="50" src={Icons.Category} />
                      </IconButton>
                    )}
                  </TooltipProvider>
                )}
                <TooltipProvider
                  position="Bottom"
                  align="End"
                  offset={4}
                  tooltip={
                    <Tooltip>
                      <Text>{muted ? 'Unmute (M)' : 'Mute (M)'}</Text>
                    </Tooltip>
                  }
                >
                  {(triggerRef) => (
                    <IconButton
                      size="300"
                      radii="300"
                      variant="Background"
                      ref={triggerRef}
                      onClick={() => setMuted((value) => !value)}
                      aria-pressed={muted}
                      aria-label={muted ? 'Unmute' : 'Mute'}
                    >
                      <Icon size="50" src={muted ? Icons.VolumeMute : Icons.VolumeHigh} />
                    </IconButton>
                  )}
                </TooltipProvider>
              </Box>
            </Box>

            {items.map((item, index) => (
              <Box key={item.eventId} className={css.FeedPage} shrink="No">
                {Math.abs(index - activeIndex) <= WINDOW && (
                  <MediaFeedContent
                    room={room}
                    item={item}
                    active={index === activeIndex}
                    muted={muted}
                    hour24Clock={hour24Clock}
                    onJump={onJump}
                  />
                )}
              </Box>
            ))}

            {items.length === 0 && (
              <Box className={css.FeedEnd} shrink="No">
                {loading ? (
                  <Spinner variant="Secondary" size="400" />
                ) : (
                  <Text size="T300">No media in this conversation yet.</Text>
                )}
              </Box>
            )}

            {items.length > 0 && (hasMore || loading) && (
              <Box className={css.FeedEnd} shrink="No">
                {loading ? (
                  <>
                    <Spinner variant="Secondary" size="400" />
                    <Text size="T200">Looking further back…</Text>
                  </>
                ) : (
                  <Chip variant="Secondary" radii="Pill" outlined onClick={loadMore}>
                    <Text size="B300">Load older media</Text>
                  </Chip>
                )}
              </Box>
            )}
            {items.length > 0 && !hasMore && !loading && (
              <Box className={css.FeedEnd} shrink="No">
                <Badge variant="Secondary" fill="Soft" radii="Pill">
                  <Text size="L400">That is everything in this conversation</Text>
                </Badge>
                {activeItem && (
                  <Chip variant="Secondary" radii="Pill" outlined onClick={requestClose}>
                    <Text size="B300">Back to the conversation</Text>
                  </Chip>
                )}
              </Box>
            )}
          </Box>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
