import { style } from '@vanilla-extract/css';
import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';

export const Attachment = recipe({
  base: {
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderRadius: 0,
    overflow: 'hidden',
    maxWidth: '100%',
    width: toRem(400),
  },
  variants: {
    outlined: {
      true: {
        boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.ContainerLine}`,
      },
    },
  },
});

export type AttachmentVariants = RecipeVariants<typeof Attachment>;

/**
 * Deliberately shallower vertically than horizontally.
 *
 * This is the filename banner above an attachment, and it is the same strip for
 * a document, an audio file and a GIF. On the first two it is the whole point of
 * the card; on a GIF it is chrome sitting on top of the thing you actually came
 * to look at, and at even padding it read as a slab — a square `S300` all round
 * plus the download button's own height made it taller than a third of a wide,
 * short animation.
 *
 * The horizontal `S300` stays: it lines the badge up with the padding of
 * `AttachmentContent` below, so the card still reads as one column.
 *
 * `S100` is the floor worth taking, not a number picked for looks. The download
 * button MVideo and MAudio put in this strip is a folds IconButton, whose sizes
 * start at 300 — 2rem — so the strip cannot be shorter than 32px plus whatever
 * padding is left. This takes it from 12+32+12 to 4+32+4: 56px to 40px. Raise
 * it to `S200` for 48px if 4px reads too tight against `AttachmentContent`,
 * whose `paddingTop: 0` makes this the only gap between the two.
 */
export const AttachmentHeader = style({
  padding: `${config.space.S100} ${config.space.S300}`,
});

export const AttachmentBox = style([
  DefaultReset,
  {
    maxWidth: '100%',
    maxHeight: toRem(600),
    width: toRem(400),
    overflow: 'hidden',
  },
]);

export const AttachmentContent = style({
  padding: config.space.S300,
  paddingTop: 0,
});
