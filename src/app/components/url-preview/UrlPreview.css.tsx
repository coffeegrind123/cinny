import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const UrlPreview = style([
  DefaultReset,
  {
    // ~50% of the previous 432 — Discord-style compact embeds. Portrait videos
    // (9:16) then land around 180×320 instead of filling the message column.
    maxWidth: toRem(216),
    minHeight: toRem(80),
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderLeft: `4px solid ${color.Success.Main}`,
    borderRadius: config.radii.R200,
    overflow: 'hidden',
    cursor: 'pointer',

    ':hover': {
      filter: 'brightness(0.8)',
    },

    '@media': {
      '(max-width: 640px)': {
        maxWidth: '100%',
        width: '100%',
        minWidth: 0,
      },
    },
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
    // Cap tall/portrait clips so they stay compact (Discord-like). Combined
    // with the 216px card width, 9:16 videos render around 180×320.
    maxHeight: toRem(320),
    objectFit: 'contain',
    backgroundColor: 'black',
    borderRadius: `${config.radii.R200} ${config.radii.R200} 0 0`,
    display: 'block',
  },
]);
