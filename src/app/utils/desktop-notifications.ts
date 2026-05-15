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

let actionTypesRegistered = false;
async function ensureActionTypes() {
  if (actionTypesRegistered) return;
  actionTypesRegistered = true;
  const mod = await getTauriNotif();
  if (mod) {
    try {
      await mod.registerActionTypes([
        {
          id: 'message',
          actions: [
            {
              id: 'open',
              title: 'Open',
              foreground: true,
            },
          ],
        },
      ]);
    } catch (err) {
      console.error('[notif] Failed to register action types:', err);
    }
  }
}

export interface NotificationExtra {
  roomId?: string;
  eventId?: string;
}

const avatarCache = new Map<string, string>();

async function downloadAvatar(url: string): Promise<string | undefined> {
  if (avatarCache.has(url)) return avatarCache.get(url);
  try {
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    avatarCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}

export async function sendDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string; roomId?: string; eventId?: string }
): Promise<void> {
  // Convert HTTP icon URL to data URI for native notification support
  let iconUrl: string | undefined = options?.icon;
  if (iconUrl && (iconUrl.startsWith('http://') || iconUrl.startsWith('https://'))) {
    const dataUri = await downloadAvatar(iconUrl);
    if (dataUri) iconUrl = dataUri;
  }

  if (isTauri()) {
    const mod = await getTauriNotif();
    if (mod) {
      const granted = await mod.isPermissionGranted();
      if (granted) {
        await ensureActionTypes();
        mod.sendNotification({
          title,
          body: options?.body ?? '',
          icon: iconUrl,
          actionTypeId: 'message',
          extra: {
            roomId: options?.roomId ?? '',
            eventId: options?.eventId ?? '',
          },
        });
        return;
      }
    }
  }

  // Browser fallback
  if ('Notification' in window && window.Notification.permission === 'granted') {
    new window.Notification(title, {
      body: options?.body,
      icon: iconUrl,
      silent: true,
    });
  }
}

/**
 * Listen for notification clicks (Tauri action events).
 * Returns an unlisten function for cleanup.
 */
export async function onNotificationAction(
  callback: (extra: NotificationExtra) => void
): Promise<() => void> {
  if (isTauri()) {
    const mod = await getTauriNotif();
    if (mod) {
      try {
        const listener = await mod.onAction((notification) => {
          const extra = notification.extra as NotificationExtra | undefined;
          if (extra?.roomId) {
            callback(extra);
          }
        });
        return () => listener();
      } catch (err) {
        console.error('[notif] Failed to register onAction listener:', err);
      }
    }
  }
  return () => {};
}

export function isNotificationPermissionGrantedSync(): boolean {
  if ('Notification' in window) {
    return window.Notification.permission === 'granted';
  }
  return false;
}
