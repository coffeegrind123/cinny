import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '../utils/desktop-notifications';
import { isMobile as isMobileTauri } from '../utils/platform';

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

  return { status, update, error, checkForUpdate, downloadAndInstall };
}
