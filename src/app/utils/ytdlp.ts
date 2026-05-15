import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './desktop-notifications';

// On Android the yt-dlp commands come from the Kotlin YtDlpPlugin,
// which uses Tauri's plugin command format: plugin:ytdlp|<name>.
// On desktop they're bare Rust command names: ytdlp_<name>.
async function ytCmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // Try plugin prefix first (Android), fall back to bare name (desktop)
  try {
    return await invoke<T>(`plugin:ytdlp|${name}`, args);
  } catch {
    return await invoke<T>(`ytdlp_${name}`, args);
  }
}

export interface YtdlpVideoInfo {
  title: string;
  duration: number | null;
  uploader: string | null;
}

export interface YtdlpVersionInfo {
  version: string;
  source: 'path' | 'bundled';
}

type OutputCallback = (line: string) => void;

let outputUnlisten: UnlistenFn | null = null;

export async function listenYtdlpOutput(callback: OutputCallback): Promise<void> {
  if (!isTauri()) return;
  outputUnlisten = await listen<string>('ytdlp-output', (event) => {
    callback(event.payload);
  });
}

export function unlistenYtdlpOutput(): void {
  if (outputUnlisten) {
    outputUnlisten();
    outputUnlisten = null;
  }
}

export async function getVideoInfo(url: string): Promise<YtdlpVideoInfo> {
  if (!isTauri()) throw new Error('Not in Tauri');
  return ytCmd<YtdlpVideoInfo>('get_video_info', { url });
}

export async function downloadVideo(
  url: string,
  quality?: string
): Promise<string> {
  if (!isTauri()) throw new Error('Not in Tauri');
  return ytCmd<string>('download_video', { url, quality });
}

export async function cancelDownload(): Promise<void> {
  if (!isTauri()) return;
  await ytCmd('cancel_download');
}

export async function getYtdlpVersion(): Promise<YtdlpVersionInfo> {
  if (!isTauri()) throw new Error('Not in Tauri');
  return ytCmd<YtdlpVersionInfo>('get_version');
}

export async function checkYtdlpUpdate(): Promise<boolean> {
  if (!isTauri()) throw new Error('Not in Tauri');
  return ytCmd<boolean>('check_update');
}

export async function downloadYtdlpBinary(): Promise<string> {
  if (!isTauri()) throw new Error('Not in Tauri');
  return ytCmd<string>('download_binary');
}

let ytdlpAvailable: boolean | null = null;

export async function isYtdlpAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  if (ytdlpAvailable !== null) return ytdlpAvailable;
  try {
    await ytCmd('get_version');
    ytdlpAvailable = true;
  } catch {
    ytdlpAvailable = false;
  }
  return ytdlpAvailable;
}

export function isYoutubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i.test(url);
}

export function getYoutubeVideoId(url: string): string | null {
  const match = url.match(
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]+)/i
  ) || url.match(/^https?:\/\/youtu\.be\/([\w-]+)/i);
  return match ? (match[2] || match[1]) : null;
}
