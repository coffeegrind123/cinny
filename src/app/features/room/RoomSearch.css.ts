import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

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
  // Wide enough for message cards to breathe inside a narrow side panel.
  minWidth: toRem(280),
});
