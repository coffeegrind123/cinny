import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { isTauri } from '../utils/desktop-notifications';

/**
 * Keeps the OS window-capture exclusion in sync with the setting.
 *
 * Re-applied on every change rather than only at startup, so turning it on
 * takes effect immediately instead of at the next launch — the moment someone
 * reaches for this setting is usually the moment they need it.
 */
export const useContentProtection = () => {
  const [contentProtection] = useSetting(settingsAtom, 'contentProtection');

  useEffect(() => {
    if (!isTauri()) return;
    invoke('set_content_protection', { enabled: contentProtection }).catch(() => {
      // Older shells without the command, and platforms where the compositor
      // ignores it, both land here. Nothing actionable to show the user.
    });
  }, [contentProtection]);
};
