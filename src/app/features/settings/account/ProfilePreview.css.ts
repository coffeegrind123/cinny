import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const ProfilePage = style({
  containerType: 'inline-size',
});

export const ProfileLayout = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: config.space.S500,
  '@container': {
    '(min-width: 760px)': {
      gridTemplateColumns: `${toRem(300)} minmax(0, 1fr)`,
      alignItems: 'start',
    },
  },
});

export const PreviewColumn = style({
  minWidth: 0,
  '@container': {
    '(min-width: 760px)': {
      position: 'sticky',
      top: config.space.S400,
    },
  },
});

export const ProfileCard = style({
  overflow: 'hidden',
  borderRadius: config.radii.R500,
  color: color.Surface.OnContainer,
  backgroundColor: color.Surface.Container,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const EditorColumn = style({
  minWidth: 0,
});
