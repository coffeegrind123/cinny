import { globalStyle, style } from '@vanilla-extract/css';
import { config } from 'folds';

export const SequenceCardStyle = style({
  padding: config.space.S300,
});

// On mobile the settings menu is the full-screen page (the nav spans the
// viewport). Make each menu item fill that width and centre its icon+label
// group so the list reads as a centered, full-width menu rather than a narrow
// left-aligned sidebar list.
export const SettingsMobileMenu = style({});
globalStyle(`${SettingsMobileMenu} > button`, {
  '@media': {
    'screen and (max-width: 640px)': {
      width: '100%',
      justifyContent: 'center',
    },
  },
});
