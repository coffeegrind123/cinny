/**
 * Trigger a browser download for a Blob or a URL.
 *
 * This replaces the `file-saver` package. Two details in that package look
 * incidental and are not — copying them is most of the reason this file exists.
 *
 * 1. The anchor is NEVER added to the document, and the click is dispatched as
 *    a non-bubbling `MouseEvent`, not via `anchor.click()`. `initBlobLinkHandler`
 *    (see ./blob-links) listens on `document` in the CAPTURE phase for clicks on
 *    `a[href^="blob:"]` and re-issues them as downloads — behaviour the Tauri
 *    shells need, because the OS cannot open a `blob:` URL. An attached anchor,
 *    or a bubbling `.click()`, would be caught by that handler and handled twice.
 *    Every URL we pass here is a `blob:` URL, so this is the normal path, not an
 *    edge case.
 *
 * 2. The object URL is revoked on a long timer rather than immediately. Revoking
 *    right after the click races the browser's own fetch of the URL and produces
 *    an empty or failed download.
 *
 * Deliberately dropped from `file-saver`: the `msSaveOrOpenBlob` branch (IE/Edge
 * legacy), the old-Safari `window.open` fallback, and the `autoBom` option, which
 * no caller here used.
 */

/** Matches file-saver: long enough that the browser has finished reading it. */
const OBJECT_URL_TTL = 40 * 1000;

const dispatchDownloadClick = (anchor: HTMLAnchorElement): void => {
  // `new MouseEvent('click')` does not bubble by default, which is exactly what
  // we want here. See note 1 above.
  anchor.dispatchEvent(new MouseEvent('click'));
};

const createDownloadAnchor = (href: string, filename: string): HTMLAnchorElement => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  // Stops the opened context (if a browser routes this to a new tab) from
  // retaining a reference to this window via `window.opener`.
  anchor.rel = 'noopener';
  return anchor;
};

const saveBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = createDownloadAnchor(objectUrl, filename);

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_TTL);
  // Deferred a tick, matching file-saver: some browsers ignore a click
  // dispatched in the same task that created the object URL.
  window.setTimeout(() => dispatchDownloadClick(anchor), 0);
};

/**
 * Save a Blob, or the resource at a URL, as `filename`.
 *
 * A same-origin URL — which includes every `blob:` URL we create — is handed
 * straight to the anchor. A cross-origin URL cannot use the `download`
 * attribute (browsers ignore it), so it is fetched and re-saved as a Blob; if
 * that fetch is blocked by CORS, we fall back to opening it so the user still
 * reaches the file.
 */
export const saveAs = (data: Blob | string, filename: string): void => {
  if (typeof data !== 'string') {
    saveBlob(data, filename);
    return;
  }

  const anchor = createDownloadAnchor(data, filename);

  if (anchor.origin === window.location.origin) {
    dispatchDownloadClick(anchor);
    return;
  }

  fetch(data)
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
      return res.blob();
    })
    .then((blob) => saveBlob(blob, filename))
    .catch(() => {
      window.open(data, '_blank', 'noopener');
    });
};

export default { saveAs };
