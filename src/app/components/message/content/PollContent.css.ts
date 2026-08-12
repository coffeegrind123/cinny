import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const PollOption = style([
  DefaultReset,
  {
    position: 'relative',
    display: 'block',
    width: '100%',
    padding: config.space.S200,
    borderRadius: config.radii.R300,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'start',
    overflow: 'hidden',
    selectors: {
      '&:disabled': {
        cursor: 'default',
      },
    },
  },
]);

export const PollOptionSelected = style({
  borderColor: color.Primary.Main,
});

export const PollOptionWinner = style({
  borderColor: color.Success.Main,
});

/** Fills behind the label to show the share of the vote. */
export const PollOptionBar = style([
  DefaultReset,
  {
    position: 'absolute',
    inset: 0,
    transformOrigin: 'left',
    backgroundColor: color.SurfaceVariant.ContainerActive,
    transition: 'transform 200ms ease-in-out',
    pointerEvents: 'none',
  },
]);

export const PollOptionContent = style({
  position: 'relative',
});
