/**
 * Notification wrapper.
 *
 * Tauri desktop: @tauri-apps/plugin-notification → notify-rust (Windows
 *   winrt-notification, macOS NSUserNotification, Linux libnotify). The
 *   `icon` field must be an absolute file path — data URIs silently fail
 *   on Windows because winrt-notification calls Path::new(icon) and that
 *   path doesn't exist.
 * Tauri Android: bypass plugin-notification (its icon resolver looks up
 *   bundled drawable resources only, no file paths) and use our custom
 *   MessageNotificationPlugin which calls Notification.Builder
 *   .setLargeIcon(BitmapFactory.decodeFile(path)).
 * Browser: window.Notification — data URIs work fine in icon field there.
 *
 * Avatar pipeline: JS receives an HTTP mxc-derived URL → invoke
 * cache_notification_icon (Rust) which writes the bytes to the app
 * cache dir → pass that absolute path to the platform notification.
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

// In-memory cache: source URL → resolved icon (path on Tauri, data URI on web).
const iconCache = new Map<string, string>();

async function resolveBrowserIcon(url: string): Promise<string | undefined> {
  if (iconCache.has(url)) return iconCache.get(url);
  try {
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    iconCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}

async function resolveTauriIconPath(url: string): Promise<string | undefined> {
  if (iconCache.has(url)) return iconCache.get(url);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('cache_notification_icon', { url });
    if (typeof path === 'string' && path.length > 0) {
      iconCache.set(url, path);
      return path;
    }
  } catch (err) {
    console.warn('[notif] cache_notification_icon failed:', err);
  }
  return undefined;
}

async function sendAndroidNotification(
  title: string,
  body: string,
  iconPath: string | undefined,
  roomId: string | undefined,
  eventId: string | undefined,
): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:messageNotification|show', {
      title,
      body,
      iconPath,
      roomId,
      eventId,
    });
    return true;
  } catch (err) {
    console.warn('[notif] Android messageNotification|show failed:', err);
    return false;
  }
}

export async function sendDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string; roomId?: string; eventId?: string }
): Promise<void> {
  const srcIcon = options?.icon;
  const isHttpIcon =
    typeof srcIcon === 'string' &&
    (srcIcon.startsWith('http://') || srcIcon.startsWith('https://'));

  if (isTauri()) {
    // Resolve avatar URL → absolute file path on disk so both notify-rust
    // (desktop) and our Android plugin (Notification.Builder.setLargeIcon)
    // can read real bytes.
    let resolvedPath: string | undefined;
    if (isHttpIcon && srcIcon) {
      resolvedPath = await resolveTauriIconPath(srcIcon);
    } else if (srcIcon && !srcIcon.startsWith('data:')) {
      // Already a file path / bundled asset.
      resolvedPath = srcIcon;
    }

    // Android: custom plugin (plugin-notification ignores file paths there).
    const { getTauriPlatform } = await import('./platform');
    const platform = await getTauriPlatform();
    if (platform === 'android') {
      const ok = await sendAndroidNotification(
        title,
        options?.body ?? '',
        resolvedPath,
        options?.roomId,
        options?.eventId,
      );
      if (ok) return;
      // Fall through to plugin-notification (no avatar) on failure.
    }

    const mod = await getTauriNotif();
    if (mod) {
      const granted = await mod.isPermissionGranted();
      if (granted) {
        await ensureActionTypes();
        mod.sendNotification({
          title,
          body: options?.body ?? '',
          icon: resolvedPath,
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

  // Browser fallback: data URI is fine here (and required since browser
  // can't read local file:// paths).
  let browserIcon: string | undefined = srcIcon;
  if (isHttpIcon && srcIcon) {
    browserIcon = (await resolveBrowserIcon(srcIcon)) ?? srcIcon;
  }
  if ('Notification' in window && window.Notification.permission === 'granted') {
    new window.Notification(title, {
      body: options?.body,
      icon: browserIcon,
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
