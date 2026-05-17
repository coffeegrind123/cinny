import { isTauri } from './desktop-notifications';

let cachedPlatform: string | null = null;

export async function getTauriPlatform(): Promise<string | null> {
  if (!isTauri()) return null;
  if (cachedPlatform !== null) return cachedPlatform;
  try {
    const mod = await import('@tauri-apps/plugin-os');
    cachedPlatform = mod.platform();
    return cachedPlatform;
  } catch {
    return null;
  }
}

export async function isAndroid(): Promise<boolean> {
  return (await getTauriPlatform()) === 'android';
}

export async function isMobile(): Promise<boolean> {
  const p = await getTauriPlatform();
  return p === 'android' || p === 'ios';
}

export async function isTauriDesktop(): Promise<boolean> {
  const p = await getTauriPlatform();
  return p === 'windows' || p === 'macos' || p === 'linux';
}
