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

// `tauri-plugin-notification`'s init-iife.js short-circuits the permission
// check on Windows (it bakes in `__TEMPLATE_windows__` and concludes
// `denied` without ever calling Rust). The npm-side `isPermissionGranted()`
// then also short-circuits whenever `window.Notification.permission !==
// 'default'`, so the polling in usePermissionState never recovers and the
// Settings → System → Enable button is shown on every fresh launch.
//
// On Tauri desktop the Rust `permission_state` and `request_permission`
// are hardcoded to `Granted` (see tauri-plugin-notification's desktop.rs
// — they always return PermissionState::Granted), so it's safe to flip
// the JS-side permission cache to `granted` ourselves at boot. macOS and
// Linux follow the same code path in plugin-notification, so we prime
// them all consistently. Android is intentionally skipped — it uses our
// custom MessageNotificationPlugin where permission is real.
let desktopPermissionPrimed = false;
export async function primeDesktopNotificationPermission(): Promise<void> {
  if (desktopPermissionPrimed) return;
  if (!isTauri()) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  desktopPermissionPrimed = true;
  try {
    const { getTauriPlatform } = await import('./platform');
    const platform = await getTauriPlatform();
    if (platform !== 'windows' && platform !== 'macos' && platform !== 'linux') {
      // Android keeps the real permission state — don't override.
      return;
    }
    if (window.Notification.permission === 'granted') return;
    const mod = await getTauriNotif();
    if (!mod) return;
    await mod.requestPermission();
  } catch (err) {
    console.warn('[notif] primeDesktopNotificationPermission failed:', err);
    desktopPermissionPrimed = false; // let a later caller retry
  }
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
  // Distinguishes non-message notifications (e.g. the update toast) so the
  // click handler can route them somewhere other than a room. Empty/absent
  // for ordinary message notifications.
  kind?: string;
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

async function resolveTauriIconPath(
  url: string,
  authHeader?: string,
  homeserver?: string
): Promise<string | undefined> {
  if (iconCache.has(url)) return iconCache.get(url);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('cache_notification_icon', {
      url,
      authHeader: authHeader ?? null,
      // The Rust side only forwards `authHeader` when `url` is under this
      // homeserver's `/_matrix/` media endpoint — prevents the access token
      // leaking to any non-homeserver URL.
      homeserver: homeserver ?? null,
    });
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
  options?: {
    body?: string;
    icon?: string;
    iconAuthHeader?: string;
    iconHomeserver?: string;
    roomId?: string;
    eventId?: string;
    kind?: string;
  }
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
      resolvedPath = await resolveTauriIconPath(
        srcIcon,
        options?.iconAuthHeader,
        options?.iconHomeserver
      );
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

    // Windows: bypass tauri-plugin-notification because notify-rust's
    // Windows backend silently drops the `icon` field — the toast comes
    // up with no avatar regardless of what we pass. Use our own Rust
    // command which calls tauri-winrt-notification directly to emit a
    // proper <image placement="appLogoOverride" hint-crop="circle"> in
    // the toast XML.
    if (platform === 'windows') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('send_windows_message_toast', {
          title,
          body: options?.body ?? '',
          iconPath: resolvedPath ?? null,
          roomId: options?.roomId ?? '',
          eventId: options?.eventId ?? '',
          kind: options?.kind ?? '',
        });
        return;
      } catch (err) {
        console.warn('[notif] send_windows_message_toast failed, falling back:', err);
        // Fall through to plugin-notification (no avatar) on failure.
      }
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
            kind: options?.kind ?? '',
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
 *
 * We register both the plugin-notification `onAction` listener (covers macOS
 * and Linux, and Android via our custom plugin) AND a `notification://activated`
 * Tauri event listener (covers Windows, where we bypass plugin-notification
 * and emit toasts ourselves via tauri-winrt-notification).
 */
export async function onNotificationAction(
  callback: (extra: NotificationExtra) => void
): Promise<() => void> {
  if (!isTauri()) return () => {};

  const unlisteners: Array<() => void> = [];

  const mod = await getTauriNotif();
  if (mod) {
    try {
      const listener = await mod.onAction((notification) => {
        const extra = notification.extra as NotificationExtra | undefined;
        if (extra?.roomId || extra?.kind) {
          callback(extra);
        }
      });
      unlisteners.push(() => listener());
    } catch (err) {
      console.error('[notif] Failed to register onAction listener:', err);
    }
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<NotificationExtra>(
      'notification://activated',
      (event) => {
        const payload = event.payload;
        if (payload?.roomId || payload?.kind) {
          callback(payload);
        }
      }
    );
    unlisteners.push(unlisten);
  } catch (err) {
    console.error('[notif] Failed to register notification://activated listener:', err);
  }

  // Android dispatches notification clicks through our custom
  // MessageNotificationPlugin: MainActivity.onCreate / onNewIntent picks up
  // the PendingIntent extras and the plugin emits this event. Listen for
  // it in addition to the Windows-style global event above. Tauri plugin
  // trigger() emits the bare event name globally — matches the convention
  // used by UnifiedPushPlugin (`endpoint-received`, `message-received`).
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<NotificationExtra>(
      'message-notification-clicked',
      (event) => {
        const payload = event.payload;
        if (payload?.roomId) {
          callback(payload);
        }
      }
    );
    unlisteners.push(unlisten);

    // Signal the plugin that we're listening. On Android cold start the
    // PendingIntent extras arrive before React mounts; the plugin stashes
    // the click and replays it on this command. No-op on other platforms
    // (the command isn't registered there — invoke rejects silently).
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:messageNotification|js_ready');
    } catch {
      // Plugin not present (desktop / non-Android) — ignore.
    }
  } catch (err) {
    console.error('[notif] Failed to register message-notification-clicked listener:', err);
  }

  return () => {
    unlisteners.forEach((fn) => {
      try {
        fn();
      } catch {
        // swallow
      }
    });
  };
}

export function isNotificationPermissionGrantedSync(): boolean {
  // On Tauri Android the WebView never marks window.Notification.permission
  // as 'granted' — tauri-plugin-notification doesn't override the WebView's
  // builtin Notification object on Android, so it stays at the WebView
  // default ('denied') even after the user grants POST_NOTIFICATIONS via
  // the OS dialog. usePermission.ts caches the real granted state in
  // localStorage; trust the cache so the JS dispatch gate doesn't suppress
  // foreground notifications.
  if (isTauri()) {
    try {
      if (localStorage.getItem('notifPermissionGranted') === '1') return true;
    } catch {
      // localStorage unavailable — fall through to Notification check.
    }
  }
  if ('Notification' in window) {
    return window.Notification.permission === 'granted';
  }
  return false;
}
