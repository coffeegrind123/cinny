import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const ImageViewer = style([
  DefaultReset,
  {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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
    overflow: 'hidden',
  },
]);

export const ImageViewerImg = style([
  DefaultReset,
  {
    display: 'block',
    maxWidth: '80vw',
    maxHeight: '80vh',
    transition: 'transform 100ms linear',
    cursor: 'zoom-in',
    userSelect: 'none',
  },
]);
