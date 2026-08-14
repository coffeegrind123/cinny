import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const CategoryButton = style({
  flexGrow: 1,
});
export const CategoryButtonIcon = style({
  opacity: config.opacity.P400,
});

// Matches the horizontal inset a Chip gives CategoryButton, so a nav with a
// plain label lines up with one that has a collapse chevron.
export const CategoryLabel = style({
  padding: `0 ${config.space.S200}`,
  minWidth: 0,
});
