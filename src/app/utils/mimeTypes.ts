export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/apng',
  'image/webp',
  'image/avif',
];

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export const AUDIO_MIME_TYPES = [
  'audio/mp4',
  'audio/webm',
  'audio/aac',
  'audio/mpeg',
  'audio/ogg',
  'audio/wave',
  'audio/wav',
  'audio/x-wav',
  'audio/x-pn-wav',
  'audio/flac',
  'audio/x-flac',
];

export const APPLICATION_MIME_TYPES = [
  'application/pdf',
  'application/json',
  'application/x-sh',
  'application/ecmascript',
  'application/javascript',
  'application/xhtml+xml',
  'application/xml',
  'application/ogg',
];

export const TEXT_MIME_TYPE = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/x-c',
  'text/csv',
  'text/tab-separated-values',
  'text/yaml',
  'text/x-java-source,java',
  'text/markdown',
];

export const READABLE_TEXT_MIME_TYPES = [
  'application/json',
  'application/x-sh',
  'application/ecmascript',
  'application/javascript',
  'application/xhtml+xml',
  'application/xml',

  ...TEXT_MIME_TYPE,
];

export const READABLE_EXT_TO_MIME_TYPE: Record<string, string> = {
  go: 'text/go',
  rs: 'text/rust',
  py: 'text/python',
  swift: 'text/swift',
  c: 'text/c',
  cpp: 'text/cpp',
  java: 'text/java',
  kt: 'text/kotlin',
  lua: 'text/lua',
  php: 'text/php',
  ts: 'text/typescript',
  js: 'text/javascript',
  jsx: 'text/jsx',
  tsx: 'text/tsx',
  html: 'text/html',
  xhtml: 'text/xhtml',
  xht: 'text/xhtml',
  css: 'text/css',
  scss: 'text/scss',
  sass: 'text/sass',
  json: 'text/json',
  md: 'text/markdown',
  yaml: 'text/yaml',
  yni: 'text/yni',
  xml: 'text/xml',
  txt: 'text/plain',
  text: 'text/plain',
  conf: 'text/conf',
  cfg: 'text/conf',
  cnf: 'text/conf',
  log: 'text/log',
  me: 'text/me',
  cvs: 'text/cvs',
  tvs: 'text/tvs',
  sql: 'text/sql',
};

/**
 * MIME types a browser executes rather than merely displays.
 *
 * A Blob URL inherits our origin, so handing one of these to an `<iframe>`,
 * `window.open()` or a plain link runs the attacker's markup/script as us —
 * with our session, localStorage and access token. The declared MIME type of
 * an attachment is chosen entirely by the sender, so this must never be
 * honoured for blob construction. The lists above stay intact because
 * READABLE_TEXT_MIME_TYPES uses them to decide *text* rendering (inert), and
 * only the blob path is dangerous.
 */
export const ACTIVE_CONTENT_MIME_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
];

export const ALLOWED_BLOB_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...APPLICATION_MIME_TYPES,
  ...TEXT_MIME_TYPE,
].filter((type) => !ACTIVE_CONTENT_MIME_TYPES.includes(type));

export const FALLBACK_MIMETYPE = 'application/octet-stream';

export const getBlobSafeMimeType = (mimeType: string) => {
  if (typeof mimeType !== 'string') return FALLBACK_MIMETYPE;
  const [type] = mimeType.split(';');
  if (!ALLOWED_BLOB_MIME_TYPES.includes(type)) {
    return FALLBACK_MIMETYPE;
  }
  // Required for Chromium browsers
  if (type === 'video/quicktime') {
    return 'video/mp4';
  }
  // Fixes missing playback for Ogg audio
  if (type === 'application/ogg') {
    return 'audio/ogg';
  }
  return type;
};

/**
 * Blob-safe MIME type for a renderer that only ever produces an `<img>`.
 *
 * Stricter than `getBlobSafeMimeType`: the sender-declared type must be one of
 * the inert raster formats, so `image/svg+xml` (script-bearing) and every
 * non-image type collapse to the octet-stream fallback. Decoding is unaffected —
 * browsers sniff image bytes and ignore the declared type for `<img>` — but the
 * resulting `blob:` URL can no longer be navigated to as active content in our
 * own origin (the image viewer's "open in browser" button does exactly that).
 */
export const getImageSafeMimeType = (mimeType?: string) => {
  const safeType = getBlobSafeMimeType(mimeType ?? '');
  if (!IMAGE_MIME_TYPES.includes(safeType)) {
    return FALLBACK_MIMETYPE;
  }
  return safeType;
};

export const safeFile = (f: File) => {
  const safeType = getBlobSafeMimeType(f.type);
  if (safeType !== f.type) {
    return new File([f], f.name, { type: safeType });
  }
  return f;
};

export const mimeTypeToExt = (mimeType: string): string => {
  const extStart = mimeType.lastIndexOf('/') + 1;
  return mimeType.slice(extStart);
};
export const getFileNameExt = (fileName: string): string => {
  const extStart = fileName.lastIndexOf('.') + 1;
  return fileName.slice(extStart);
};
export const getFileNameWithoutExt = (fileName: string): string => {
  const extStart = fileName.lastIndexOf('.');
  if (extStart === 0 || extStart === -1) return fileName;
  return fileName.slice(0, extStart);
};

const MAX_DOWNLOAD_FILENAME_LEN = 128;
const FALLBACK_DOWNLOAD_FILENAME = 'download';
// Path separators (both flavours — the same bundle runs on Windows via Tauri),
// C0/C1 control characters, and the Windows drive/ADS separator.
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_CHARS_REG = /[/\\:\u0000-\u001f\u007f-\u009f]/g;
const LEADING_DOTS_REG = /^\.+/;

/**
 * Reduce a sender-supplied `body`/`filename` to a safe basename for a download.
 *
 * The value is attacker-chosen: `FileSaver.saveAs` puts it in the anchor's
 * `download` attribute, and while browsers do their own flattening, we must not
 * rely on that — the Tauri desktop and Android shells route downloads through
 * native code with different (or no) sanitisation. `../` segments, embedded
 * separators and a leading `.` are the traversal / hidden-file vectors;
 * control characters are used to visually disguise the real extension. The
 * extension is preserved because it is what makes the saved file open with the
 * right application.
 */
export const safeDownloadFilename = (fileName: string): string => {
  if (typeof fileName !== 'string') return FALLBACK_DOWNLOAD_FILENAME;

  const flat = fileName.replace(UNSAFE_FILENAME_CHARS_REG, '_').trim();
  // Collapse leading dots so `..`, `...` and `.bashrc` cannot escape or hide.
  const noLeadingDots = flat.replace(LEADING_DOTS_REG, '');
  if (noLeadingDots.length === 0) return FALLBACK_DOWNLOAD_FILENAME;
  if (noLeadingDots.length <= MAX_DOWNLOAD_FILENAME_LEN) return noLeadingDots;

  // Over-long: truncate the base but keep the extension intact.
  const ext = getFileNameExt(noLeadingDots);
  const hasExt = ext !== noLeadingDots && ext.length > 0 && ext.length < 16;
  const suffix = hasExt ? `.${ext}` : '';
  const base = hasExt ? getFileNameWithoutExt(noLeadingDots) : noLeadingDots;
  const truncated = base.slice(0, Math.max(1, MAX_DOWNLOAD_FILENAME_LEN - suffix.length));
  return `${truncated}${suffix}`;
};
