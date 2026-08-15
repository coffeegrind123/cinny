import { useState } from 'react';
import { useLowAnimationMode } from './useLowAnimationMode';

export type HoverPlay = {
  lowAnimationMode: boolean;
  hovered: boolean;
  hoverProps: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
  };
};

/**
 * Tracks hover/focus state for media elements in low animation mode.
 *
 * When low animation mode is off, `hoverProps` is empty and `hovered`
 * stays false (the caller ignores it). When on, the returned handlers
 * track pointer/focus so the caller can play media only while interacted
 * with and pause it otherwise.
 */
export function useHoverPlay(): HoverPlay {
  const lowAnimationMode = useLowAnimationMode() ?? false;
  const [hovered, setHovered] = useState(false);

  if (!lowAnimationMode) {
    return { lowAnimationMode, hovered: false, hoverProps: {} };
  }

  return {
    lowAnimationMode,
    hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setHovered(true),
      onBlur: () => setHovered(false),
    },
  };
}
