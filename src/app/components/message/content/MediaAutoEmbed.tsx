import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, Tooltip, TooltipProvider, toRem } from 'folds';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useObjectURL } from '../../../hooks/useObjectURL';
import { fitWithin } from '../../../utils/common';
import { onEnterOrSpace } from '../../../utils/keyboard';
import { ImageOverlay } from '../../ImageOverlay';
import { ImageViewer } from '../../image-viewer';
import { Image, Video } from '../../media';
import { Attachment, AttachmentBox } from '../attachment';
import * as css from './style.css';

const MEDIA_ACCEPT = 'image/*, video/*';
const MAX_WIDTH = 400;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 300;

type EmbeddableMedia = {
  blob: Blob;
  kind: 'image' | 'video';
};

const fetchEmbeddableMedia = async (url: string): Promise<EmbeddableMedia> => {
  const response = await fetch(url, {
    headers: {
      Accept: MEDIA_ACCEPT,
    },
  });
  if (!response.ok) throw new Error(`Failed to load media: ${response.status}`);

  const blob = await response.blob();
  if (blob.type.startsWith('image/')) return { blob, kind: 'image' };
  if (blob.type.startsWith('video/')) return { blob, kind: 'video' };
  throw new Error(`Unsupported media type: ${blob.type || 'unknown'}`);
};

export type MediaAutoEmbedProps = {
  url: string;
  autoLoad?: boolean;
};

export function MediaAutoEmbed({ url, autoLoad = true }: MediaAutoEmbedProps) {
  const [viewer, setViewer] = useState(false);
  const [width, setWidth] = useState(MAX_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [mediaState, loadMedia] = useAsyncCallback(
    useCallback(() => fetchEmbeddableMedia(url), [url]),
  );
  const mediaUrl = useObjectURL(
    mediaState.status === AsyncStatus.Success ? mediaState.data.blob : undefined,
  );

  useEffect(() => {
    if (autoLoad) loadMedia().catch(() => undefined);
  }, [autoLoad, loadMedia]);

  const updateDimensions = (mediaWidth: number, mediaHeight: number) => {
    if (!mediaWidth || !mediaHeight) return;
    const [nextWidth, nextHeight] = fitWithin(mediaWidth, mediaHeight, MAX_WIDTH, MAX_HEIGHT);
    setWidth(Math.max(nextWidth, 48));
    setHeight(Math.max(nextHeight, 48));
  };

  const handleRetry = () => loadMedia().catch(() => undefined);
  const loading = mediaState.status === AsyncStatus.Loading;
  const failed = mediaState.status === AsyncStatus.Error;
  const idle = mediaState.status === AsyncStatus.Idle;

  return (
    <Attachment style={{ width: toRem(width) }}>
      <AttachmentBox style={{ width: toRem(width), height: toRem(height) }}>
        <Box className={css.RelativeBase}>
          {mediaState.status === AsyncStatus.Success && mediaUrl && (
            <Box className={css.AbsoluteContainer}>
              {mediaState.data.kind === 'image' ? (
                <>
                  <Image
                    src={mediaUrl}
                    alt="Embedded image"
                    title={url}
                    loading="lazy"
                    tabIndex={0}
                    onLoad={(event) =>
                      updateDimensions(
                        event.currentTarget.naturalWidth,
                        event.currentTarget.naturalHeight,
                      )
                    }
                    onKeyDown={(event) => onEnterOrSpace(() => setViewer(true))(event)}
                    onClick={() => setViewer(true)}
                  />
                  <ImageOverlay
                    src={mediaUrl}
                    alt="Embedded image"
                    viewer={viewer}
                    requestClose={() => setViewer(false)}
                    renderViewer={(props) => <ImageViewer {...props} />}
                  />
                </>
              ) : (
                <Video
                  src={mediaUrl}
                  title={url}
                  aria-label="Embedded video"
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) =>
                    updateDimensions(
                      event.currentTarget.videoWidth,
                      event.currentTarget.videoHeight,
                    )
                  }
                />
              )}
            </Box>
          )}
          {loading && (
            <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
              <Spinner variant="Secondary" />
            </Box>
          )}
          {idle && (
            <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
              <Button
                variant="Secondary"
                fill="Solid"
                radii="300"
                size="300"
                onClick={handleRetry}
                before={<Icon size="Inherit" src={Icons.Play} filled />}
              >
                <Text size="B300">Load media</Text>
              </Button>
            </Box>
          )}
          {failed && (
            <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
              <TooltipProvider
                tooltip={
                  <Tooltip variant="Critical">
                    <Text>Failed to load media!</Text>
                  </Tooltip>
                }
                position="Top"
                align="Center"
              >
                {(triggerRef) => (
                  <Button
                    ref={triggerRef}
                    size="300"
                    variant="Critical"
                    fill="Soft"
                    outlined
                    radii="300"
                    onClick={handleRetry}
                    before={<Icon size="Inherit" src={Icons.Warning} filled />}
                  >
                    <Text size="B300">Retry</Text>
                  </Button>
                )}
              </TooltipProvider>
            </Box>
          )}
        </Box>
      </AttachmentBox>
    </Attachment>
  );
}
