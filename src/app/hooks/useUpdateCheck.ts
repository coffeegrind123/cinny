import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, sendDesktopNotification, onNotificationAction } from '../utils/desktop-notifications';
import { isMobile as isMobileTauri } from '../utils/platform';
import LogoSVG from '../../../public/res/svg/cinny.svg';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error' | 'no-update';

interface UpdateInfo {
  version: string;
  body: string | undefined;
}

interface UpdateCheckState {
  status: UpdateStatus;
  update: UpdateInfo | null;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export function useUpdateCheck(): UpdateCheckState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keep a ref to the Update object so we can call .downloadAndInstall() later
  const [updateObj, setUpdateObj] = useState<any>(null);
  // Track which versions we've already fired a notification for so a
  // banner that's dismissed and re-shown (or a repeat poll that returns
  // the same version) doesn't notify twice. Empty string is the web
  // sentinel — we only notify once per session for SW-detected updates
  // since we don't have a version to dedupe against.
  const notifiedVersions = useRef<Set<string>>(new Set());

  const checkForUpdate = useCallback(async () => {
    if (!isTauri()) return;
    // Mobile (Android/iOS) handles updates natively — Android via
    // `UpdateChecker.kt` from `MainActivity.onCreate`, which downloads
    // the new APK through DownloadManager and prompts the user to
    // install it. The desktop `tauri-plugin-updater` isn't compiled for
    // mobile targets (see src-tauri/Cargo.toml), so calling
    // `plugin:updater|check` on Android returns "not allowed by ACL".
    if (await isMobileTauri()) return;
    setStatus('checking');
    setError(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const result = await check();
      if (result) {
        setUpdate({ version: result.version, body: result.body });
        setUpdateObj(result);
        setStatus('available');
      } else {
        setStatus('no-update');
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setStatus('error');
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri()) {
      // Web: the SW already activated (skipWaiting + clients.claim on
      // install), so reloading is enough to load the new JS bundle the
      // new SW now serves. Server admin's `git pull` deploys the dist;
      // this just applies it client-side.
      setStatus('installing');
      window.location.reload();
      return;
    }
    if (!updateObj) return;
    setStatus('downloading');
    setError(null);
    try {
      await updateObj.downloadAndInstall();
      setStatus('installing');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setStatus('error');
    }
  }, [updateObj]);

  // Keep the latest downloadAndInstall reachable from the notification
  // listener (registered once) without re-subscribing on every state change.
  const downloadAndInstallRef = useRef(downloadAndInstall);
  downloadAndInstallRef.current = downloadAndInstall;

  // The desktop update toast carries `kind: 'update'`. Its "Open" action
  // (and a tap on the toast body) should do exactly what the banner's
  // "Update" button does — download and install. Other notification kinds
  // (message clicks → room navigation) are handled in ClientNonUIFeatures;
  // this listener only acts on the update kind.
  useEffect(() => {
    if (!isTauri()) return undefined;
    let unlisten: (() => void) | undefined;
    onNotificationAction((extra) => {
      if (extra?.kind === 'update') {
        downloadAndInstallRef.current();
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Check for updates on mount, but only in Tauri
  useEffect(() => {
    if (!isTauri()) return;
    // Delay to let the app finish loading
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // Web: listen for SW update events dispatched from src/index.tsx
  useEffect(() => {
    if (isTauri()) return;
    if (typeof window === 'undefined') return;
    const handler = () => {
      // Version unknown for web (we only know "a new sw.js exists").
      setUpdate({ version: '', body: undefined });
      setError(null);
      setStatus('available');
    };
    window.addEventListener('cinny:web-update-available', handler);
    return () => window.removeEventListener('cinny:web-update-available', handler);
  }, []);

  // Fire a platform notification the first time we see each new version
  // become available. Tauri desktop: OS toast via plugin-notification.
  // Web: window.Notification (permission-gated). Android Tauri: skipped —
  // UpdateChecker.kt already shows the DownloadManager system notification
  // when it starts pulling the APK, so a second toast would be noise.
  useEffect(() => {
    if (status !== 'available' || !update) return;
    const key = update.version || 'web-update';
    if (notifiedVersions.current.has(key)) return;
    notifiedVersions.current.add(key);

    (async () => {
      if (isTauri() && (await isMobileTauri())) return; // Android handles itself
      const title = update.version
        ? `Cinny ${update.version} available`
        : 'New version available';
      const body = update.version
        ? 'Click the banner to download and install.'
        : 'Click the banner to reload and load the new build.';
      try {
        await sendDesktopNotification(title, {
          icon: LogoSVG,
          body,
          // Tag the toast so its "Open" action routes to the update flow
          // (downloadAndInstall) instead of a room — see the listener below.
          kind: 'update',
        });
      } catch {
        // Notification permission may be denied — banner still shows.
      }
    })();
  }, [status, update]);

  return { status, update, error, checkForUpdate, downloadAndInstall };
}
