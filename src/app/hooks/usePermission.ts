import { useEffect, useState } from 'react';
import { isTauri, primeDesktopNotificationPermission } from '../utils/desktop-notifications';

const isTauriRuntime = () => isTauri();

// Persist the granted notification permission across app restarts. Tauri's
// WebView resets `window.Notification.permission` to 'denied'/'default' on
// every launch, so without a cache the Settings → Notifications UI flashes
// the "Enable" button until the async OS check completes — and if the
// async check fails silently the button persists, forcing the user to
// re-click Enable on every startup. Cache the granted state so the initial
// render shows the Switch immediately; the live polling will still
// downgrade to 'prompt'/'denied' if the OS revokes it later.
const NOTIF_PERM_CACHE_KEY = 'notifPermissionGranted';

const readCachedGranted = (): boolean => {
  try {
    return localStorage.getItem(NOTIF_PERM_CACHE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeCachedGranted = (granted: boolean) => {
  try {
    if (granted) {
      localStorage.setItem(NOTIF_PERM_CACHE_KEY, '1');
    } else {
      localStorage.removeItem(NOTIF_PERM_CACHE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode etc.) — fall through.
  }
};

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    if (isTauriRuntime()) {
      if (window.Notification.permission === 'granted') return 'granted';
      if (readCachedGranted()) return 'granted';
      return 'prompt';
    }
    if (window.Notification.permission === 'default') {
      return 'prompt';
    }
    if (window.Notification.permission === 'granted') {
      writeCachedGranted(true);
    } else if (window.Notification.permission === 'denied') {
      writeCachedGranted(false);
    }
    return window.Notification.permission;
  }
  return 'denied';
};

export function usePermissionState(name: PermissionName, initialValue: PermissionState = 'prompt') {
  const [permissionState, setPermissionState] = useState<PermissionState>(initialValue);

  useEffect(() => {
    let permissionStatus: PermissionStatus;

    function handlePermissionChange(this: PermissionStatus) {
      setPermissionState(this.state);
    }

    navigator.permissions
      .query({ name })
      .then((permStatus: PermissionStatus) => {
        permissionStatus = permStatus;
        handlePermissionChange.apply(permStatus);
        permStatus.addEventListener('change', handlePermissionChange);
      })
      .catch(() => {
        // Silence error since FF doesn't support microphone permission
      });

    // For Tauri: check immediately then poll via isPermissionGranted()
    const checkTauriPermission = async () => {
      if (name === 'notifications' && isTauriRuntime()) {
        try {
          // Flip the JS-side permission cache before checking — without
          // this, isPermissionGranted() short-circuits on the wrong value
          // baked in by the plugin's init-iife (Windows defaults to
          // 'denied' even though the Rust permission_state is hardcoded
          // to Granted). primeDesktopNotificationPermission() is
          // idempotent and a no-op on Android.
          await primeDesktopNotificationPermission();
          const mod = await import('@tauri-apps/plugin-notification');
          const granted = await mod.isPermissionGranted();
          if (name === 'notifications') {
            writeCachedGranted(granted);
          }
          setPermissionState((prev) => {
            const mapped: PermissionState = granted ? 'granted' : 'prompt';
            return prev !== mapped ? mapped : prev;
          });
        } catch {
          // plugin-notification not loaded yet
        }
      }
    };

    // Check immediately on mount
    checkTauriPermission();

    const interval = setInterval(async () => {
      if (name === 'notifications' && isTauriRuntime()) {
        await checkTauriPermission();
      } else if (name === 'notifications' && 'Notification' in window) {
        const current = window.Notification.permission as PermissionState;
        if (current === 'granted') writeCachedGranted(true);
        else if (current === 'denied') writeCachedGranted(false);
        setPermissionState((prev) => (prev !== current ? current : prev));
      }
    }, 500);

    return () => {
      permissionStatus?.removeEventListener('change', handlePermissionChange);
      clearInterval(interval);
    };
  }, [name]);

  return permissionState;
}
