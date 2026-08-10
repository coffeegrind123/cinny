import { useEffect, useState } from 'react';
import {
  getLiveNotificationPermission,
  isTauri,
  primeDesktopNotificationPermission,
  refreshNotificationPermission,
  setLiveNotificationPermission,
} from '../utils/desktop-notifications';

const isTauriRuntime = () => isTauri();

// Persist the last known granted notification permission across app restarts.
// Tauri's WebView resets `window.Notification.permission` to 'denied'/'default'
// on every launch, so without a cache the Settings → Notifications UI flashes
// the "Enable" button until the async OS check completes — and if the
// async check fails silently the button persists, forcing the user to
// re-click Enable on every startup.
//
// SECURITY: this flag is a *rendering hint only*. It is plain localStorage —
// it survives the user revoking the permission in OS settings, and any script
// on the origin can write it. It must never stand in as the answer to "may we
// show notification content?"; that question is answered by re-querying the
// platform (see the module-load refresh below and
// desktop-notifications.isNotificationPermissionGrantedSync).
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

// Re-query the platform once at load so the persisted hint is superseded by a
// real answer as early as possible, rather than standing in for a whole
// session. The result is recorded in desktop-notifications' live value, which
// the notification dispatch gate consults first.
void refreshNotificationPermission()
  .then((granted) => {
    writeCachedGranted(granted);
  })
  .catch(() => {
    // Platform query unavailable — the hint stays in play until the poll
    // in usePermissionState lands one.
  });

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    if (isTauriRuntime()) {
      // Authoritative platform answer wins whenever we already have it —
      // including when it contradicts a stale cached `granted`.
      const live = getLiveNotificationPermission();
      if (live !== undefined) return live ? 'granted' : 'prompt';

      if (window.Notification.permission === 'granted') return 'granted';
      // Hint only: shows the Switch immediately on startup. The load-time
      // refresh above and the poll below will correct it within a tick.
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
          // Goes straight to the plugin command rather than the npm helper,
          // and records the result as the authoritative value for the
          // notification dispatch gate. The localStorage write is only the
          // render hint for the next cold start.
          const granted = await refreshNotificationPermission();
          writeCachedGranted(granted);
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
        if (current === 'granted') {
          setLiveNotificationPermission(true);
          writeCachedGranted(true);
        } else if (current === 'denied') {
          setLiveNotificationPermission(false);
          writeCachedGranted(false);
        }
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
