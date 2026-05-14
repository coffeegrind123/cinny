import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const ImageViewer = style([
  DefaultReset,
  {
    height: '100%',
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
]);

export const ImageViewerTopBar = style([
  DefaultReset,
  {
    position: 'absolute',
    top: config.space.S200,
    left: config.space.S200,
    right: config.space.S200,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: config.space.S200,
    zIndex: 1,
    pointerEvents: 'none',
    flexShrink: 0,
  },
]);

export const ImageViewerBarGroup = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: config.space.S200,
    padding: `6px ${config.space.S300}`,
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    borderRadius: config.radii.R400,
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
    border: `1px solid ${color.Surface.ContainerLine}`,
    pointerEvents: 'auto',
    maxWidth: '50%',
    overflow: 'hidden',
  },
]);

export const ImageViewerContent = style([
  DefaultReset,
  {
    overflow: 'hidden',
    flex: 1,
  },
]);

export const ImageViewerImg = style([
  DefaultReset,
  {
    objectFit: 'contain',
    width: 'auto',
    height: 'auto',
    maxWidth: '100%',
    maxHeight: '100%',
    transition: 'transform 100ms linear',
  },
]);
