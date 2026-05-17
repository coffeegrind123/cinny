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
import { fetchAsBlobUrl } from '../../utils/tauri-media-proxy';
import { isTauri } from '../../utils/desktop-notifications';

const linkStyles = { color: color.Secondary.Main, textDecoration: 'none' };

function getTwitterId(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:[\w-]+\.)?(?:twitter\.com|x\.com|nitter\.[\w.-]+|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/(?:i\/web\/status|\w+\/status)\/(\d+)/);
  return m ? m[1] : null;
}

// Bluesky post URLs: https://bsky.app/profile/{handle-or-did}/post/{rkey}
// Also accept the AT-protocol-friendly bsky URL shapes used by clients.
function getBskyPostInfo(url: string): { actor: string; rkey: string } | null {
  const m = url.match(/^https?:\/\/(?:bsky\.app|cbsky\.app|psky\.app|deer\.social)\/profile\/([^/?#]+)\/post\/([^/?#]+)/);
  if (!m) return null;
  return { actor: m[1], rkey: m[2] };
}

const BSKY_API = 'https://public.api.bsky.app';

async function resolveBskyDid(actor: string): Promise<string> {
  if (actor.startsWith('did:')) return actor;
  const resp = await fetch(
    `${BSKY_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(actor)}`
  );
  if (!resp.ok) throw new Error(`resolveHandle HTTP ${resp.status}`);
  const data = await resp.json();
  if (typeof data?.did !== 'string') throw new Error('resolveHandle: no did');
  return data.did as string;
}

async function fetchBskyPost(actor: string, rkey: string): Promise<any> {
  const did = await resolveBskyDid(actor);
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const resp = await fetch(
    `${BSKY_API}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`
  );
  if (!resp.ok) throw new Error(`getPostThread HTTP ${resp.status}`);
  return resp.json();
}

function rewriteEmbedUrl(url: string, useSoundcloak: boolean): string {
  if (useSoundcloak) {
    const scMatch = url.match(/^https?:\/\/soundcloud\.com\/([^/]+)\/([^/?]+)/);
    if (scMatch) {
      return `https://sc1.maid.zone/_/api/restream/${scMatch[1]}/${scMatch[2]}`;
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
  return isAudioUrl(url) || /sc1\.maid\.zone\/_\/api\/restream\//.test(url);
}

// Twitter's video.twimg.com 403s on cross-origin requests even with
// referrerpolicy=no-referrer. On Tauri we proxy through Rust's HTTP plugin
// (no CORS/Referer constraints) and play from a blob: URL. Web falls back
// to the direct URL.
function ProxiedVideo({
  src,
  poster,
  isGif,
  width,
  height,
  className,
}: {
  src: string;
  poster?: string;
  isGif: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isTauri() ? null : src);

  useEffect(() => {
    if (!isTauri()) {
      setResolvedSrc(src);
      return undefined;
    }
    let cancelled = false;
    let createdBlob: string | null = null;
    fetchAsBlobUrl(src).then((blobUrl) => {
      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      if (blobUrl) {
        createdBlob = blobUrl;
        setResolvedSrc(blobUrl);
      } else {
        // Proxy failed — fall back to direct URL (will likely 403, but lets
        // browser show its own error state instead of an indefinite spinner).
        setResolvedSrc(src);
      }
    });
    return () => {
      cancelled = true;
      if (createdBlob) URL.revokeObjectURL(createdBlob);
    };
  }, [src]);

  const aspect = width && height ? `${width} / ${height}` : '16 / 9';

  if (!resolvedSrc) {
    return (
      <Box
        alignItems="Center"
        justifyContent="Center"
        style={{
          width: '100%',
          aspectRatio: aspect,
          backgroundColor: color.SurfaceVariant.Container,
        }}
      >
        <Spinner variant="Secondary" size="400" />
      </Box>
    );
  }

  return (
    <video
      className={className}
      src={resolvedSrc}
      poster={poster}
      controls={!isGif}
      autoPlay={isGif}
      loop={isGif}
      muted={isGif}
      playsInline
      preload="metadata"
      referrerPolicy="no-referrer"
      style={{ aspectRatio: aspect }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function ProxiedImg({
  src,
  alt,
  title,
  onView,
}: {
  src: string;
  alt: string;
  title?: string;
  onView: () => void;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isTauri() ? null : src);

  useEffect(() => {
    if (!isTauri()) {
      setResolvedSrc(src);
      return undefined;
    }
    let cancelled = false;
    let createdBlob: string | null = null;
    fetchAsBlobUrl(src).then((blobUrl) => {
      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      if (blobUrl) {
        createdBlob = blobUrl;
        setResolvedSrc(blobUrl);
      } else {
        setResolvedSrc(src);
      }
    });
    return () => {
      cancelled = true;
      if (createdBlob) URL.revokeObjectURL(createdBlob);
    };
  }, [src]);

  if (!resolvedSrc) {
    return (
      <Box
        alignItems="Center"
        justifyContent="Center"
        style={{
          width: '100%',
          minHeight: '200px',
          backgroundColor: color.SurfaceVariant.Container,
        }}
      >
        <Spinner variant="Secondary" size="400" />
      </Box>
    );
  }

  return (
    <UrlPreviewImg
      src={resolvedSrc}
      alt={alt}
      title={title}
      referrerPolicy="no-referrer"
      tabIndex={0}
      onKeyDown={(evt: any) => onEnterOrSpace(onView)(evt)}
      onClick={onView}
    />
  );
}

export const UrlPreviewCard = as<
  'div',
  { url: string; ts: number; renderViewer?: (props: RenderViewerProps) => ReactNode }
>(({ url, ts, renderViewer, ...props }, ref) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [useVxTwitter] = useSetting(settingsAtom, 'useVxTwitter');
  const [useSoundcloak] = useSetting(settingsAtom, 'useSoundcloak');
  const [usePiped] = useSetting(settingsAtom, 'usePiped');

  const embedUrl = rewriteEmbedUrl(url, useSoundcloak);
  const twId = useVxTwitter ? getTwitterId(url) : null;
  const bskyPost = getBskyPostInfo(url);

  // vxtwitter client-side fetch
  const [vxData, setVxData] = useState<any>(null);
  const [vxLoading, setVxLoading] = useState(false);
  const [vxError, setVxError] = useState(false);
  useEffect(() => {
    if (!twId) return;
    setVxLoading(true);
    setVxError(false);
    fetch(`https://api.vxtwitter.com/Twitter/status/${twId}`)
      .then((r) => r.json())
      .then((d) => { setVxData(d); setVxLoading(false); })
      .catch(() => { setVxError(true); setVxLoading(false); });
  }, [twId]);

  // Bluesky client-side fetch — public API, no auth needed.
  const [bskyData, setBskyData] = useState<any>(null);
  const [bskyLoading, setBskyLoading] = useState(false);
  const [bskyError, setBskyError] = useState(false);
  useEffect(() => {
    if (!bskyPost) return;
    setBskyLoading(true);
    setBskyError(false);
    fetchBskyPost(bskyPost.actor, bskyPost.rkey)
      .then((d) => { setBskyData(d); setBskyLoading(false); })
      .catch(() => { setBskyError(true); setBskyLoading(false); });
    // bskyPost is a fresh object each render — narrow deps to its primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bskyPost?.actor, bskyPost?.rkey]);

  const [viewerSrc, setViewerSrc] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isYt = isYoutubeUrl(url);
  const ytVideoId = isYt ? getYoutubeVideoId(url) : null;

  const [previewStatus, loadPreview] = useAsyncCallback(
    useCallback(() => mx.getUrlPreview(embedUrl, ts), [embedUrl, ts, mx])
  );

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  if (twId && dismissed) return null;
  // vxtwitter path — render directly from API response
  if (twId && vxData) {
    const allMedia = (vxData.media_extended ?? []) as Array<{
      type: string;
      url: string;
      thumbnail_url?: string;
      altText?: string;
      size?: { width: number; height: number };
    }>;
    return (
      <UrlPreview {...props} ref={ref}>
        <Box grow="Yes" direction="Column" style={{ position: 'relative', minWidth: 0 }}>
          <IconButton
            size="200" radii="300" variant="SurfaceVariant"
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            aria-label="Dismiss embed"
            style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
          >
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
          {allMedia.map((m, i) => {
            if (m.type === 'video' || m.type === 'gif') {
              return (
                <ProxiedVideo
                  key={i}
                  src={m.url}
                  poster={m.thumbnail_url}
                  isGif={m.type === 'gif'}
                  width={m.size?.width}
                  height={m.size?.height}
                  className={urlPreviewCss.UrlPreviewVideo}
                />
              );
            }
            if (m.type === 'image' || m.type === 'photo') {
              return (
                <ProxiedImg
                  key={i}
                  src={m.url}
                  alt={m.altText || vxData.text || ''}
                  title={m.altText || vxData.text}
                  onView={() => setViewerSrc(m.url)}
                />
              );
            }
            return null;
          })}
          <UrlPreviewContent>
            <Text style={linkStyles} truncate as="a" href={url} target="_blank" rel="noreferrer" size="T200" priority="300">
              {vxData.user_name
                ? `${vxData.user_name}${vxData.user_screen_name ? ` (@${vxData.user_screen_name})` : ''} | `
                : ''}
              {tryDecodeURIComponent(url)}
            </Text>
            {vxData.text && <Text size="T300">{vxData.text}</Text>}
            <Text size="T200" priority="300">
              {`${vxData.likes ?? 0} likes · ${vxData.retweets ?? 0} retweets · ${vxData.replies ?? 0} replies`}
            </Text>
          </UrlPreviewContent>
          {viewerSrc && renderViewer && (
            <ImageOverlay
              src={viewerSrc}
              alt={vxData.text || 'Image'}
              viewer={!!viewerSrc}
              requestClose={() => setViewerSrc(undefined)}
              renderViewer={renderViewer}
              externalUrl={url}
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
                    alt={vxData.text || 'Image'}
                    requestClose={() => setViewerSrc(undefined)}
                    externalUrl={url}
                  />
                </FocusTrap>
              </OverlayCenter>
            </Overlay>
          )}
        </Box>
      </UrlPreview>
    );
  }
  if (twId && vxLoading) {
    return (
      <UrlPreview {...props} ref={ref}>
        <Box grow="Yes" alignItems="Center" justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner variant="Secondary" size="400" />
        </Box>
      </UrlPreview>
    );
  }
  // vxError: fall through to standard preview so Matrix og: metadata still shows

  // Bluesky native render — uses public getPostThread API; supports
  // multi-image posts (1–4 images) plus video and external-link embeds.
  if (bskyPost && dismissed) return null;
  if (bskyPost && bskyData) {
    const post = bskyData?.thread?.post;
    const author = post?.author;
    const record = post?.record ?? {};
    const embed = post?.embed ?? {};
    const images: Array<{
      thumb: string;
      fullsize: string;
      alt?: string;
      aspectRatio?: { height: number; width: number };
    }> = Array.isArray(embed.images) ? embed.images : [];
    // recordWithMedia#view: media nested under embed.media
    const mediaImages: typeof images = Array.isArray(embed.media?.images)
      ? embed.media.images
      : [];
    const allImages = images.length ? images : mediaImages;

    const videoView =
      embed.$type === 'app.bsky.embed.video#view' || embed.media?.$type === 'app.bsky.embed.video#view'
        ? embed.$type === 'app.bsky.embed.video#view'
          ? embed
          : embed.media
        : null;
    const externalView =
      embed.$type === 'app.bsky.embed.external#view'
        ? embed.external
        : embed.media?.$type === 'app.bsky.embed.external#view'
          ? embed.media.external
          : null;

    const displayName = author?.displayName || author?.handle || 'Bluesky';
    const handle = author?.handle ? `@${author.handle}` : '';

    return (
      <UrlPreview {...props} ref={ref}>
        <Box grow="Yes" direction="Column" style={{ position: 'relative', minWidth: 0 }}>
          <IconButton
            size="200" radii="300" variant="SurfaceVariant"
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            aria-label="Dismiss embed"
            style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
          >
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
          {allImages.length > 0 && (
            <Box
              direction="Row"
              gap="100"
              style={{ width: '100%', flexWrap: 'wrap' }}
            >
              {allImages.map((img, i) => {
                // 1 image: full width. 2+: 2-column grid that fills.
                const basis = allImages.length === 1 ? '100%' : 'calc(50% - 2px)';
                return (
                  <Box
                    key={i}
                    style={{
                      flexBasis: basis,
                      flexGrow: 1,
                      minWidth: '160px',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      borderRadius: '8px',
                    }}
                  >
                    <ProxiedImg
                      src={img.fullsize || img.thumb}
                      alt={img.alt || ''}
                      title={img.alt}
                      onView={() => setViewerSrc(img.fullsize || img.thumb)}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
          {videoView && videoView.playlist && (
            <ProxiedVideo
              src={videoView.playlist}
              poster={videoView.thumbnail}
              isGif={false}
              width={videoView.aspectRatio?.width}
              height={videoView.aspectRatio?.height}
              className={urlPreviewCss.UrlPreviewVideo}
            />
          )}
          {externalView && (
            <Box direction="Column" gap="100" style={{ padding: config.space.S200 }}>
              {externalView.thumb && (
                <ProxiedImg
                  src={externalView.thumb}
                  alt={externalView.title || ''}
                  onView={() => setViewerSrc(externalView.thumb)}
                />
              )}
              {externalView.title && (
                <Text size="T300" priority="500">
                  <a href={externalView.uri} target="_blank" rel="noreferrer" style={linkStyles}>
                    {externalView.title}
                  </a>
                </Text>
              )}
              {externalView.description && (
                <Text size="T200" priority="300">{externalView.description}</Text>
              )}
            </Box>
          )}
          <UrlPreviewContent>
            <Text style={linkStyles} truncate as="a" href={url} target="_blank" rel="noreferrer" size="T200" priority="300">
              {`${displayName}${handle ? ` ${handle}` : ''} | `}
              {tryDecodeURIComponent(url)}
            </Text>
            {typeof record.text === 'string' && record.text.length > 0 && (
              <Text size="T300" style={{ whiteSpace: 'pre-wrap' }}>
                {record.text}
              </Text>
            )}
            <Text size="T200" priority="300">
              {`${post?.likeCount ?? 0} likes · ${post?.repostCount ?? 0} reposts · ${post?.replyCount ?? 0} replies${
                typeof post?.quoteCount === 'number' && post.quoteCount > 0
                  ? ` · ${post.quoteCount} quotes`
                  : ''
              }`}
            </Text>
          </UrlPreviewContent>
          {viewerSrc && renderViewer && (
            <ImageOverlay
              src={viewerSrc}
              alt={record.text || 'Image'}
              viewer={!!viewerSrc}
              requestClose={() => setViewerSrc(undefined)}
              renderViewer={renderViewer}
              externalUrl={url}
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
                    alt={record.text || 'Image'}
                    requestClose={() => setViewerSrc(undefined)}
                    externalUrl={url}
                  />
                </FocusTrap>
              </OverlayCenter>
            </Overlay>
          )}
        </Box>
      </UrlPreview>
    );
  }
  if (bskyPost && bskyLoading) {
    return (
      <UrlPreview {...props} ref={ref}>
        <Box grow="Yes" alignItems="Center" justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner variant="Secondary" size="400" />
        </Box>
      </UrlPreview>
    );
  }
  // bskyError: fall through to Matrix og: preview

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

    // og:video data (Bandcamp etc.)
    const ogVideoUrl = (prev['og:video'] || prev['og:video:url']) as string | undefined;
    const hasOgVideo = !!ogVideoUrl;
    const ogVideoWidth = Number(prev['og:video:width']) || undefined;
    const ogVideoHeight = Number(prev['og:video:height']) || undefined;
    const ogVideoAspect = ogVideoWidth && ogVideoHeight
      ? `${ogVideoWidth} / ${ogVideoHeight}`
      : undefined;

    const allKeys = Object.keys(prev).filter(k => k.startsWith('og:'));

    return (
      <Box grow="Yes" direction="Column" style={{ position: 'relative', minWidth: 0 }}>
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

        {/* og:video embed (Bandcamp etc.) */}
        {!isYt && hasOgVideo && /bandcamp\.com\/EmbeddedPlayer/.test(ogVideoUrl) && (
          <iframe
            style={{ border: 0, width: '100%', height: '120px' }}
            src={ogVideoUrl}
            title={title || 'Bandcamp'}
            seamless
            allowFullScreen
          />
        )}
        {!isYt && hasOgVideo && !/bandcamp\.com\/EmbeddedPlayer/.test(ogVideoUrl) && !/video\.twimg\.com/.test(ogVideoUrl) && (
          <video
            className={urlPreviewCss.UrlPreviewVideo}
            src={ogVideoUrl}
            controls
            preload="metadata"
            poster={imgUrl || undefined}
            style={ogVideoAspect ? { aspectRatio: ogVideoAspect } : undefined}
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
            style={ogVideoAspect ? { aspectRatio: ogVideoAspect } : undefined}
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
            externalUrl={url}
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
                  externalUrl={url}
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
