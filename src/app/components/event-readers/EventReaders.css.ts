import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';

export const EventReaders = style([
  DefaultReset,
  {
    // Size to the number of readers rather than always filling the modal.
    // `height: 100%` meant three people and thirty produced the same tall box,
    // most of it empty. `maxHeight` lets the flex column shrink to its content
    // while still capping at the viewport so a busy room stays scrollable.
    maxHeight: '100%',
    // Keeps a one-line list from collapsing to something cramped.
    minHeight: 0,
  },
]);

export const Header = style({
  paddingLeft: config.space.S400,
  paddingRight: config.space.S300,

  flexShrink: 0,
});

export const Content = style({
  paddingLeft: config.space.S200,
  paddingBottom: config.space.S400,
});
