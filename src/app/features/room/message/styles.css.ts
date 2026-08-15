import { style } from '@vanilla-extract/css';
import { DefaultReset, config, toRem } from 'folds';

export const MessageBase = style({
  position: 'relative',
  transition: 'opacity 200ms ease-out',
});

// Applied while the local echo is in flight. Fading back in on delivery is the
// feedback: on a fast connection it is a flicker, and on a slow one it is the
// difference between "sending" and "sent" without reading anything.
export const MessageSending = style({
  opacity: config.opacity.Disabled,
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
    // Sits in the gutter MessageBase reserves as PADDING, flush with the row's
    // padding-box edge, so it covers only blank gutter — never text, on this row
    // or the one above. A pointer-down on the right of a message therefore
    // resolves into the text instead of onto a <button>, which is what used to
    // re-anchor the selection to the left.
    //
    // Deliberately NOT pulled out with a negative `right`: that puts the bar
    // outside the row, and since it only renders while the row is hovered, the
    // pointer had to cross dead margin to reach it and it unmounted on the way.
    // See OPTIONS_GUTTER in components/message/layout/layout.css.ts.
    right: 0,
    zIndex: 1,
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

// Dims the message while its local echo is still in flight, so a slow or
// stalled send is visible as it happens rather than only once it fails.
export const MessageStatusSending = style({
  opacity: 0.5,
});

export const MessageFailedBar = style([
  DefaultReset,
  {
    padding: `${config.space.S100} ${config.space.S200}`,
    cursor: 'default',
  },
]);
