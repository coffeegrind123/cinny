import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const Bar = style({
  padding: `${config.space.S200} ${config.space.S300} 0`,
});

export const Row = style({
  display: 'flex',
  gap: config.space.S100,
  flexWrap: 'wrap',
});

export const Key = style([
  DefaultReset,
  {
    flex: '1 1 auto',
    minWidth: toRem(72),
    minHeight: toRem(32),
    padding: `${config.space.S100} ${config.space.S200}`,
    borderRadius: config.radii.R300,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    cursor: 'pointer',
    textAlign: 'center',
    selectors: {
      '&:hover:not(:disabled)': {
        backgroundColor: color.SurfaceVariant.ContainerHover,
      },
      '&:active:not(:disabled)': {
        backgroundColor: color.SurfaceVariant.ContainerActive,
      },
    },
  },
]);

/**
 * `resize_keyboard: false` keeps every key the same generous width, matching
 * Telegram's default where keys fill the row regardless of label length.
 */
export const KeyFixed = style({
  flex: '1 1 0',
});
