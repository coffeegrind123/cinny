import { globalStyle } from '@vanilla-extract/css';
import { color } from 'folds';

// The <body> reserves the device safe-area insets as padding (see index.css).
// That padding region shows the body's own background; without an explicit
// background it fell through to the <html> element's near-black colour, so the
// notch / home-indicator bars read as black. ThemeManager applies the active
// folds theme class to <body>, which defines this colour token, so painting
// the body with it makes the safe-area bars match the app's grey surface
// instead of black — and it follows theme changes automatically.
globalStyle('body', {
  backgroundColor: color.Surface.Container,
});
