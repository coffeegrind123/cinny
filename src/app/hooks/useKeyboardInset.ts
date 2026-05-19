import { useEffect } from 'react';

/**
 * Tracks the on-screen keyboard via VisualViewport and toggles
 * `data-keyboard-open` on <body>.
 *
 * Why: even with `interactive-widget=resizes-content` and `100dvh`, the
 * body retains `padding-bottom: env(safe-area-inset-bottom)` to clear the
 * home bar. When the keyboard is open the home bar is occluded by the
 * keyboard, so that reserved padding becomes a useless gap between the
 * chat input and the top of the keyboard — and visually the input appears
 * to "extend over the safe inset."
 *
 * The threshold (height delta > 100px) is a heuristic: the keyboard
 * always shrinks the visual viewport by far more than 100px, while
 * legitimate scrollbar/zoom oscillations stay well under.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const KEYBOARD_THRESHOLD = 100;
    const apply = () => {
      const delta = window.innerHeight - vv.height;
      const open = delta > KEYBOARD_THRESHOLD;
      if (open) {
        document.body.setAttribute('data-keyboard-open', '');
      } else {
        document.body.removeAttribute('data-keyboard-open');
      }
    };

    apply();
    vv.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      document.body.removeAttribute('data-keyboard-open');
    };
  }, []);
}
