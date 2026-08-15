import { useEffect, useState } from 'react';
import { isTauriDesktop } from '../utils/platform';

/**
 * Whether this is the desktop shell, as opposed to web or Android.
 *
 * The underlying check has to ask the OS plugin, so it is asynchronous and this
 * answers `false` for the first frame. Callers use it to disable a control, and
 * a control that starts disabled and enables itself is the right way round —
 * the reverse would offer something that is not there yet.
 */
export const useTauriDesktop = (): boolean => {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isTauriDesktop()
      .then((value) => {
        if (!cancelled) setDesktop(value);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return desktop;
};
