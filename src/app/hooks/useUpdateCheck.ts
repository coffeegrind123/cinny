import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '../utils/desktop-notifications';

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

  return { status, update, error, checkForUpdate, downloadAndInstall };
}
