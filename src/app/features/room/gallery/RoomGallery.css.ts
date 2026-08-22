import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const GalleryBar = style([
  DefaultReset,
  {
    padding: `${config.space.S200} ${config.space.S400}`,
    borderBottom: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
  },
]);

export const GalleryContent = style([
  DefaultReset,
  {
    padding: config.space.S400,
    paddingBottom: config.space.S700,
  },
]);

export const GalleryDateHeader = style([
  DefaultReset,
  {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: `${config.space.S200} 0`,
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
  },
]);

export const GalleryGrid = style([
  DefaultReset,
  {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${toRem(112)}, 1fr))`,
    gap: config.space.S100,
  },
]);

export const GalleryTile = style([
  DefaultReset,
  {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: '1 / 1',
    padding: 0,
    border: 'none',
    borderRadius: config.radii.R400,
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,

    selectors: {
      '&:hover, &:focus-visible': {
        outline: `${config.borderWidth.B600} solid ${color.Primary.Main}`,
        outlineOffset: toRem(-2),
      },
    },
  },
]);

export const GalleryTileMedia = style([
  DefaultReset,
  {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    transition: 'transform 200ms ease',

    selectors: {
      [`${GalleryTile}:hover &`]: {
        transform: 'scale(1.04)',
      },
    },
  },
]);

export const GalleryTileBlur = style([
  DefaultReset,
  {
    filter: 'blur(24px)',
  },
]);

export const GalleryTileFooter = style([
  DefaultReset,
  {
    position: 'absolute',
    left: config.space.S100,
    right: config.space.S100,
    bottom: config.space.S100,
    pointerEvents: 'none',
  },
]);

export const GalleryTileHeader = style([
  DefaultReset,
  {
    position: 'absolute',
    left: config.space.S100,
    top: config.space.S100,
    pointerEvents: 'none',
  },
]);

export const GalleryTilePill = style([
  DefaultReset,
  {
    display: 'inline-flex',
    alignItems: 'center',
    gap: toRem(2),
    padding: `${toRem(1)} ${toRem(6)}`,
    borderRadius: config.radii.R400,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    color: 'white',
  },
]);

export const GalleryTileCenter = style([
  DefaultReset,
  {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
]);

export const GallerySentinel = style([
  DefaultReset,
  {
    padding: config.space.S500,
  },
]);
