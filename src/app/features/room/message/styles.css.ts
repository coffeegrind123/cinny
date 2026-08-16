import { globalStyle, style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

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
 * How much of a row's right edge the hover toolbar occupies, plus a gap.
 *
 * Defined ONCE and consumed by everything that has to keep out of its way.
 * This existing in one place is the actual fix: the sender-mxid label was
 * offset by this and the group header was not, so the same label sat 144px
 * apart depending on whether it was a group's first message — and the flush
 * one was the broken one, sitting under the toolbar and having its glyph tops
 * clipped.
 *
 * 148px is the bar at its widest: four 2rem IconButtons, three S100 gaps
 * between them, and S100 of Menu padding either side. Fewer buttons render
 * when the event does not permit them, which only leaves consumers further
 * from the bar than they need to be.
 */
export const MESSAGE_OPTIONS_WIDTH = 148;
const messageOptionsClearance = `calc(${toRem(MESSAGE_OPTIONS_WIDTH)} + ${config.space.S100})`;

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

/**
 * Two pixels below the smallest type token, and its line box forced back onto
 * the body's.
 *
 * `Time` renders `<Text as="time" size="T200">`, and T200 — 0.75rem — is the
 * bottom of folds' scale, so there is no smaller size to pass; this is a
 * gutter timestamp, not body copy, and it reads better a step under it. The
 * size therefore has to be written here, and it has to be written at the
 * `time` rather than on the wrapper, because the size token folds sets is a
 * class on that element and a font-size on its parent cannot outrank it. A
 * descendant selector can: one class plus one type beats one class.
 *
 * `line-height: inherit` travels with it, and is the part that keeps the
 * timestamp centred. The wrapper already inherits the body's line-height so it
 * gets a strut as tall as the message's first line; giving the `time` the same
 * makes its own line box exactly that tall too, so the smaller glyphs centre
 * inside it instead of hanging off a shared baseline. That holds at any body
 * size — including the font-size bump this app applies on mobile — where a
 * fixed nudge would have to be re-guessed each time.
 *
 * Not passed as a `style` prop on `Time`: that component sets its own inline
 * style, and props spread after it, so an incoming `style` would replace it
 * wholesale and silently drop the `user-select: none` that keeps timestamps
 * out of a dragged selection.
 */
globalStyle(`${MessageGutterTime} time`, {
  fontSize: toRem(10),
  lineHeight: 'inherit',
});

/**
 * Read receipts riding in the message's own inline flow.
 *
 * `inline-flex` rather than `flex`: the whole point is to be an inline-level box
 * so it follows the last character of the last line and wraps with it, while the
 * avatars inside still lay out in a row. `vertical-align: middle` is what centres
 * it on that line's text instead of hanging it off the baseline, where 16px
 * circles sit visibly low.
 *
 * `user-select: none` is not optional here. Beside the block these avatars were
 * outside any selection you could drag across the text; inside it they are not,
 * and without this the `+2` overflow label and the initial inside a fallback
 * avatar would come along in the copied text. Same reasoning as the timestamp
 * and the sender name — chrome is not content.
 */
export const MessageInlineReceipts = style({
  display: 'inline-flex',
  verticalAlign: 'middle',
  marginLeft: config.space.S200,
  cursor: 'pointer',
  userSelect: 'none',
});

/**
 * The sender's mxid, parked at the right-hand end of a COLLAPSED message.
 *
 * A grouped message has no header, and the header is where this lives for the
 * first message of a group — so on every message after it the sender was simply
 * not shown, which is the opposite of useful: the first message is the one whose
 * sender you can already read off the avatar and the name above it.
 *
 * Absolutely positioned for the same reason `MessageGutterTime` is: in flow it
 * would sit after the message body and drag the row's width around as the
 * pointer moved down the timeline. `line-height: inherit` puts it on the
 * message's own FIRST line rather than the top of the row, which both matches
 * where it appears on a group header and keeps its glyphs clear of the hover
 * toolbar — that floats from -30px to +6px, and a line box starting at the
 * row's 4px top padding centres its text well below 6px.
 *
 * `pointer-events: none` because it is a label, not a target: the toolbar
 * overlaps its box slightly and must stay clickable, and a press here should
 * behave exactly as a press on the blank row does. `user-select: none` for the
 * same reason the timestamp and username have it — chrome is not content, and
 * it must not end up in a dragged selection.
 *
 * The hover background travels with it because it overlays the end of the
 * message text on a long line. The row is hovered whenever this is visible, so
 * the colour always matches what is behind it.
 */
export const MessageSenderMxId = style({
  position: 'absolute',
  top: config.space.S100,
  /**
   * Clear of the hover toolbar, which shares this corner and wins.
   *
   * Both appear on hover, so they are always on screen together and cannot
   * share the space. Measured rather than reasoned about, and the first
   * attempt was wrong: the toolbar was assumed to reach 6px into its own row,
   * so a label on the first line would clear it. It reaches 10px — a 32px
   * IconButton plus the Menu's S100 padding is 40px tall against a -30px
   * offset — and it covered the top 5px of the glyphs across 64px of their
   * width, clipping the letters.
   *
   * 148px is the widest that toolbar gets: four IconButtons at 2rem, three
   * S100 gaps between them, and S100 of Menu padding either side. Fewer
   * buttons render when the event does not permit them, which only leaves this
   * label further from the bar than it needs to be. Sized off the bar rather
   * than a round number so it stays correct if a button is added.
   */
  right: messageOptionsClearance,
  maxWidth: '40%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 'inherit',
  paddingLeft: config.space.S200,
  backgroundColor: color.Surface.ContainerHover,
  userSelect: 'none',
  pointerEvents: 'none',
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

/**
 * Keeps the group header's own content clear of the hover toolbar.
 *
 * The sender mxid used to be a flex child of this row, so flexbox held the
 * display name and the label apart and the name truncated against it. The
 * label is now positioned against the message row instead — one mechanism for
 * both the first message and the ones after it — which takes it out of this
 * row's flow, so the name needs the reservation made explicitly or a long one
 * runs underneath an opaque label.
 *
 * Applied unconditionally rather than on hover: making it conditional would
 * re-truncate the display name at the moment the pointer arrives, which is a
 * visible jump on exactly the row being pointed at. This costs width only on
 * the name-and-time line of a group's first message — the message body still
 * uses the full row, which is the thing the removed 154px strip was taking and
 * the reason it was removed.
 */
export const MessageHeaderOptionsSpace = style({
  paddingRight: messageOptionsClearance,
});
