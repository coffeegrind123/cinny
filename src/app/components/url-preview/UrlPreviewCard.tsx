import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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
  toRem,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { RenderViewerProps, ImageOverlay } from '../ImageOverlay';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UrlPreview, UrlPreviewContent, UrlPreviewImg } from './UrlPreview';
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
import { fetchOgPreview } from '../../utils/tauri-og-preview';
import { isTauri } from '../../utils/desktop-notifications';
import { isWebUrl, webUrlOrUndefined } from '../../utils/safeUrl';

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

const SOUNDCLOAK_HOST = 'sc1.maid.zone';
const SOUNDCLOAK_RESTREAM_PATH = '/_/api/restream/';

// Fixed, compile-time embed origins. Neither is user-configurable — there is no
// setting for a custom Piped instance — so the only variable part of the iframe
// src is the video id, which `getYoutubeVideoId` already constrains. If a
// custom-instance setting is ever added, it must be run through `isWebUrl`
// (and ideally pinned to https) before it is concatenated here.
const PIPED_EMBED_BASE = 'https://piped.private.coffee/embed/';
const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed/';

function rewriteEmbedUrl(url: string, useSoundcloak: boolean): string {
  if (useSoundcloak) {
    const scMatch = url.match(/^https?:\/\/soundcloud\.com\/([^/]+)\/([^/?]+)/);
    if (scMatch) {
      // The two captured segments come straight out of a message-supplied URL.
      // Splicing them in raw let a crafted soundcloud.com link steer the
      // resulting soundcloak URL — `..%2f` style traversal, an injected `?`/`#`
      // that reparents the rest of the path into a query, or a second `//` that
      // changes which host the path resolves against. Percent-encode each
      // segment so it can only ever be one path component.
      return `https://${SOUNDCLOAK_HOST}${SOUNDCLOAK_RESTREAM_PATH}${encodeURIComponent(
        scMatch[1]
      )}/${encodeURIComponent(scMatch[2])}`;
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

// True only for a real soundcloak restream endpoint. The previous unanchored
// substring test matched the path of any host — `https://attacker.example/
// sc1.maid.zone/_/api/restream/x` was treated as a trusted stream — and it ran
// even with the soundcloak integration switched off, so the rewrite could not
// be the only thing that produced such a URL.
function isSoundcloakStreamUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.host === SOUNDCLOAK_HOST &&
      parsed.pathname.startsWith(SOUNDCLOAK_RESTREAM_PATH)
    );
  } catch {
    return false;
  }
}

// `soundcloakEnabled` is required, not optional: a soundcloak stream URL is
// only ever legitimate when the user opted into the integration, so the check
// must not be consultable while the feature is off.
function isDirectAudioUrl(url: string, soundcloakEnabled: boolean): boolean {
  return isAudioUrl(url) || (soundcloakEnabled && isSoundcloakStreamUrl(url));
}

// Bandcamp's own embedded player, verified by parsing rather than by looking
// for `bandcamp.com/EmbeddedPlayer` anywhere in the string — the substring test
// also accepted `https://attacker.example/bandcamp.com/EmbeddedPlayer/x` and
// rendered the attacker's origin in an iframe. og:video is chosen by whoever
// controls the linked page, so it is untrusted input.
function isBandcampEmbedUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.host !== 'bandcamp.com' && !parsed.host.endsWith('.bandcamp.com')) return false;
    return parsed.pathname.startsWith('/EmbeddedPlayer');
  } catch {
    return false;
  }
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

  // `src` arrives from third-party API JSON (vxtwitter / public.api.bsky.app),
  // and the proxy falls back to using it directly when the native fetch fails.
  // An unexpected scheme there is not merely a broken load: in the Tauri shell
  // the new-window handler hands any non-blob URL to the OS URL opener.
  if (!isWebUrl(src)) return null;

  if (!resolvedSrc) {
    return (
      <Box
        alignItems="Center"
        justifyContent="Center"
        style={{
          width: '100%',
          aspectRatio: aspect,
          maxHeight: toRem(320),
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
      poster={webUrlOrUndefined(poster)}
      controls={!isGif}
      autoPlay={isGif}
      loop
      muted={isGif}
      playsInline
      preload="metadata"
      // React types have no referrerPolicy on <video> (the HTML spec has no such
      // content attribute on media elements) but we emit it on purpose — see the
      // Twitter/X media note in CLAUDE.md. A spread renders it identically while
      // skipping excess-property checking.
      {...{ referrerPolicy: 'no-referrer' }}
      style={{ aspectRatio: aspect }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// HLS-aware <video>. Bluesky videos are HLS m3u8 streams (`playlist`
// field on app.bsky.embed.video#view) and Chromium-based browsers
// don't play those natively — only Safari does. hls.js is loaded
// lazily via dynamic import so users who never see a bsky video
// don't pay the ~80kB-gzipped bundle hit.
function HlsVideo({
  src,
  poster,
  width,
  height,
  className,
}: {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    const video = videoRef.current;
    if (!video || !src) return undefined;

    // Native HLS (Safari + iOS WebView).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return undefined;
    }

    let cancelled = false;
    let hlsInstance: any = null;

    Promise.all([import('hls.js'), import('../../utils/tauri-hls-loader')])
      .then(([{ default: Hls }, { TauriHlsLoader }]) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setErrorMsg('Your browser does not support MSE — required for HLS playback.');
          return;
        }

        // Route every HLS fetch through Rust when we're inside Tauri.
        // bsky's video CDN doesn't return Access-Control-Allow-Origin,
        // so the browser-default XHR loader is blocked by CORS the
        // moment hls.js asks for the playlist. The Rust IPC command
        // (`fetch_remote_bytes`) is server-to-server and bypasses CORS.
        const loader: any =
          typeof window !== 'undefined' &&
          ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
            ? TauriHlsLoader
            : (Hls.DefaultConfig as any).loader;

        const hls = new Hls({
          enableWorker: false,
          loader,
        });
        hlsInstance = hls;

        hls.on(Hls.Events.ERROR, (_evt: unknown, data: any) => {
          if (data.fatal) {
            console.error('[bsky/hls] fatal', data.type, data.details, data);
            setErrorMsg(
              `Video error: ${data.details ?? data.type ?? 'unknown'} — open in Bluesky to watch.`
            );
            try {
              hls.destroy();
            } catch {
              // ignore
            }
          } else {
            console.warn('[bsky/hls] non-fatal', data.details ?? data.type, data);
          }
        });

        try {
          hls.loadSource(src);
          hls.attachMedia(video);
        } catch (err) {
          console.error('[bsky/hls] loadSource/attachMedia failed:', err);
          setErrorMsg('Could not initialize HLS player.');
        }
      })
      .catch((err) => {
        console.error('[bsky/hls] dynamic import of hls.js failed:', err);
        if (!cancelled) setErrorMsg('Failed to load video player.');
      });

    return () => {
      cancelled = true;
      try {
        hlsInstance?.destroy();
      } catch {
        // ignore
      }
    };
  }, [src]);

  const aspect = width && height ? `${width} / ${height}` : '16 / 9';

  // `src` (the HLS playlist) and `poster` come from the Bluesky API response,
  // i.e. remote JSON. Validate the scheme before either reaches a media
  // element — see the note in ProxiedVideo.
  if (!isWebUrl(src)) return null;
  const safePoster = webUrlOrUndefined(poster);

  if (errorMsg) {
    return (
      <Box
        direction="Column"
        gap="100"
        alignItems="Center"
        justifyContent="Center"
        style={{
          width: '100%',
          aspectRatio: aspect,
          maxHeight: toRem(320),
          backgroundColor: color.SurfaceVariant.Container,
          padding: config.space.S300,
        }}
      >
        {safePoster && (
          <img
            src={safePoster}
            alt=""
            referrerPolicy="no-referrer"
            style={{ maxHeight: '60%', borderRadius: 4 }}
          />
        )}
        <Text size="T200" align="Center">{errorMsg}</Text>
      </Box>
    );
  }

  return (
    <video
      ref={videoRef}
      poster={safePoster}
      controls
      loop
      playsInline
      preload="metadata"
      // React types have no referrerPolicy on <video> (the HTML spec has no such
      // content attribute on media elements) but we emit it on purpose — see the
      // Twitter/X media note in CLAUDE.md. A spread renders it identically while
      // skipping excess-property checking.
      {...{ referrerPolicy: 'no-referrer' }}
      style={{ aspectRatio: aspect, width: '100%' }}
      className={className}
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

  // Same reasoning as ProxiedVideo: `src` is remote-supplied JSON and the
  // non-Tauri / proxy-failure paths put it straight into an <img src>.
  if (!isWebUrl(src)) return null;

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
  const [useBlueskyEmbeds] = useSetting(settingsAtom, 'useBlueskyEmbeds');
  const [usePiped] = useSetting(settingsAtom, 'usePiped');
  const [clientPreviewFallback] = useSetting(settingsAtom, 'clientPreviewFallback');

  // The previewed URL itself is message content, and it is rendered into five
  // separate `<a href>` positions below. Every value derived from the preview
  // metadata is scheme-checked individually, but `url` arrives from the caller's
  // URL extractor, so gate it once here rather than at each anchor. In the Tauri
  // shell an anchor with `target="_blank"` reaches the OS URL opener.
  const safeUrl = webUrlOrUndefined(url);

  const embedUrl = rewriteEmbedUrl(url, useSoundcloak);
  const twId = useVxTwitter ? getTwitterId(url) : null;
  // Gated like the Twitter path above. Merely rendering a message containing a
  // bsky.app link otherwise fired two unprompted cross-origin requests to
  // public.api.bsky.app (resolveHandle, then getPostThread), which discloses
  // the viewer's IP to a host the message *sender* picked and tells that
  // sender when the message was rendered — a read receipt they control.
  const bskyPost = useBlueskyEmbeds ? getBskyPostInfo(url) : null;

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

  // Single source of truth for "this renders as a bare audio player". The
  // soundcloak arm is only consulted when the integration is switched on.
  const directAudioEmbed = isDirectAudioUrl(embedUrl, useSoundcloak);
  const directAudio = directAudioEmbed || isAudioUrl(url);

  const [previewStatus, loadPreview] = useAsyncCallback(
    useCallback(() => mx.getUrlPreview(embedUrl, ts), [embedUrl, ts, mx])
  );

  useEffect(() => {
    // Skip OG metadata fetch for direct-audio URLs (soundcloak restream,
    // raw mp3/ogg etc.). Homeservers commonly reject non-text content
    // types from preview_url with 502 ("content type not allowed"),
    // which spams the console and leaves an error toast for nothing —
    // the audio renderer below doesn't need OG data anyway.
    if (directAudio) return;
    loadPreview();
  }, [loadPreview, directAudio]);

  // Client-side OG fallback (desktop/mobile app, opt-in). When the homeserver
  // preview_url errors — e.g. a 504 because the target rejects Synapse's
  // non-browser User-Agent — fetch the page ourselves and parse its meta tags.
  // Skipped for URLs that already have a dedicated renderer (Twitter, Bluesky,
  // YouTube, direct audio) since those don't rely on the homeserver preview.
  const [ogFallback, setOgFallback] = useState<IPreviewUrlResponse | null>(null);
  const [ogFallbackTried, setOgFallbackTried] = useState(false);
  useEffect(() => {
    if (!clientPreviewFallback) return;
    if (previewStatus.status !== AsyncStatus.Error) return;
    if (ogFallbackTried) return;
    if (twId || bskyPost || isYt) return;
    if (directAudio) return;
    setOgFallbackTried(true);
    fetchOgPreview(embedUrl).then((data) => {
      if (data) setOgFallback(data as IPreviewUrlResponse);
    });
    // bskyPost is a fresh object each render — depend on its primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientPreviewFallback,
    previewStatus.status,
    ogFallbackTried,
    twId,
    bskyPost?.actor,
    bskyPost?.rkey,
    isYt,
    directAudio,
    embedUrl,
  ]);

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
            size="300" radii="300" variant="SurfaceVariant"
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            aria-label="Dismiss embed"
            style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
          >
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
          {(() => {
            const imgs = allMedia.filter((m) => m.type === 'image' || m.type === 'photo');
            const vids = allMedia.filter((m) => m.type === 'video' || m.type === 'gif');
            return (
              <>
                {imgs.length > 0 && (
                  <Box direction="Row" gap="100" style={{ width: '100%', flexWrap: 'wrap' }}>
                    {imgs.map((m, i) => {
                      // 1 image: full width. 2+: 2-column grid that fills.
                      const basis = imgs.length === 1 ? '100%' : 'calc(50% - 2px)';
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
                            src={m.url}
                            alt={m.altText || vxData.text || ''}
                            title={m.altText || vxData.text}
                            onView={() => setViewerSrc(m.url)}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
                {vids.map((m, i) => (
                  <ProxiedVideo
                    key={i}
                    src={m.url}
                    poster={m.thumbnail_url}
                    isGif={m.type === 'gif'}
                    width={m.size?.width}
                    height={m.size?.height}
                    className={urlPreviewCss.UrlPreviewVideo}
                  />
                ))}
              </>
            );
          })()}
          <UrlPreviewContent>
            <Text style={linkStyles} truncate as="a" href={safeUrl} target="_blank" rel="noreferrer" size="T200" priority="300">
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
            size="300" radii="300" variant="SurfaceVariant"
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
            <HlsVideo
              src={videoView.playlist}
              poster={videoView.thumbnail}
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
              {externalView.title &&
                // `uri` is whatever the Bluesky API returned for an embed the
                // post author controls. Only link it when it is http(s) — in
                // the Tauri shell an href with any other scheme is forwarded to
                // the OS URL opener, i.e. it launches a local protocol handler.
                // Otherwise still show the title, just not as a link.
                (isWebUrl(externalView.uri) ? (
                  <Text size="T300" priority="500">
                    <a href={externalView.uri} target="_blank" rel="noreferrer" style={linkStyles}>
                      {externalView.title}
                    </a>
                  </Text>
                ) : (
                  <Text size="T300" priority="500">
                    {externalView.title}
                  </Text>
                ))}
              {externalView.description && (
                <Text size="T200" priority="300">{externalView.description}</Text>
              )}
            </Box>
          )}
          <UrlPreviewContent>
            <Text style={linkStyles} truncate as="a" href={safeUrl} target="_blank" rel="noreferrer" size="T200" priority="300">
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
  if (directAudio) {
    const audioSrc = directAudioEmbed ? embedUrl : url;
    return (
      <Box direction="Column" style={{ padding: config.space.S200 }} gap="100">
        {/* isAudioUrl only inspects the file extension, so the scheme still
            has to be checked before the value reaches a media element. */}
        {isWebUrl(audioSrc) && (
          <audio
            className={urlPreviewCss.UrlPreviewVideo}
            src={audioSrc}
            controls
            preload="metadata"
          />
        )}
        <Text size="T200" priority="300">
          <a
            href={safeUrl}
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
    : ogFallback;

  // Keep rendering nothing while a fallback fetch is still outstanding (status
  // is Error but we've opted in and haven't given up) so the card can appear
  // once the fallback resolves instead of being permanently suppressed.
  const fallbackPending =
    clientPreviewFallback &&
    previewStatus.status === AsyncStatus.Error &&
    !ogFallback &&
    !ogFallbackTried;

  // A link that IS the media plays without any preview data. A bare .mp4/.mp3
  // serves no HTML, so the homeserver has nothing to scrape and returns an
  // empty preview — which used to bail out here and render nothing at all.
  const isDirectMediaLink = isWebUrl(url) && (isVideoUrl(url) || isAudioUrl(url));

  if (
    !effectivePreview &&
    previewStatus.status !== AsyncStatus.Loading &&
    !fallbackPending &&
    !isDirectMediaLink
  ) {
    return null;
  }

  if (dismissed) return null;

  const renderContent = (prev: IPreviewUrlResponse) => {
    // Homeserver previews return og:image as an mxc:// URI (re-uploaded by the
    // server); the client-side fallback returns a direct http(s) URL. Pass the
    // latter through untouched — only mxc URIs need mxcUrlToHttp resolution.
    const rawOgImage = (prev['og:image'] as string) || '';
    // The client-side OG fallback returns whatever the linked page declared, and
    // that value is loaded directly as an <img src> from the attacker's host.
    // Parse it rather than prefix-matching `https?://`, so only a well-formed
    // http(s) URL takes the direct-image path; anything else falls through to
    // mxcUrlToHttp, which yields undefined for a non-mxc value and renders no
    // image at all.
    const isDirectImage = isWebUrl(rawOgImage);
    const thumbUrl = isDirectImage
      ? rawOgImage
      : mxcUrlToHttp(mx, rawOgImage, useAuthentication, 256, 256, 'scale', false);

    const imgUrl = isDirectImage
      ? rawOgImage
      : mxcUrlToHttp(mx, rawOgImage, useAuthentication, 512, 512, 'scale', false);

    // og:image is a poster, never the media. When the link itself is the file,
    // it is the only correct source — previously the <video> was pointed at
    // og:image, so a direct .mp4 got an empty src and silently rendered nothing.
    const directVideoUrl = isVideoUrl(url) && isWebUrl(url) ? url : '';
    const directAudioUrl = isAudioUrl(url) && isWebUrl(url) ? url : '';

    const title = prev['og:title'] as string | undefined;
    const description = prev['og:description'] as string | undefined;
    const siteName = prev['og:site_name'] as string | undefined;
    const isVideo = isVideoUrl(url) || (prev['og:type'] as string)?.startsWith('video');
    const isAudio = isAudioUrl(url) || (prev['og:type'] as string)?.startsWith('music');

    // Sites that ship a tiny favicon-style og:image (48×48, 64×64 logo) want
    // a text-only embed, not a card with an awkwardly-stretched icon. If both
    // declared dimensions are ≤ 96px we treat the image as decorative and
    // skip rendering it; the title/description/siteName cluster still shows.
    // Larger images (article hero shots, post media) render as before.
    const ogImageWidth = Number(prev['og:image:width']) || 0;
    const ogImageHeight = Number(prev['og:image:height']) || 0;
    const imageIsTinyFavicon =
      ogImageWidth > 0 && ogImageHeight > 0 &&
      ogImageWidth <= 96 && ogImageHeight <= 96;

    // og:video data (Bandcamp etc.). Split into two validated, mutually
    // exclusive shapes up front so neither sink can be reached with an
    // unvetted value:
    //  - bandcampEmbedUrl: a genuinely-parsed https bandcamp.com embed, the
    //    only thing allowed into an iframe here.
    //  - inlineOgVideoUrl: anything else, which must at least be http(s)
    //    before it reaches <video src> and the <a href> fallback inside it.
    // video.twimg.com stays excluded because it 403s on cross-origin requests.
    const ogVideoUrl = (prev['og:video'] || prev['og:video:url']) as string | undefined;
    const bandcampEmbedUrl = isBandcampEmbedUrl(ogVideoUrl) ? ogVideoUrl : undefined;
    const inlineOgVideoUrl =
      !bandcampEmbedUrl && isWebUrl(ogVideoUrl) && !/video\.twimg\.com/.test(ogVideoUrl)
        ? ogVideoUrl
        : undefined;
    // An og:video we rejected must not suppress the still image as well —
    // otherwise a bad value silently blanks the whole card.
    const hasOgVideo = !!(bandcampEmbedUrl || inlineOgVideoUrl);
    const ogVideoWidth = Number(prev['og:video:width']) || undefined;
    const ogVideoHeight = Number(prev['og:video:height']) || undefined;
    const ogVideoAspect = ogVideoWidth && ogVideoHeight
      ? `${ogVideoWidth} / ${ogVideoHeight}`
      : undefined;

    return (
      <Box grow="Yes" direction="Column" style={{ position: 'relative', minWidth: 0 }}>
        {/* Dismiss button */}
        <IconButton
          size="300"
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
                ? `${PIPED_EMBED_BASE}${ytVideoId}`
                : `${YOUTUBE_EMBED_BASE}${ytVideoId}`}
              title={title || 'YouTube video'}
              // This frame auto-loads for anyone who reads the message, so it
              // gets the narrowest sandbox that still plays video. Deliberately
              // absent: allow-top-navigation (would let the frame navigate this
              // window away) and allow-popups (would let it open new ones).
              sandbox="allow-scripts allow-same-origin allow-presentation"
              // Trimmed to what playback needs. clipboard-write in particular
              // has no business being delegated to an embed the message sender
              // chose; accelerometer/gyroscope are sensor access playback
              // doesn't require.
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </Box>
        )}

        {/* og:video embed (Bandcamp etc.) — see the validation above; both
            branches consume an already-vetted URL. */}
        {!isYt && bandcampEmbedUrl && (
          <iframe
            style={{ border: 0, width: '100%', height: '120px' }}
            src={bandcampEmbedUrl}
            title={title || 'Bandcamp'}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            seamless
            allowFullScreen
          />
        )}
        {!isYt && inlineOgVideoUrl && (
          <video
            className={urlPreviewCss.UrlPreviewVideo}
            src={inlineOgVideoUrl}
            controls
            preload="metadata"
            poster={imgUrl || undefined}
            style={ogVideoAspect ? { aspectRatio: ogVideoAspect } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <a href={inlineOgVideoUrl} target="_blank" rel="noreferrer">
              {title || 'Video'}
            </a>
          </video>
        )}

        {/* Direct video URL */}
        {!isYt && !hasOgVideo && isVideo && (directVideoUrl || imgUrl) && (
          <video
            className={urlPreviewCss.UrlPreviewVideo}
            src={directVideoUrl || imgUrl || undefined}
            poster={directVideoUrl && imgUrl ? imgUrl : undefined}
            controls
            preload="metadata"
            style={ogVideoAspect ? { aspectRatio: ogVideoAspect } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <a href={directVideoUrl || imgUrl || undefined} target="_blank" rel="noreferrer">
              {title || 'Video'}
            </a>
          </video>
        )}

        {/* Audio embed */}
        {isAudio && (directAudioUrl || imgUrl) && (
          <audio
            className={urlPreviewCss.UrlPreviewVideo}
            src={directAudioUrl || imgUrl || undefined}
            controls
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={directAudioUrl || imgUrl || undefined} target="_blank" rel="noreferrer">
              {title || 'Audio'}
            </a>
          </audio>
        )}

        {/* Preview image (only if no video/audio player showing and the
            image isn't a tiny favicon-style icon). */}
        {!isYt && !hasOgVideo && !isVideo && !isAudio && thumbUrl && !imageIsTinyFavicon && (
          <UrlPreviewImg
            src={thumbUrl}
            alt={title || ''}
            title={title}
            tabIndex={0}
            onKeyDown={(evt) => onEnterOrSpace(() => setViewerSrc(imgUrl ?? undefined))(evt)}
            onClick={() => setViewerSrc(imgUrl ?? undefined)}
          />
        )}

        <UrlPreviewContent>
          <Text
            style={linkStyles}
            truncate
            as="a"
            href={safeUrl}
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
              href={safeUrl}
              target="_blank"
              rel="noreferrer"
              size="T300"
              truncate={!expanded}
            >
              {title}
            </Text>
          )}
          {/* Description — shown in full up to 100 words; longer ones collapse
              behind a Show all toggle. (Replaces the old og: metadata dump that
              used to live behind this button.) */}
          {description &&
            (() => {
              const words = description.trim().split(/\s+/);
              const isLong = words.length > 100;
              const shown =
                isLong && !expanded ? `${words.slice(0, 100).join(' ')}…` : description;
              return (
                <>
                  <Text size="T200" priority="300" style={{ whiteSpace: 'pre-wrap' }}>
                    {shown}
                  </Text>
                  {isLong && (
                    <Button
                      variant="Secondary"
                      fill="Soft"
                      size="300"
                      radii="300"
                      onClick={() => setExpanded(!expanded)}
                    >
                      <Text size="B300">{expanded ? 'Show less' : 'Show all'}</Text>
                    </Button>
                  )}
                </>
              );
            })()}
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
      {effectivePreview || isDirectMediaLink ? (
        // A direct media link renders from the URL alone, so an absent preview
        // is fine — without this it sat on the spinner forever waiting for
        // metadata a raw .mp4 will never provide.
        renderContent((effectivePreview ?? {}) as IPreviewUrlResponse)
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
        <Box shrink="No" alignItems="Center" className={css.UrlPreviewHolderInner}>
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
          <Box alignItems="Inherit" gap="200" className={css.UrlPreviewHolderRow}>
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
