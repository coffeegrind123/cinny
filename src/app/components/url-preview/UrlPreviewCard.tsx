import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { IPreviewUrlResponse } from 'matrix-js-sdk';
import {
  Box,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  as,
  color,
  config,
  Button,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { RenderViewerProps, ImageOverlay } from '../ImageOverlay';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UrlPreview, UrlPreviewContent, UrlPreviewDescription, UrlPreviewImg, UrlPreviewImgInside } from './UrlPreview';
import {
  getIntersectionObserverEntry,
  useIntersectionObserver,
} from '../../hooks/useIntersectionObserver';
import * as css from './UrlPreviewCard.css';
import * as urlPreviewCss from './UrlPreview.css';
import { tryDecodeURIComponent } from '../../utils/dom';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { ImageViewer } from '../image-viewer';
import { stopPropagation, onEnterOrSpace } from '../../utils/keyboard';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { isYoutubeUrl, getYoutubeVideoId } from '../../utils/youtube';

const linkStyles = { color: color.Secondary.Main, textDecoration: 'none' };

function rewriteEmbedUrl(url: string, useFxTwitter: boolean, useSoundcloak: boolean): string {
  if (useFxTwitter) {
    const twitterMatch = url.match(/^https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (twitterMatch) {
      return `https://fxtwitter.com/${twitterMatch[2]}/status/${twitterMatch[3]}`;
    }
  }
  if (useSoundcloak) {
    const scMatch = url.match(/^https?:\/\/soundcloud\.com\/([^/]+)\/([^/?]+)/);
    if (scMatch) {
      return `https://sc1.maid.zone/${scMatch[1]}/${scMatch[2]}`;
    }
  }
  return url;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|flac|m4a|aac)(\?|$)/i.test(url);
}

function isDirectAudioUrl(url: string): boolean {
  return isAudioUrl(url) || /sc1\.maid\.zone\/.+\/.+/.test(url);
}

export const UrlPreviewCard = as<
  'div',
  { url: string; ts: number; renderViewer?: (props: RenderViewerProps) => ReactNode }
>(({ url, ts, renderViewer, ...props }, ref) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [useFxTwitter] = useSetting(settingsAtom, 'useFxTwitter');
  const [useSoundcloak] = useSetting(settingsAtom, 'useSoundcloak');
  const [usePiped] = useSetting(settingsAtom, 'usePiped');

  const embedUrl = rewriteEmbedUrl(url, useFxTwitter, useSoundcloak);

  // SoundCloud/soundcloak or direct MP3 — render audio player directly, skip preview
  if (isDirectAudioUrl(embedUrl) || isAudioUrl(url)) {
    return (
      <Box direction="Column" style={{ padding: config.space.S200 }} gap="100">
        <audio
          className={urlPreviewCss.UrlPreviewVideo}
          src={isDirectAudioUrl(embedUrl) ? embedUrl : url}
          controls
          preload="metadata"
        />
        <Text size="T200" priority="300">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ color: color.Secondary.Main, textDecoration: 'none' }}
          >
            {tryDecodeURIComponent(url)}
          </a>
        </Text>
      </Box>
    );
  }

  const [previewStatus, loadPreview] = useAsyncCallback(
    useCallback(() => mx.getUrlPreview(embedUrl, ts), [embedUrl, ts, mx])
  );
  const [viewerSrc, setViewerSrc] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isYt = isYoutubeUrl(url);
  const ytVideoId = isYt ? getYoutubeVideoId(url) : null;

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const effectivePreview = previewStatus.status === AsyncStatus.Success
    ? previewStatus.data
    : null;

  if (!effectivePreview && previewStatus.status !== AsyncStatus.Loading) return null;

  if (dismissed) return null;

  const renderContent = (prev: IPreviewUrlResponse) => {
    const thumbUrl = mxcUrlToHttp(
      mx,
      prev['og:image'] || '',
      useAuthentication,
      256,
      256,
      'scale',
      false
    );

    const imgUrl = mxcUrlToHttp(
      mx,
      prev['og:image'] || '',
      useAuthentication,
      512,
      512,
      'scale',
      false
    );

    const title = prev['og:title'] as string | undefined;
    const description = prev['og:description'] as string | undefined;
    const siteName = prev['og:site_name'] as string | undefined;
    const isVideo = isVideoUrl(url) || (prev['og:type'] as string)?.startsWith('video');
    const isAudio = isAudioUrl(url) || (prev['og:type'] as string)?.startsWith('music');

    // og:video data (fxtwitter etc.)
    const ogVideoUrl = (prev['og:video'] || prev['og:video:url']) as string | undefined;
    const hasOgVideo = !!ogVideoUrl;

    const allKeys = Object.keys(prev).filter(k => k.startsWith('og:'));

    return (
      <Box direction="Column" style={{ position: 'relative' }}>
        {/* Dismiss button */}
        <IconButton
          size="200"
          radii="300"
          variant="SurfaceVariant"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          aria-label="Dismiss embed"
          style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
        >
          <Icon size="50" src={Icons.Cross} />
        </IconButton>

        {/* YouTube iframe embed */}
        {isYt && ytVideoId && (
          <Box
            style={{
              position: 'relative',
              paddingBottom: '56.25%',
              height: 0,
              overflow: 'hidden',
              backgroundColor: color.SurfaceVariant.Container,
            }}
          >
            <iframe
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              src={usePiped
                ? `https://piped.private.coffee/embed/${ytVideoId}`
                : `https://www.youtube.com/embed/${ytVideoId}`}
              title={title || 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Box>
        )}

        {/* og:video embed (fxtwitter, Bandcamp, etc.) */}
        {!isYt && hasOgVideo && /bandcamp\.com\/EmbeddedPlayer/.test(ogVideoUrl) && (
          <iframe
            style={{ border: 0, width: '100%', height: '120px' }}
            src={ogVideoUrl}
            title={title || 'Bandcamp'}
            seamless
            allowFullScreen
          />
        )}
        {!isYt && hasOgVideo && !/bandcamp\.com\/EmbeddedPlayer/.test(ogVideoUrl) && (
          <video
            className={urlPreviewCss.UrlPreviewVideo}
            src={ogVideoUrl}
            controls
            preload="metadata"
            poster={imgUrl || undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <a href={ogVideoUrl} target="_blank" rel="noreferrer">
              {title || 'Video'}
            </a>
          </video>
        )}

        {/* Direct video URL */}
        {!isYt && !hasOgVideo && isVideo && imgUrl && (
          <video
            className={urlPreviewCss.UrlPreviewVideo}
            src={imgUrl}
            controls
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={imgUrl} target="_blank" rel="noreferrer">
              {title || 'Video'}
            </a>
          </video>
        )}

        {/* Audio embed */}
        {isAudio && imgUrl && (
          <audio
            className={urlPreviewCss.UrlPreviewVideo}
            src={imgUrl}
            controls
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={imgUrl} target="_blank" rel="noreferrer">
              {title || 'Audio'}
            </a>
          </audio>
        )}

        {/* Preview image (only if no video/audio player showing) */}
        {!isYt && !hasOgVideo && !isVideo && !isAudio && thumbUrl && (
          <UrlPreviewImg
            src={thumbUrl}
            alt={title || ''}
            title={title}
            tabIndex={0}
            onKeyDown={(evt) => onEnterOrSpace(() => setViewerSrc(imgUrl))(evt)}
            onClick={() => setViewerSrc(imgUrl)}
          />
        )}

        <UrlPreviewContent>
          <Text
            style={linkStyles}
            truncate
            as="a"
            href={url}
            target="_blank"
            rel="noreferrer"
            size="T200"
            priority="300"
          >
            {siteName ? `${siteName} | ` : ''}
            {tryDecodeURIComponent(url)}
          </Text>
          {title && (
            <Text
              style={{ fontWeight: '600' }}
              as="a"
              href={url}
              target="_blank"
              rel="noreferrer"
              size="T300"
              truncate={!expanded}
            >
              {title}
            </Text>
          )}
          {description && (
            <Text size="T200" priority="300">
              <UrlPreviewDescription>{description}</UrlPreviewDescription>
            </Text>
          )}

          {/* Expand/collapse extra embed data */}
          {allKeys.length > 4 && (
            <Button
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              onClick={() => setExpanded(!expanded)}
            >
              <Text size="B300">
                {expanded ? 'Show Less' : `Show All (${allKeys.length - 4} more)`}
              </Text>
            </Button>
          )}

          {expanded && (
            <Box direction="Column" gap="100" style={{ padding: `${config.space.S100} 0` }}>
              {allKeys.map((key) => {
                const val = prev[key];
                if (!val || key === 'og:title' || key === 'og:description' || key === 'og:image' || key === 'og:site_name') return null;
                return (
                  <Text key={key} size="T200" priority="400">
                    <b>{key.replace('og:', '')}:</b>{' '}
                    {typeof val === 'string' && val.length > 120
                      ? `${val.slice(0, 120)}...`
                      : String(val)}
                  </Text>
                );
              })}
            </Box>
          )}
        </UrlPreviewContent>

        {/* Image viewer — use renderViewer if provided, fall back to FocusTrap */}
        {viewerSrc && renderViewer && (
          <ImageOverlay
            src={viewerSrc}
            alt={title || 'Image'}
            viewer={!!viewerSrc}
            requestClose={() => setViewerSrc(undefined)}
            renderViewer={renderViewer}
          />
        )}
        {viewerSrc && !renderViewer && (
          <Overlay open backdrop={<OverlayBackdrop />}>
            <OverlayCenter>
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  onDeactivate: () => setViewerSrc(undefined),
                  clickOutsideDeactivates: true,
                  escapeDeactivates: stopPropagation,
                }}
              >
                <ImageViewer
                  src={viewerSrc}
                  alt={title || 'Image'}
                  requestClose={() => setViewerSrc(undefined)}
                />
              </FocusTrap>
            </OverlayCenter>
          </Overlay>
        )}
      </Box>
    );
  };

  return (
    <UrlPreview {...props} ref={ref}>
      {effectivePreview ? (
        renderContent(effectivePreview as IPreviewUrlResponse)
      ) : (
        <Box grow="Yes" alignItems="Center" justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner variant="Secondary" size="400" />
        </Box>
      )}
    </UrlPreview>
  );
});

export const UrlPreviewHolder = as<'div'>(({ children, ...props }, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const backAnchorRef = useRef<HTMLDivElement>(null);
  const frontAnchorRef = useRef<HTMLDivElement>(null);
  const [backVisible, setBackVisible] = useState(true);
  const [frontVisible, setFrontVisible] = useState(true);

  const intersectionObserver = useIntersectionObserver(
    useCallback((entries) => {
      const backAnchor = backAnchorRef.current;
      const frontAnchor = frontAnchorRef.current;
      const backEntry = backAnchor && getIntersectionObserverEntry(backAnchor, entries);
      const frontEntry = frontAnchor && getIntersectionObserverEntry(frontAnchor, entries);
      if (backEntry) {
        setBackVisible(backEntry.isIntersecting);
      }
      if (frontEntry) {
        setFrontVisible(frontEntry.isIntersecting);
      }
    }, []),
    useCallback(
      () => ({
        root: scrollRef.current,
        rootMargin: '10px',
      }),
      []
    )
  );

  useEffect(() => {
    const backAnchor = backAnchorRef.current;
    const frontAnchor = frontAnchorRef.current;
    if (backAnchor) intersectionObserver?.observe(backAnchor);
    if (frontAnchor) intersectionObserver?.unobserve(frontAnchor);
    return () => {
      if (backAnchor) intersectionObserver?.observe(backAnchor);
      if (frontAnchor) intersectionObserver?.unobserve(frontAnchor);
    };
  }, [intersectionObserver]);

  const handleScrollBack = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const { offsetWidth, scrollLeft } = scroll;
    scroll.scrollTo({
      left: scrollLeft - offsetWidth / 1.3,
      behavior: 'smooth',
    });
  };
  const handleScrollFront = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const { offsetWidth, scrollLeft } = scroll;
    scroll.scrollTo({
      left: scrollLeft + offsetWidth / 1.3,
      behavior: 'smooth',
    });
  };

  return (
    <Box
      direction="Column"
      {...props}
      ref={ref}
      style={{ marginTop: config.space.S200, position: 'relative' }}
    >
      <Scroll ref={scrollRef} direction="Horizontal" size="0" visibility="Hover" hideTrack>
        <Box shrink="No" alignItems="Center">
          <div ref={backAnchorRef} />
          {!backVisible && (
            <>
              <div className={css.UrlPreviewHolderGradient({ position: 'Left' })} />
              <IconButton
                className={css.UrlPreviewHolderBtn({ position: 'Left' })}
                variant="Secondary"
                radii="Pill"
                size="300"
                outlined
                onClick={handleScrollBack}
              >
                <Icon size="300" src={Icons.ArrowLeft} />
              </IconButton>
            </>
          )}
          <Box alignItems="Inherit" gap="200">
            {children}

            {!frontVisible && (
              <>
                <div className={css.UrlPreviewHolderGradient({ position: 'Right' })} />
                <IconButton
                  className={css.UrlPreviewHolderBtn({ position: 'Right' })}
                  variant="Primary"
                  radii="Pill"
                  size="300"
                  outlined
                  onClick={handleScrollFront}
                >
                  <Icon size="300" src={Icons.ArrowRight} />
                </IconButton>
              </>
            )}
            <div ref={frontAnchorRef} />
          </Box>
        </Box>
      </Scroll>
    </Box>
  );
});
