import { useEffect, useRef } from 'react';
import { isTauri } from '../utils/desktop-notifications';

/**
 * Whether the app window currently has focus, as a ref so event handlers read
 * a live value without re-subscribing.
 *
 * `document.hasFocus()` alone is not trustworthy inside a Tauri WebView: focus
 * can sit on the native window while the document reports otherwise, which
 * makes an OS toast fire while the user is looking straight at the app. Tauri
 * exposes the real window state, so use that when it is available and keep the
 * DOM events as the web fallback.
 */
export function useWindowFocusedRef(): React.MutableRefObject<boolean> {
  const focusedRef = useRef<boolean>(typeof document === 'undefined' || document.hasFocus());

  useEffect(() => {
    const onFocus = () => {
      focusedRef.current = true;
    };
    const onBlur = () => {
      focusedRef.current = false;
    };
    const onVisibility = () => {
      // A hidden document is never "focused" for notification purposes, even
      // if the OS still considers the window active.
      if (document.visibilityState === 'hidden') focusedRef.current = false;
      else focusedRef.current = document.hasFocus();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    if (isTauri()) {
      (async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          // Seed from the real window state; the DOM may disagree at startup.
          const initial = await win.isFocused();
          if (!cancelled) focusedRef.current = initial;
          const stop = await win.onFocusChanged(({ payload }) => {
            focusedRef.current = payload;
          });
          if (cancelled) stop();
          else unlisten = stop;
        } catch {
          // Fall back to the DOM listeners above.
        }
      })();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      unlisten?.();
    };
  }, []);

  return focusedRef;
}
