import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const Waveform = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    width: '100%',
    height: config.size.X400,
    minWidth: 0,
  },
]);

export const WaveformSeekable = style({
  cursor: 'pointer',
  // Dragging across the bars is a seek, not a text selection.
  userSelect: 'none',
  touchAction: 'none',
});

export const WaveformBar = style([
  DefaultReset,
  {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '2px',
    borderRadius: config.radii.R300,
    backgroundColor: color.SurfaceVariant.ContainerLine,
    transition: 'background-color 100ms ease-in-out',
  },
]);

export const WaveformBarFilled = style({
  backgroundColor: color.Primary.Main,
});
