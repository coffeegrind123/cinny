import { useEffect, useState } from 'react';

const isTauriRuntime = () => '__TAURI__' in window || '__TAURI_INTERNALS__' in window;

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    // In Tauri, the notification plugin manages permission via IPC.
    // WebView2 defaults window.Notification.permission to 'denied'
    // and the plugin does NOT sync back to it. Map anything that
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

    const interval = setInterval(() => {
      if (name === 'notifications' && 'Notification' in window) {
        const current = window.Notification.permission as PermissionState;
        // Same Tauri remapping as getNotificationState
        const mapped = isTauriRuntime()
          ? (current === 'granted' ? 'granted' : 'prompt')
          : current;
        setPermissionState((prev) => (prev !== mapped ? mapped : prev));
      }
    }, 500);

    return () => {
      permissionStatus?.removeEventListener('change', handlePermissionChange);
      clearInterval(interval);
    };
  }, [name]);

  return permissionState;
}
