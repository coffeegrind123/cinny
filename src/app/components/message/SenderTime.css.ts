import { style } from '@vanilla-extract/css';

/**
 * A timestamp slot wide enough for BOTH the timestamp and the sender's local
 * time, so swapping between them moves nothing.
 *
 * This is the fix for the hover flickering, and the cause is worth stating
 * because it is not obvious from the symptom. The two strings are different
 * widths ("15:40" against "15:40 Helsinki"). Swapping them resized the element
 * under the pointer; if that resize moved its edge past the pointer, the hover
 * ended, which restored the short string, which put the element back under the
 * pointer, which started the hover again — several times a second, for as long
 * as you held still. Nothing was wrong with the hover tracking; the element was
 * moving out from under it.
 *
 * A grid with both strings in the SAME cell sizes that cell to the wider of the
 * two, and the visible one then changes inside a box that never moves. The
 * alternative — measuring and pinning a width in JavaScript — reintroduces the
 * same race on every font, zoom level and locale.
 */
export const SenderTimeSlot = style({
  display: 'inline-grid',
  // One cell. Both children are placed into it below.
  gridTemplateAreas: '"time"',
  // Baseline, not stretch: this sits in a row aligned to the text baseline, and
  // a stretched grid item would drag the timestamp off the line the name is on.
  alignItems: 'baseline',
  justifyItems: 'start',
});

const cell = {
  gridArea: 'time',
} as const;

export const SenderTimeVisible = style(cell);

/**
 * The measuring copy: it holds the layout open and is never seen or read.
 *
 * `visibility: hidden` rather than `display: none`, because a display-none
 * element has no size and so reserves nothing — which is the entire job here.
 * Hidden from the accessibility tree too, since it is the same timestamp twice
 * and a screen reader announcing both would be a bug of its own.
 */
export const SenderTimeSizer = style([
  cell,
  {
    visibility: 'hidden',
    pointerEvents: 'none',
    userSelect: 'none',
  },
]);
