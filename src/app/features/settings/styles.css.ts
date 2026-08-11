import { globalStyle, style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const SequenceCardStyle = style({
  padding: config.space.S300,
});

// On mobile the settings menu is the full-screen page (the nav spans the
// viewport). Make each menu item fill that width and centre its icon+label
// group so the list reads as a centered, full-width menu rather than a narrow
// left-aligned sidebar list.
//
// This element sits directly inside the Scroll, in the same position
// PageNavContent's own div normally occupies, and repeats that padding. That
// position is what makes `minHeight: 100%` resolve — the scroll viewport above
// it has a definite height — which in turn is what lets the mobile rule below
// centre the list vertically instead of leaving it stuck to the top of a tall,
// mostly-empty screen. Nested one level deeper (inside PageNavContent) the
// percentage has no definite height to resolve against and the centring
// silently does nothing.
export const SettingsMobileMenu = style({
  minHeight: '100%',
  boxSizing: 'border-box',
  padding: config.space.S200,
  paddingRight: 0,
  paddingBottom: config.space.S700,
  '@media': {
    'screen and (max-width: 640px)': {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      // Spread the entries out. On a phone this list is the whole screen with
      // room to spare, and packed at desktop density the rows sit close enough
      // that a thumb can easily catch the neighbouring one.
      gap: config.space.S200,
      paddingLeft: config.space.S300,
      paddingRight: config.space.S300,
      // The tall bottom padding exists to keep the last item clear of the
      // desktop nav's edge. Centring makes it an asymmetry instead, pushing
      // the group visibly above true centre.
      paddingBottom: config.space.S200,
    },
  },
});
globalStyle(`${SettingsMobileMenu} > button`, {
  '@media': {
    'screen and (max-width: 640px)': {
      width: '100%',
      justifyContent: 'center',
      // Comfortably past the ~44px minimum touch target, which the default
      // row height sits under once the list is this sparse.
      minHeight: toRem(52),
    },
  },
});
