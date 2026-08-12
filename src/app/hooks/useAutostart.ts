import { useCallback, useEffect, useState } from 'react';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { isTauri } from '../utils/desktop-notifications';

export type AutostartState = {
  /** Undefined until the OS has been asked. */
  enabled?: boolean;
  supported: boolean;
  busy: boolean;
  error?: string;
  toggle: (next: boolean) => void;
};

/**
 * Start-at-login, read from and written to the OS session manager.
 *
 * Deliberately not mirrored into our settings blob. The registration lives in
 * the user's login items / autostart directory / registry, and a user who
 * removes it there must not find the app silently putting it back because a
 * setting said "on". The OS is the source of truth; this only reflects it.
 */
export const useAutostart = (): AutostartState => {
  const supported = isTauri();
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!supported) return;
    isEnabled()
      .then(setEnabled)
      .catch(() => {
        // Mobile and web builds have no session manager to ask.
        setEnabled(undefined);
      });
  }, [supported]);

  const toggle = useCallback(
    (next: boolean) => {
      if (!supported) return;
      setBusy(true);
      setError(undefined);
      (next ? enable() : disable())
        .then(() => isEnabled())
        .then(setEnabled)
        .catch(() => setError('Could not change the start-at-login setting.'))
        .finally(() => setBusy(false));
    },
    [supported],
  );

  return { enabled, supported, busy, error, toggle };
};
