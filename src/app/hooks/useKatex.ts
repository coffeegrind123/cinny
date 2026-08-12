import { useEffect, useState } from 'react';
import { loadKatex } from '../plugins/katex';

/**
 * True once KaTeX is loaded and formulas can be drawn.
 *
 * Returns false on the first render even when maths is enabled — the loader is
 * asynchronous — so callers must keep rendering the sender's plain-text
 * fallback until this flips. The state update is what re-renders the timeline
 * with real formulas.
 */
export const useKatex = (enabled: boolean): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadKatex()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        // A failed chunk load leaves formulas as plain text, which is exactly
        // what a client without maths support shows.
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return enabled && ready;
};
