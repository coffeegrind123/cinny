import { createVar, keyframes, style, styleVariants } from '@vanilla-extract/css';
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

export const MessageBase = recipe({
  base: [
    DefaultReset,
    MessageHover,
    {
      marginTop: SpacingVar,
      padding: `${config.space.S100} ${config.space.S200} ${config.space.S100} ${config.space.S400}`,
      borderRadius: `0 ${config.radii.R400} ${config.radii.R400} 0`,
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

export const ModernBefore = style({
  minWidth: toRem(36),
});

export const BubbleBefore = style({
  minWidth: toRem(36),
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

export const Username = style({
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

export const MessageTextBody = recipe({
  base: {
    wordBreak: 'break-word',
  },
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
