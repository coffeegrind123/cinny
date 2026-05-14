import { useEffect, useState } from 'react';
import { isTauri } from '../utils/desktop-notifications';

const isTauriRuntime = () => isTauri();

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
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

    // For Tauri: check immediately then poll via isPermissionGranted()
    const checkTauriPermission = async () => {
      if (name === 'notifications' && isTauriRuntime()) {
        try {
          const mod = await import('@tauri-apps/plugin-notification');
          const granted = await mod.isPermissionGranted();
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
