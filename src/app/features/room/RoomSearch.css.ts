import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const RoomSearch = style({
  height: '100%',
  minWidth: 0,
});

export const RoomSearchHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const RoomSearchContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});

export const RoomSearchContent = style({
  padding: config.space.S300,
  // No min-width. This used to carry `minWidth: 280rem-ish` so message cards
  // had room inside a narrow desktop side panel, but this whole view is now
  // rendered only below the desktop breakpoint (see Room.tsx), where it is a
  // full-screen overlay. There the floor does nothing except push the content
  // wider than a small phone's viewport and force sideways scrolling.
  minWidth: 0,
});
