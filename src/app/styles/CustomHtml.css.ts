import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { color, config, DefaultReset, toRem } from 'folds';
import { ContainerColor } from './ContainerColor.css';

export const MarginSpaced = style({
  marginBottom: config.space.S200,
  marginTop: config.space.S200,
  selectors: {
    '&:first-child': {
      marginTop: 0,
    },
    '&:last-child': {
      marginBottom: 0,
    },
  },
});

export const Paragraph = style([DefaultReset]);

export const Heading = style([
  DefaultReset,
  MarginSpaced,
  {
    marginTop: config.space.S400,
    selectors: {
      '&:first-child': {
        marginTop: 0,
      },
    },
  },
]);

export const BlockQuote = style([
  DefaultReset,
  MarginSpaced,
  {
    paddingLeft: config.space.S200,
    borderLeft: `${config.borderWidth.B700} solid ${color.SurfaceVariant.ContainerLine}`,
    fontStyle: 'italic',
  },
]);

const BaseCode = style({
  color: color.SurfaceVariant.OnContainer,
  background: color.SurfaceVariant.Container,
  borderRadius: config.radii.R300,
});
const CodeFont = style({
  fontFamily: 'monospace',
});

export const Code = style([
  DefaultReset,
  BaseCode,
  CodeFont,
  {
    padding: `2px ${config.space.S100}`,
  },
]);

export const Maths = style([
  DefaultReset,
  {
    // KaTeX lays out with its own font metrics; keep it from inheriting a line
    // height that clips fractions and superscripts.
    lineHeight: 'normal',
    // A wide formula scrolls inside its own box rather than stretching the
    // whole message row.
    display: 'inline-block',
    maxWidth: '100%',
    overflowX: 'auto',
    verticalAlign: 'middle',
  },
]);

export const Spoiler = recipe({
  base: [
    DefaultReset,
    {
      padding: `0 ${config.space.S100}`,
      backgroundColor: color.SurfaceVariant.ContainerActive,
      borderRadius: config.radii.R300,
      selectors: {
        '&[aria-pressed=true]': {
          color: 'transparent',
        },
      },
    },
  ],
  variants: {
    active: {
      true: {
        color: 'transparent',
      },
    },
  },
});

export const CodeBlock = style([
  DefaultReset,
  BaseCode,
  MarginSpaced,
  {
    fontStyle: 'normal',
    position: 'relative',
    overflow: 'hidden',
  },
]);
export const CodeBlockHeader = style([
  ContainerColor({ variant: 'Surface' }),
  {
    padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
    borderBottomWidth: config.borderWidth.B300,
    gap: config.space.S200,
  },
]);
export const CodeBlockInternal = style([
  CodeFont,
  {
    padding: `${config.space.S200} ${config.space.S200} 0`,
    minWidth: toRem(200),
  },
]);

export const CodeBlockBottomShadow = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  pointerEvents: 'none',

  height: config.space.S400,
  background: `linear-gradient(to top, #00000022, #00000000)`,
});

const BaseList = style({});
export const List = style([
  BaseList,
  DefaultReset,
  MarginSpaced,
  {
    padding: `0 ${config.space.S100}`,
    paddingLeft: config.space.S600,
    selectors: {
      '& &': {
        marginTop: config.space.S200,
        marginBottom: config.space.S200,
      },
      'li:last-child &': {
        marginBottom: 0,
      },
    },
  },
]);

export const Img = style([
  DefaultReset,
  MarginSpaced,
  {
    maxWidth: toRem(296),
    borderRadius: config.radii.R300,
  },
]);

export const InlineChromiumBugfix = style({
  fontSize: 0,
  lineHeight: 0,
});

/**
 * Mentions, in both the composer and sent messages, as plain coloured text.
 *
 * This replaced a bordered pill (background fill, a `boxShadow` ring, radius
 * and padding) that used to style mentions in both places.
 *
 * A pill mid-sentence is visual noise, so this drops the background, ring,
 * radius and padding and keeps only colour: the per-user colour the sender's
 * name gets in the timeline (`colorMXID`, applied inline by the caller since it
 * is derived from the mentioned id, which CSS cannot see). The medium weight
 * matches the timeline username the mention is naming.
 *
 * `highlight` is NOT decoration — for a user mention it means the message
 * mentions YOU. Nothing else in the timeline says so: the row's `highlight`
 * prop is the jump-to-message animation and `repliedToMe` only covers replies,
 * so the green pill was the sole ping indicator. Flattening it away entirely
 * would have made a ping indistinguishable from a mention of anyone else, so it
 * survives the pill's removal as colour plus weight. Callers must leave the
 * inline colour off when this is set, or it would override the variant.
 * (For room mentions the same flag means "this is the room you are in".)
 *
 * `focus` is an editor affordance, not decoration: in the composer the element
 * is `contentEditable={false}`, so without it there is no sign the caret has
 * landed on the mention. It tints the background rather than drawing the pill's
 * ring, so selecting one does not reintroduce a box.
 */
export const MentionPlain = recipe({
  base: [
    DefaultReset,
    {
      fontWeight: config.fontWeight.W500,
    },
  ],
  variants: {
    highlight: {
      true: {
        color: color.Success.OnContainer,
        fontWeight: config.fontWeight.W600,
      },
    },
    focus: {
      true: {
        backgroundColor: color.SurfaceVariant.ContainerActive,
        borderRadius: config.radii.R300,
      },
    },
  },
});

export const Command = recipe({
  base: [
    DefaultReset,
    {
      padding: `0 ${toRem(2)}`,
      borderRadius: config.radii.R300,
      fontWeight: config.fontWeight.W500,
    },
  ],
  variants: {
    focus: {
      true: {
        boxShadow: `0 0 0 ${config.borderWidth.B300} ${color.Warning.OnContainer}`,
      },
    },
    active: {
      true: {
        backgroundColor: color.Warning.Container,
        color: color.Warning.OnContainer,
        boxShadow: `0 0 0 ${config.borderWidth.B300} ${color.Warning.ContainerLine}`,
      },
    },
  },
});

export const EmoticonBase = style([
  DefaultReset,
  {
    display: 'inline-block',
    padding: '0.05rem',
    height: '1em',
    verticalAlign: 'middle',
  },
]);

export const Emoticon = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',

      height: '1em',
      minWidth: '1em',
      fontSize: '1.33em',
      lineHeight: '1em',
      verticalAlign: 'middle',
      position: 'relative',
      top: '-0.35em',
      borderRadius: config.radii.R300,
    },
  ],
  variants: {
    focus: {
      true: {
        boxShadow: `0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.OnContainer}`,
      },
    },
  },
});

export const EmoticonImg = style([
  DefaultReset,
  {
    height: '1em',
    cursor: 'default',
  },
]);

export const highlightText = style([
  DefaultReset,
  {
    backgroundColor: 'yellow',
    color: 'black',
  },
]);
