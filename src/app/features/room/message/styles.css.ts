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
    // Floats over the end of the message, Discord-style. The row no longer
    // reserves a strip for it — that cost width on every message, and on phones
    // that never show a toolbar, to solve a problem it turned out not to be
    // solving. Overlapping text is safe now only because a press here starts no
    // selection at all: see `preventSelectionAnchor` in Message.tsx, without
    // which this overlap would bring back the drag-from-the-right bug in a
    // worse form.
    //
    // Deliberately NOT pulled out with a negative `right`: that puts the bar
    // outside the row, and since it only renders while the row is hovered, the
    // pointer had to cross dead margin to reach it and it unmounted on the way.
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

/**
 * The time of a collapsed message, shown in the avatar slot while the row is
 * hovered.
 *
 * A grouped message hides its own timestamp: the one in the group header
 * belongs to the FIRST message of the group, so every message after it has no
 * time on screen at all. The avatar gutter is already empty on exactly those
 * rows, which makes it the natural place to put it.
 *
 * Absolutely positioned, and right-aligned against the gutter's inner edge so
 * it reads as a column with the header times above it. In flow it would widen
 * the slot — `hh:mm A` is wider than the 36px the avatar reserves — and the
 * message body would jog sideways as the pointer moved down the timeline.
 * Overflow goes left into the row's own padding, which is blank.
 */
export const MessageGutterTime = style({
  position: 'absolute',
  top: 0,
  /**
   * Right-aligned, hanging half the layout gap into the space before the text.
   *
   * Both ModernLayout and BubbleLayout separate the avatar slot from the body
   * with `gap="300"`, so half of it is the one offset that reads as "closer to
   * the message than to the avatar column" without being a number someone
   * picked. Overflow from a wide `hh:mm A` runs left into the row's own
   * padding, which is empty, rather than right into the text.
   */
  right: `calc(-1 * ${config.space.S300} / 2)`,
  whiteSpace: 'nowrap',
  /**
   * Sits on the message's own first line rather than at the top of the row.
   *
   * `line-height: inherit` is what does it, inherited from the same place the
   * message body inherits from — nothing between here and the root sets one.
   * That gives this box a strut exactly as tall as the body's first line, and
   * the timestamp, being smaller text, aligns inside it. So the two share a
   * line without either knowing the other's size, where a fixed nudge would be
   * guessing at the difference between two line-heights and would go wrong as
   * soon as either changed — the font-size bump this app applies on mobile
   * changes both.
   */
  lineHeight: 'inherit',
});

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
  /**
   * The header row is `alignItems: baseline`, which an icon cannot honour: an
   * SVG has no text baseline, so CSS falls back to its bottom margin edge and
   * sits the whole glyph ON the baseline. Next to a timestamp — whose
   * descenders drop below that line — the clock ends up visibly high.
   *
   * Centring opts this one item out of baseline alignment, which is what an
   * icon among text wants anyway. Done here rather than as a nudge on `top`,
   * because the offset that would look right is a function of the icon size and
   * the font's descender depth, and neither is fixed.
   */
  alignSelf: 'center',
});

export const MessageFailedBar = style([
  DefaultReset,
  {
    padding: `${config.space.S100} ${config.space.S200}`,
    cursor: 'default',
  },
]);
