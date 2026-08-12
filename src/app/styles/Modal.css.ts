import { style } from '@vanilla-extract/css';

export const ModalWide = style({
  minWidth: '85vw',
  minHeight: '90vh',
});

/**
 * Makes a folds `<Scroll>` actually scroll inside a `<Modal flexHeight>`.
 *
 * `flexHeight` sets `height: unset` on the modal so it sizes to its content up
 * to `max-height`. That leaves every ancestor height *indefinite*, and folds'
 * `Scroll` asks for `height: 100%` — a percentage that cannot resolve against
 * an indefinite height, so it falls back to `auto` and the element grows to the
 * full height of its content. It then has nothing to scroll (`scrollHeight ===
 * clientHeight`) and the modal's own `overflow: hidden` silently clips the
 * overflow, which is why a long list just ended flat with no scrollbar.
 *
 * Measured in Chromium against the real stylesheet, 60 rows in a `size="300"`
 * modal (max-height 580px):
 *
 * | Scroll sizing                    | height | scrollHeight | scrolls |
 * |----------------------------------|--------|--------------|---------|
 * | `height: 100%` (folds default)   | 2400   | 2400         | no      |
 * | flex-sized (this class)          |  530   | 2400         | yes     |
 *
 * Taking the height from flex instead of a percentage sidesteps the resolution
 * problem entirely: a flex item's main size is computed from the container's
 * used size, which is known even when it is not "definite" for percentages.
 * `minHeight: 0` is required alongside it — without it the automatic minimum
 * size of a flex item is its content, and it would refuse to shrink again.
 */
export const ModalFlexScroll = style({
  height: 'auto',
  flex: '1 1 0',
  minHeight: 0,
});
