/**
 * Desktop notification wrapper.
 *
 * In Tauri: uses @tauri-apps/plugin-notification for native OS toasts.
 * In browser: falls back to the standard window.Notification API.
 *
 * Windows: Toast notifications require the app to be "installed" via the
 * NSIS installer (Start Menu shortcut → AppUserModelID). A loose .exe
 * will silently skip showing toasts even if permission is granted.
 */

let tauriNotif: typeof import('@tauri-apps/plugin-notification') | null = null;
let tauriLoadAttempted = false;

async function getTauriNotif() {
  if (tauriLoadAttempted) return tauriNotif;
  tauriLoadAttempted = true;
  try {
    if (isTauri()) {
      tauriNotif = await import('@tauri-apps/plugin-notification');
    }
  } catch (err) {
    console.error('[notif] Failed to load @tauri-apps/plugin-notification:', err);
  }
  return tauriNotif;
}

export function isTauri(): boolean {
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isTauri()) {
    const mod = await getTauriNotif();
    if (mod) {
      try {
        const permission = await mod.requestPermission();
        return permission;
      } catch (err) {
        console.error('[notif] requestPermission failed:', err);
      }
    }
  }

  // Browser fallback
  if (!('Notification' in window)) return 'denied';
  try {
    const result = window.Notification.requestPermission();
    if (result instanceof Promise) return await result;
    return result;
  } catch {
    return 'denied';
  }
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (isTauri()) {
    const mod = await getTauriNotif();
    if (mod) {
      try {
        return await mod.isPermissionGranted();
      } catch {
        // fall through
      }
    }
  }

  if ('Notification' in window) {
    return window.Notification.permission === 'granted';
  }
  return false;
}

export async function sendDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string }
): Promise<void> {
  if (isTauri()) {
    const mod = await getTauriNotif();
    if (mod) {
      const granted = await mod.isPermissionGranted();
      if (granted) {
        mod.sendNotification({ title, body: options?.body ?? '' });
        return;
      }
    }
  }

  // Browser fallback
  if ('Notification' in window && window.Notification.permission === 'granted') {
    new window.Notification(title, {
      body: options?.body,
      icon: options?.icon,
      silent: true,
    });
  }
}

export function isNotificationPermissionGrantedSync(): boolean {
  if ('Notification' in window) {
    return window.Notification.permission === 'granted';
  }
  return false;
}
