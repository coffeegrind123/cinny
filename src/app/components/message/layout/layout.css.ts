import {
  createVar,
  globalStyle,
  keyframes,
  style,
  styleVariants,
  type GlobalStyleRule,
} from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';

export const StickySection = style({
  position: 'sticky',
  top: config.space.S100,
});

const SpacingVar = createVar();
const SpacingVariant = styleVariants({
  '0': {
    vars: {
      [SpacingVar]: config.space.S0,
    },
  },
  '100': {
    vars: {
      [SpacingVar]: config.space.S100,
    },
  },
  '200': {
    vars: {
      [SpacingVar]: config.space.S200,
    },
  },
  '300': {
    vars: {
      [SpacingVar]: config.space.S300,
    },
  },
  '400': {
    vars: {
      [SpacingVar]: config.space.S400,
    },
  },
  '500': {
    vars: {
      [SpacingVar]: config.space.S500,
    },
  },
});

const highlightAnime = keyframes({
  '0%': {
    backgroundColor: color.Primary.Container,
  },
  '25%': {
    backgroundColor: color.Primary.ContainerActive,
  },
  '50%': {
    backgroundColor: color.Primary.Container,
  },
  '75%': {
    backgroundColor: color.Primary.ContainerActive,
  },
  '100%': {
    backgroundColor: color.Primary.Container,
  },
});
const HighlightVariant = styleVariants({
  true: {
    animation: `${highlightAnime} 2000ms ease-in-out`,
    animationIterationCount: 'infinite',
  },
});

// "Selected" fires when a popover/context-menu is open against the
// message (right-click menu, emoji-board anchor, reaction picker). It
// previously used `Surface.ContainerActive` which is the same intensity
// the theme reserves for held/pressed states — too loud for a passive
// "I'm pointing at this message" tint. `ContainerHover` is the lighter
// sibling and matches the user's request for a more subtle effect.
const SelectedVariant = styleVariants({
  true: {
    backgroundColor: color.Surface.ContainerHover,
  },
});

// Plain hover wasn't styled at all upstream — only the options bar
// appearing above the message signaled hover. Add a faint tint so the
// pointer target is obvious without competing with reply highlights or
// jump-highlight animations. Uses the SAME tone as the (now-lighter)
// selected state, so hover→right-click transitions feel continuous.
const MessageHover = style({
  selectors: {
    '&:hover': {
      backgroundColor: color.Surface.ContainerHover,
    },
  },
});

const AutoCollapse = style({
  selectors: {
    [`&+&`]: {
      marginTop: 0,
    },
  },
});

/**
 * Width reserved at the right of every message for the hover options toolbar.
 *
 * `MessageOptionsBase` is absolutely positioned against the row with a NEGATIVE
 * top offset, so a message's toolbar floats up and sits over the *previous*
 * message. Measured: the bar is 154px at its widest (5 IconButtons at 26px plus
 * gaps) and 34px tall, while a collapsed one-line row is only ~18px tall — so it
 * covered such a row's right-hand region completely. A pointer-down there hit a
 * `<button>`, the caret resolved to `<BUTTON> off=0` rather than into the
 * message text, and with no text anchor inside the message the engine fell back
 * to the start of the container. That is why a selection begun on the right
 * "started from the left", and why it only bit one-line messages: a taller
 * message leaves most of its right-hand blank space below the overlay.
 *
 * The strip is reserved as PADDING, not margin, so it stays part of the row's
 * box: text stops short of it, so no message content is ever underneath the
 * bar, but the row still owns the region the bar sits in.
 *
 * That distinction is the whole point. It was a margin first, with a matching
 * negative `right` pulling the bar out of the row entirely — which fixed the
 * selection bug and broke the toolbar. The bar renders only while the row is
 * hovered (`Message.tsx`: `hover || menuAnchor || emojiBoardAnchor`), and
 * `useHover` tracks DOM containment, not geometry, so an absolutely positioned
 * child keeps the row hovered no matter where it sits — PROVIDED the pointer
 * can get there without crossing anything else. With the bar in the margin, the
 * only contact between the row (`y 0..H` at its right edge) and the bar
 * (`y -30..4`, starting where the row ends) was a 4px-tall corner. Aiming for a
 * button meant leaving the row through dead margin, so the bar unmounted before
 * the pointer arrived. As padding the strip belongs to the row for its full
 * height, and the bar is reachable by moving right and then up, never leaving.
 *
 * Keep this in step with the bar's actual width — raise it if a sixth button is
 * ever added.
 *
 * Scoped to hover-capable input: a phone never renders the toolbar, so it keeps
 * the full width. The test is `any-hover`, NOT `hover: hover` — the latter asks
 * about the *primary* pointer, so a touchscreen laptop (primary pointer coarse,
 * mouse also attached) would report no hover, lose the gutter, and keep the bug
 * even though the toolbar still appears there. `any-hover` asks whether any
 * attached input can hover, which is exactly the condition for the bar existing.
 */
export const OPTIONS_GUTTER = toRem(154);
export const OPTIONS_GUTTER_QUERY = '(any-hover: hover)';

export const MessageBase = recipe({
  base: [
    DefaultReset,
    MessageHover,
    {
      marginTop: SpacingVar,
      padding: `${config.space.S100} ${config.space.S200} ${config.space.S100} ${config.space.S400}`,
      borderRadius: `0 ${config.radii.R400} ${config.radii.R400} 0`,
      '@media': {
        [OPTIONS_GUTTER_QUERY]: {
          paddingRight: `calc(${config.space.S200} + ${OPTIONS_GUTTER})`,
        },
      },
    },
  ],
  variants: {
    space: SpacingVariant,
    collapse: {
      true: {
        marginTop: 0,
      },
    },
    autoCollapse: {
      true: AutoCollapse,
    },
    highlight: HighlightVariant,
    selected: SelectedVariant,
  },
  defaultVariants: {
    space: '400',
  },
});

export type MessageBaseVariants = RecipeVariants<typeof MessageBase>;

export const CompactHeader = style([
  DefaultReset,
  StickySection,
  {
    maxWidth: toRem(170),
    width: '100%',
  },
]);

export const AvatarBase = style({
  paddingTop: toRem(4),
  transition: 'transform 200ms cubic-bezier(0, 0.8, 0.67, 0.97)',
  display: 'flex',
  alignSelf: 'start',

  selectors: {
    '&:hover': {
      transform: `translateY(${toRem(-2)})`,
    },
  },
});

// `position: relative` is what lets the hover timestamp on a collapsed message
// (MessageGutterTime) sit in this slot without being able to widen it. The slot
// is a min-width, not a width, so an in-flow child would push the whole message
// body right — and only on the rows that happen to be hovered.
export const ModernBefore = style({
  minWidth: toRem(36),
  position: 'relative',
});

export const BubbleBefore = style({
  minWidth: toRem(36),
  position: 'relative',
});

export const BubbleContent = style({
  maxWidth: toRem(800),
  padding: config.space.S200,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  borderRadius: config.radii.R500,
  position: 'relative',
});

export const BubbleContentArrowLeft = style({
  borderTopLeftRadius: 0,
});

export const BubbleLeftArrow = style({
  width: toRem(9),
  height: toRem(8),

  position: 'absolute',
  top: 0,
  left: toRem(-8),
  zIndex: 1,
});

/**
 * Chrome around a message — sender name, timestamp, the hover-revealed mxid —
 * is not content, and making it selectable actively breaks copying. The mxid
 * only exists while hovered, so dragging across it mutates the DOM mid-drag
 * and the browser re-anchors the selection somewhere else entirely, which is
 * how a drag started at the timestamp ends up grabbing text from the left.
 * Excluding it means a drag anywhere in the header starts cleanly on the
 * message body, and a copied message contains the message rather than a
 * timestamp glued to it.
 */
export const MessageChromeNoSelect = style({
  userSelect: 'none',
});

export const Username = style({
  userSelect: 'none',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    'button&:hover, button&:focus-visible': {
      textDecoration: 'underline',
    },
  },
});

export const UsernameBold = style({
  fontWeight: 550,
});

/**
 * Stops a link inside a message from being a drag source.
 *
 * An anchor is natively draggable, and that beats text selection: a
 * pointer-down that lands on a link starts a *link drag* rather than a
 * selection, so dragging leftwards out of a link selected nothing and the
 * browser anchored the selection at the previous caret position instead —
 * which is why copying a message that ends in a link appeared to "start from
 * the left".
 *
 * Same class of bug as the timestamp/mxid one handled by MessageChromeNoSelect,
 * but caused by the drag source rather than by a mutating DOM, so it needs its
 * own fix. This covers every engine the app ships on (WebView2, WebKitGTK,
 * Android WebView, Chrome, Safari); the `draggable="false"` attribute set by
 * the linkifier and the HTML sanitizer covers Gecko, which implements neither.
 *
 * Losing the link-drag gesture is not a real cost: the link stays clickable,
 * copyable from the context menu, and selectable as text — which is what
 * someone dragging across a message wanted in the first place.
 *
 * Written through `globalStyle` with a cast because `-webkit-user-drag` is not
 * a standard property and so has no entry in csstype, which is where
 * vanilla-extract's property types come from.
 */
const LinkNoDrag = style({});
globalStyle(`${LinkNoDrag} a`, {
  WebkitUserDrag: 'none',
} as GlobalStyleRule);

export const MessageTextBody = recipe({
  base: [
    LinkNoDrag,
    {
      wordBreak: 'break-word',
    },
  ],
  variants: {
    preWrap: {
      true: {
        whiteSpace: 'pre-wrap',
      },
    },
    jumboEmoji: {
      true: {
        fontSize: '1.504em',
        lineHeight: '1.4962em',
      },
    },
    emote: {
      true: {
        color: color.Success.Main,
        fontStyle: 'italic',
      },
    },
  },
});

export type MessageTextBodyVariants = RecipeVariants<typeof MessageTextBody>;
