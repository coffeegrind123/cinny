import { style } from '@vanilla-extract/css';
import { DefaultReset } from 'folds';

export const Image = style([
  DefaultReset,
  {
    // `contain`, not `cover`: the container is now sized to the image's own
    // aspect ratio (see MImage), so there is nothing to crop — and `cover`
    // cropped whenever the two disagreed even slightly.
    objectFit: 'contain',
    width: '100%',
    height: '100%',
  },
]);

export const Video = style([
  DefaultReset,
  {
    objectFit: 'contain',
    width: '100%',
    height: '100%',
  },
]);
