import { useEffect, useState } from 'react';
import { isTauri } from '../utils/desktop-notifications';

const isTauriRuntime = () => isTauri();

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    // In Tauri, the notification plugin manages permission via IPC.
    // WebView2/Android WebView defaults window.Notification.permission to
    // 'denied' and the plugin does NOT sync back to it. Map anything that
    // isn't 'granted' to 'prompt' so the Enable button always shows.
    if (isTauriRuntime()) {
      return window.Notification.permission === 'granted' ? 'granted' : 'prompt';
    }

    if (window.Notification.permission === 'default') {
      return 'prompt';
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

    // For Tauri: poll via the plugin's isPermissionGranted() since
    // window.Notification.permission doesn't reflect the real state
    // on Android WebView or Windows WebView2.
    const interval = setInterval(async () => {
      if (name === 'notifications' && isTauriRuntime()) {
        try {
          const mod = await import('@tauri-apps/plugin-notification');
          const granted = await mod.isPermissionGranted();
          setPermissionState((prev) => {
            const mapped: PermissionState = granted ? 'granted' : 'prompt';
            return prev !== mapped ? mapped : prev;
          });
        } catch {
          // plugin-notification not loaded yet, keep current state
        }
      } else if (name === 'notifications' && 'Notification' in window) {
        const current = window.Notification.permission as PermissionState;
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
