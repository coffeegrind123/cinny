import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const CategoryButton = style({
  flexGrow: 1,
});

export const DmStatus = style({
  transform: `translateY(calc(-1 * ${config.space.S100}))`,
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

export const CallNavItemMember = style({
  width: '100%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: `${config.space.S100} ${config.space.S200}`,
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  borderRadius: config.radii.R300,
  selectors: {
    '&:hover': {
      backgroundColor: color.Background.ContainerHover,
    },
  },
});

export const SortableNavItem = style({
  position: 'relative',
  cursor: 'grab',
  selectors: {
    '&[data-dragging=true]': {
      opacity: config.opacity.P500,
    },
    '&[data-drop-target=before]::before': {
      content: '',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      borderTop: `${config.borderWidth.B300} solid ${color.Success.Main}`,
    },
  },
});
