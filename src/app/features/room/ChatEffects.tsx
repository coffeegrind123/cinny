import { useEffect, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { EffectName, playEffect } from '../../plugins/effects/particles';

/**
 * The effect currently playing, if any. Set by the timeline when an effect
 * message arrives and by the composer when you send one.
 */
export const chatEffectAtom = atom<{ name: EffectName; key: number } | undefined>(undefined);

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Full-window canvas that plays confetti and friends over the room.
 *
 * Pointer events are off so the animation can never swallow a click, and
 * anybody who has asked their system for reduced motion gets nothing at all —
 * an unskippable four-second animation triggered by other people's messages is
 * exactly the thing that setting exists for.
 */
export function ChatEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [effect, setEffect] = useAtom(chatEffectAtom);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (!effect || reduced) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const cancel = playEffect(canvas, effect.name);
    return () => cancel();
  }, [effect, reduced]);

  // Clear the atom once the longest effect has finished, so the same effect can
  // be triggered again afterwards.
  useEffect(() => {
    if (!effect) return undefined;
    const timer = window.setTimeout(() => setEffect(undefined), 6500);
    return () => window.clearTimeout(timer);
  }, [effect, setEffect]);

  if (!effect || reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    />
  );
}
