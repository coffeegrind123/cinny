import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const UrlPreview = style([
  DefaultReset,
  {
    maxWidth: toRem(432),
    minHeight: toRem(80),
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderLeft: `4px solid ${color.Success.Main}`,
    borderRadius: config.radii.R200,
    overflow: 'hidden',
  },
]);

export const UrlPreviewContent = style([
  DefaultReset,
  {
    padding: `${config.space.S100} ${config.space.S300} ${config.space.S200} ${config.space.S300}`,
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S100,
  },
]);

export const UrlPreviewImg = style([
  DefaultReset,
  {
    width: '100%',
    maxHeight: toRem(300),
    objectFit: 'cover',
    objectPosition: 'center',
    cursor: 'pointer',
    display: 'block',
    borderRadius: `${config.radii.R200} ${config.radii.R200} 0 0`,
  },
]);

export const UrlPreviewImgInside = style([
  DefaultReset,
  {
    width: toRem(80),
    height: toRem(80),
    objectFit: 'cover',
    objectPosition: 'center',
    borderRadius: config.radii.R200,
    flexShrink: 0,
    cursor: 'pointer',
  },
]);

export const UrlPreviewDescription = style([
  DefaultReset,
  {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
]);

export const UrlPreviewVideo = style([
  DefaultReset,
  {
    width: '100%',
    height: 'auto',
    maxHeight: '70vh',
    objectFit: 'contain',
    backgroundColor: 'black',
    borderRadius: `${config.radii.R200} ${config.radii.R200} 0 0`,
    display: 'block',
  },
]);
