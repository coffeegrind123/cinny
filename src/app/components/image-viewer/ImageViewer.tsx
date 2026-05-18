import React from 'react';
import FileSaver from 'file-saver';
import classNames from 'classnames';
import { Box, Chip, Icon, IconButton, Icons, Text, as, config } from 'folds';
import * as css from './ImageViewer.css';
import { useZoom } from '../../hooks/useZoom';
import { usePan } from '../../hooks/usePan';
import { downloadMedia } from '../../utils/matrix';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';

export type ImageViewerProps = {
  alt: string;
  src: string;
  requestClose: () => void;
  // Preferred target for the "open in browser" button. When the viewer is
  // showing an embed preview image, `src` is the raw media URL (often a
  // blob: or pbs.twimg.com URL the browser can't usefully open in a tab),
  // so we open the original page/post instead.
  externalUrl?: string;
};

export const ImageViewer = as<'div', ImageViewerProps>(
  ({ className, alt, src, requestClose, externalUrl, ...props }, ref) => {
    const { zoom, zoomIn, zoomOut, setZoom } = useZoom(0.2);
    const { pan, cursor, onMouseDown } = usePan(zoom !== 1);
    const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
    // Pinch-zoom state for touch devices. Tracks the initial distance and
    // zoom level at the start of a two-finger gesture so subsequent
    // touchmove deltas scale relative to the gesture origin.
    const pinchRef = React.useRef<{ baseDist: number; baseZoom: number } | null>(null);

    const handleDownload = async () => {
      const fileContent = await downloadMedia(src);
      FileSaver.saveAs(fileContent, alt);
    };

    // Click/tap zoom is desktop-only. On mobile the same gesture
    // double-fires (tap → click → tap) and the explicit +/- buttons +
    // pinch handle zoom intent without ambiguity.
    const handleImageClick = isMobile
      ? undefined
      : () => setZoom(zoom === 1 ? 2 : 1);

    const handleTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
      if (e.touches.length !== 2) return;
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      pinchRef.current = { baseDist: Math.hypot(dx, dy), baseZoom: zoom };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLImageElement>) => {
      if (!pinchRef.current || e.touches.length !== 2) return;
      // preventDefault to suppress the browser's native page pinch-zoom.
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.baseDist;
      const next = pinchRef.current.baseZoom * ratio;
      // Mirror useZoom's bounds (min 0.1, max 5).
      setZoom(Math.max(0.1, Math.min(5, next)));
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLImageElement>) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    const handleOpenExternal = () => {
      window.open(externalUrl || src, '_blank', 'noopener,noreferrer');
    };

    const zoomCursor = zoom === 1 ? 'zoom-in' : 'zoom-out';

    // On mobile, both control rows go full-width — controls (zoom/download)
    // stay at the top, title/back/external moves to the bottom for thumb
    // reachability.
    const navBarPos = isMobile
      ? {
          position: 'fixed' as const,
          bottom: `calc(${config.space.S200} + env(safe-area-inset-bottom))`,
          left: `calc(${config.space.S200} + env(safe-area-inset-left))`,
          right: `calc(${config.space.S200} + env(safe-area-inset-right))`,
          zIndex: 2,
        }
      : {
          position: 'fixed' as const,
          top: `calc(${config.space.S200} + env(safe-area-inset-top))`,
          left: `calc(${config.space.S200} + env(safe-area-inset-left))`,
          zIndex: 2,
        };
    const toolsBarPos = isMobile
      ? {
          position: 'fixed' as const,
          top: `calc(${config.space.S200} + env(safe-area-inset-top))`,
          left: `calc(${config.space.S200} + env(safe-area-inset-left))`,
          right: `calc(${config.space.S200} + env(safe-area-inset-right))`,
          zIndex: 2,
        }
      : {
          position: 'fixed' as const,
          top: `calc(${config.space.S200} + env(safe-area-inset-top))`,
          right: `calc(${config.space.S200} + env(safe-area-inset-right))`,
          zIndex: 2,
        };

    return (
      <Box
        className={classNames(css.ImageViewer, className)}
        {...props}
        ref={ref}
      >
        <Box style={navBarPos}>
          <Box
            className={css.ImageViewerBarGroup}
            alignItems="Center"
            gap="100"
            justifyContent={isMobile ? 'SpaceBetween' : undefined}
            style={isMobile ? { width: '100%' } : { maxWidth: 'min(60vw, 600px)' }}
          >
            <IconButton size="300" radii="300" onClick={requestClose}>
              <Icon size="50" src={Icons.ArrowLeft} />
            </IconButton>
            <Text size="T300" truncate style={{ flex: 1, minWidth: 0 }}>
              {alt}
            </Text>
            <IconButton size="200" radii="300" onClick={handleOpenExternal} aria-label="Open in browser">
              <Icon size="50" src={Icons.External} />
            </IconButton>
          </Box>
        </Box>
        <Box style={toolsBarPos}>
          <Box
            className={css.ImageViewerBarGroup}
            alignItems="Center"
            gap="100"
            justifyContent={isMobile ? 'SpaceBetween' : undefined}
            style={isMobile ? { width: '100%' } : undefined}
          >
            <IconButton
              variant={zoom < 1 ? 'Success' : 'SurfaceVariant'}
              outlined={zoom < 1}
              size="300"
              radii="Pill"
              onClick={zoomOut}
              aria-label="Zoom Out"
            >
              <Icon size="50" src={Icons.Minus} />
            </IconButton>
            <Chip variant="SurfaceVariant" radii="Pill" onClick={handleImageClick}>
              <Text size="B300">{Math.round(zoom * 100)}%</Text>
            </Chip>
            <IconButton
              variant={zoom > 1 ? 'Success' : 'SurfaceVariant'}
              outlined={zoom > 1}
              size="300"
              radii="Pill"
              onClick={zoomIn}
              aria-label="Zoom In"
            >
              <Icon size="50" src={Icons.Plus} />
            </IconButton>
            <Chip
              variant="Primary"
              onClick={handleDownload}
              radii="300"
              before={<Icon size="50" src={Icons.Download} />}
            >
              <Text size="B300">Download</Text>
            </Chip>
          </Box>
        </Box>
        <img
          className={css.ImageViewerImg}
          style={{
            cursor: zoomCursor,
            transform: `scale(${zoom}) translate(${pan.translateX}px, ${pan.translateY}px)`,
            // Disable browser's native double-tap-zoom + pinch-zoom so our
            // gesture handlers own the interaction on touch devices.
            touchAction: isMobile ? 'none' : undefined,
          }}
          src={src}
          alt={alt}
          onClick={handleImageClick}
          onMouseDown={onMouseDown}
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          onTouchCancel={isMobile ? handleTouchEnd : undefined}
        />
      </Box>
    );
  }
);
