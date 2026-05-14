import React from 'react';
import FileSaver from 'file-saver';
import classNames from 'classnames';
import { Box, Chip, Icon, IconButton, Icons, Text, as, config } from 'folds';
import * as css from './ImageViewer.css';
import { useZoom } from '../../hooks/useZoom';
import { usePan } from '../../hooks/usePan';
import { downloadMedia } from '../../utils/matrix';

export type ImageViewerProps = {
  alt: string;
  src: string;
  requestClose: () => void;
};

export const ImageViewer = as<'div', ImageViewerProps>(
  ({ className, alt, src, requestClose, ...props }, ref) => {
    const { zoom, zoomIn, zoomOut, setZoom } = useZoom(0.2);
    const { pan, cursor, onMouseDown } = usePan(zoom !== 1);

    const handleDownload = async () => {
      const fileContent = await downloadMedia(src);
      FileSaver.saveAs(fileContent, alt);
    };

    const handleImageClick = () => {
      setZoom(zoom === 1 ? 2 : 1);
    };

    const handleOpenExternal = () => {
      window.open(src, '_blank', 'noopener,noreferrer');
    };

    const zoomCursor = zoom === 1 ? 'zoom-in' : 'zoom-out';

    return (
      <Box
        className={classNames(css.ImageViewer, className)}
        {...props}
        ref={ref}
      >
        <Box
          style={{
            position: 'fixed',
            top: config.space.S200,
            left: config.space.S200,
            zIndex: 2,
          }}
        >
          <Box className={css.ImageViewerBarGroup} alignItems="Center" gap="100">
            <IconButton size="300" radii="300" onClick={requestClose}>
              <Icon size="50" src={Icons.ArrowLeft} />
            </IconButton>
            <Text size="T300" truncate>
              {alt}
            </Text>
            <IconButton size="200" radii="300" onClick={handleOpenExternal} aria-label="Open in browser">
              <Icon size="50" src={Icons.External} />
            </IconButton>
          </Box>
        </Box>
        <Box
          style={{
            position: 'fixed',
            top: config.space.S200,
            right: config.space.S200,
            zIndex: 2,
          }}
        >
          <Box className={css.ImageViewerBarGroup} alignItems="Center" gap="100">
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
          }}
          src={src}
          alt={alt}
          onClick={handleImageClick}
          onMouseDown={onMouseDown}
        />
      </Box>
    );
  }
);
