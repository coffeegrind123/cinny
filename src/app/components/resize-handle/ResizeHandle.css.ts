import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

/**
 * The draggable divider between two layout columns.
 *
 * It occupies exactly the 1px the plain `<Line direction="Vertical">` it
 * replaces did, so turning a fixed divider into a handle shifts nothing. The
 * grab area is an overflowing pseudo-element instead of real width — a literal
 * 1px target is unusable with a mouse, but widening the element would move
 * every column beside it.
 */
export const ResizeHandle = style([
  DefaultReset,
  {
    position: 'relative',
    flexShrink: 0,
    alignSelf: 'stretch',
    width: config.borderWidth.B300,
    backgroundColor: color.Background.ContainerLine,
    cursor: 'col-resize',
    // The pseudo-element below overflows into both neighbours, which come
    // later in DOM order and would otherwise paint over its right half.
    zIndex: 1,
    // Chromium and WebKit both start a native drag/selection on a pointerdown
    // that lands here unless this is set, even with preventDefault.
    touchAction: 'none',
    userSelect: 'none',

    selectors: {
      // Grab area: 7px wide, centred on the 1px line. Wider is easier to hit
      // but starts stealing pointer events from the room list's scrollbar,
      // which sits flush against this edge.
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: toRem(-3),
        right: toRem(-3),
      },
      '&:hover, &:focus-visible, &[data-dragging]': {
        backgroundColor: color.Primary.Main,
        // Widens the line visually without taking layout width, so the
        // columns do not twitch when the pointer crosses the handle.
        outline: `${config.borderWidth.B300} solid ${color.Primary.Main}`,
      },
      '&:focus-visible': {
        outlineWidth: config.borderWidth.B600,
      },
      // Once a drag is under way the pointer is captured, so the hover state
      // has to survive the cursor leaving the 9px strip.
      '&[data-dragging]': {
        outlineWidth: config.borderWidth.B400,
      },
    },
  },
]);
