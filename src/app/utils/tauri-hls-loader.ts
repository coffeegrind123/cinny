import { invoke } from '@tauri-apps/api/core';

// Custom hls.js Loader that routes every HLS HTTP request — manifest,
// playlists, media segments — through our Rust `fetch_remote_bytes` IPC
// command instead of the browser's XHR stack.
//
// Bluesky's video CDN (`video.bsky.app`) does not return
// Access-Control-Allow-Origin headers, so hls.js's default XHR-based
// loader gets the response blocked by the browser's CORS check (we load
// the app over http://localhost:44548 via tauri-plugin-localhost, which
// is treated as a normal HTTP origin by the WebView). Going through
// Rust bypasses CORS entirely — the server doesn't even know there's a
// browser involved.
//
// This is the same approach the Twitter video path uses (see
// `fetchAsBlobUrl` in tauri-media-proxy.ts).

type Stats = {
  aborted: boolean;
  loading: { start: number; first: number; end: number };
  parsing: { start: number; end: number };
  buffering: { start: number; first: number; end: number };
  total: number;
  loaded: number;
  retry: number;
  chunkCount: number;
  bwEstimate: number;
};

function makeStats(): Stats {
  return {
    aborted: false,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
    total: 0,
    loaded: 0,
    retry: 0,
    chunkCount: 0,
    bwEstimate: 0,
  };
}

export class TauriHlsLoader {
  context: any = null;
  stats: Stats = makeStats();
  private abortRequested = false;

  destroy(): void {
    this.abort();
  }

  abort(): void {
    this.abortRequested = true;
    this.stats.aborted = true;
  }

  load(context: any, _config: any, callbacks: any): void {
    this.context = context;
    this.stats = makeStats();
    this.stats.loading.start = performance.now();

    const { url } = context;

    invoke<ArrayBuffer>('fetch_remote_bytes', { url })
      .then((arrayBufferOrTypedArray) => {
        if (this.abortRequested) return;

        // tauri::ipc::Response → JS comes through as ArrayBuffer in most
        // Tauri 2 builds, but defensively handle Uint8Array too.
        const buffer: ArrayBuffer =
          arrayBufferOrTypedArray instanceof ArrayBuffer
            ? arrayBufferOrTypedArray
            : ((arrayBufferOrTypedArray as unknown) as Uint8Array).buffer.slice(
                ((arrayBufferOrTypedArray as unknown) as Uint8Array).byteOffset,
                ((arrayBufferOrTypedArray as unknown) as Uint8Array).byteOffset +
                  ((arrayBufferOrTypedArray as unknown) as Uint8Array).byteLength
                // .buffer is typed ArrayBufferLike (the SharedArrayBuffer arm can
                // never occur for an IPC response), and slice() preserves that.
              ) as ArrayBuffer;

        const now = performance.now();
        this.stats.loading.first = now;
        this.stats.loading.end = now;
        this.stats.total = this.stats.loaded = buffer.byteLength;

        // hls.js asks for `arraybuffer` for media segments and leaves
        // responseType unset/'text' for manifests + playlists.
        const responseType = (context.responseType ?? 'text') as
          | 'text'
          | 'arraybuffer';
        const data: string | ArrayBuffer =
          responseType === 'arraybuffer' ? buffer : new TextDecoder().decode(buffer);

        callbacks.onSuccess({ url, data }, this.stats, context, null);
      })
      .catch((err) => {
        if (this.abortRequested) return;
        const now = performance.now();
        this.stats.loading.end = now;
        callbacks.onError(
          { code: 0, text: `tauri fetch_remote_bytes failed: ${String(err)}` },
          context,
          null,
          this.stats
        );
      });
  }

  // Not all hls.js versions call these — provide stubs.
  getResponseHeader(_name: string): string | null {
    return null;
  }

  getCacheAge(): number | null {
    return null;
  }
}
