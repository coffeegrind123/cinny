import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const Keyboard = style({
  marginTop: config.space.S200,
});

export const Row = style({
  display: 'flex',
  gap: config.space.S100,
  // Buttons share a row evenly, as they do on Telegram, and wrap rather than
  // overflow when a row is too wide for a narrow window.
  flexWrap: 'wrap',
});

export const Button = style([
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
      '&:disabled': {
        cursor: 'not-allowed',
        opacity: 0.5,
      },
    },
  },
]);

export const ButtonPrimary = style({
  borderColor: color.Primary.Main,
  backgroundColor: color.Primary.Container,
  color: color.Primary.OnContainer,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: color.Primary.ContainerHover,
    },
    '&:active:not(:disabled)': {
      backgroundColor: color.Primary.ContainerActive,
    },
  },
});

export const ButtonDanger = style({
  borderColor: color.Critical.Main,
  backgroundColor: color.Critical.Container,
  color: color.Critical.OnContainer,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: color.Critical.ContainerHover,
    },
    '&:active:not(:disabled)': {
      backgroundColor: color.Critical.ContainerActive,
    },
  },
});

/** Keeps the label from jumping when the spinner replaces the icon. */
export const ButtonInner = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S100,
});

/**
 * The answer line, shown under the keyboard rather than as a floating toast.
 *
 * A toast puts the bot's reply in a corner of the screen, away from the button
 * that caused it, and disappears whether or not it was read. Under the buttons
 * it stays put and stays legible.
 */
export const Answer = style({
  marginTop: config.space.S200,
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const AnswerCritical = style({
  backgroundColor: color.Critical.Container,
  color: color.Critical.OnContainer,
});
