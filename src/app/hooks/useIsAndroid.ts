import { useEffect, useState } from 'react';
import { isAndroid } from '../utils/platform';

/**
 * Whether this is the Android build, as a render-time boolean.
 *
 * `isAndroid()` asks the Tauri shell and so is async, which is awkward in a
 * component that has to decide what to render right now. Every caller was
 * writing the same mounted-guarded effect around it; this is that effect, once.
 *
 * Starts `false`, i.e. the first paint assumes NOT Android. That direction is
 * deliberate: it hides Android-only UI for a frame on Android, rather than
 * flashing Android-only UI on every desktop and web client before removing it.
 */
export function useIsAndroid(): boolean {
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    let live = true;
    isAndroid()
      .then((value) => {
        if (live) setAndroid(value);
      })
      .catch(() => {
        // Not a Tauri shell, or it did not answer — either way, not Android.
      });
    return () => {
      live = false;
    };
  }, []);

  return android;
}
