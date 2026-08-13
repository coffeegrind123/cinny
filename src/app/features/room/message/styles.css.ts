import { style } from '@vanilla-extract/css';
import { DefaultReset, config, toRem } from 'folds';
import {
  OPTIONS_GUTTER,
  OPTIONS_GUTTER_QUERY,
} from '../../../components/message/layout/layout.css';

export const MessageBase = style({
  position: 'relative',
});

export const MessageReplyHighlight = style({
  background: 'hsla(39, 100%, 46%, 0.08)',
  borderLeft: '2px solid hsl(39, 100%, 46%)',
});

export const MessageBaseBubbleCollapsed = style({
  paddingTop: 0,
});

export const MessageOptionsBase = style([
  DefaultReset,
  {
    position: 'absolute',
    top: toRem(-30),
    // Pulled out into the gutter that MessageBase reserves, so the bar no longer
    // overlaps the previous message's right-hand side. It used to sit at
    // `right: 0`, i.e. on top of that message, where a pointer-down landed on a
    // button instead of the text and the selection re-anchored to the left. See
    // OPTIONS_GUTTER in components/message/layout/layout.css.ts for the full
    // account and the measurements — keep the two values in step.
    right: 0,
    zIndex: 1,
    '@media': {
      [OPTIONS_GUTTER_QUERY]: {
        right: `calc(-1 * ${OPTIONS_GUTTER})`,
      },
    },
  },
]);
export const MessageOptionsBar = style([
  DefaultReset,
  {
    padding: config.space.S100,
  },
]);

export const BubbleAvatarBase = style({
  paddingTop: 0,
});

export const MessageAvatar = style({
  cursor: 'pointer',
});

export const MessageQuickReaction = style({
  minWidth: toRem(32),
});

export const MessageMenuGroup = style({
  padding: config.space.S100,
});

export const MessageMenuItemText = style({
  flexGrow: 1,
});

export const ReactionsContainer = style({
  selectors: {
    '&:empty': {
      display: 'none',
    },
  },
});

export const ReactionsTooltipText = style({
  wordBreak: 'break-word',
});
