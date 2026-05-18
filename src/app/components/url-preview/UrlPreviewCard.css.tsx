import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, toRem } from 'folds';

// On narrow viewports (mobile) the URL preview holder normally renders as a
// horizontal scroller of fixed-width cards. The scroller's inner Box is
// `shrink="No"`, which forces the user to drag horizontally inside the
// embed when the card is wider than the message column. Stack the cards
// vertically on mobile so each card fits the column width.
export const UrlPreviewHolderInner = style({
  '@media': {
    '(max-width: 640px)': {
      flexDirection: 'column',
      width: '100%',
      alignItems: 'stretch',
    },
  },
});

export const UrlPreviewHolderRow = style({
  '@media': {
    '(max-width: 640px)': {
      flexDirection: 'column',
      width: '100%',
      alignItems: 'stretch',
    },
  },
});

export const UrlPreviewHolderGradient = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      height: '100%',
      width: toRem(10),
      zIndex: 1,
    },
  ],
  variants: {
    position: {
      Left: {
        left: 0,
        background: `linear-gradient(to right,${color.Surface.Container} , rgba(116,116,116,0))`,
      },
      Right: {
        right: 0,
        background: `linear-gradient(to left,${color.Surface.Container} , rgba(116,116,116,0))`,
      },
    },
  },
});
export const UrlPreviewHolderBtn = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      zIndex: 1,
    },
  ],
  variants: {
    position: {
      Left: {
        left: 0,
        transform: 'translateX(-25%)',
      },
      Right: {
        right: 0,
        transform: 'translateX(25%)',
      },
    },
  },
});
