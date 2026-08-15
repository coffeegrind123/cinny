// Direct links to video files on hosts the user has chosen to trust are played
// in place instead of being rendered as a link preview card.
//
// The host list is a setting rather than a constant (upstream hard-coded two of
// its author's own hosts). Playing media from a host because a message named it
// is an unprompted fetch that discloses the reader's IP to whoever the sender
// picked — the same trade the other embed settings guard against — so nothing
// is trusted until it is named here.

const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv', 'avi']);

/**
 * Normalises a user-entered host: accepts a bare hostname or a full URL, drops
 * an empty entry, and lowercases so the comparison below can be exact.
 */
export const normalizeAutoEmbedHost = (value: string): string | undefined => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  try {
    // Tolerate someone pasting a URL rather than typing a hostname.
    if (trimmed.includes('/')) return new URL(trimmed).hostname || undefined;
  } catch {
    return undefined;
  }
  return trimmed;
};

export const isMediaAutoEmbedUrl = (value: string, hosts: string[]): boolean => {
  if (hosts.length === 0) return false;
  try {
    const url = new URL(value);
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) return false;
    // Exact host match only. A suffix match would let `evil-nyafiles.de` or
    // `nyafiles.de.attacker.example` through on a list entry of `nyafiles.de`.
    if (!hosts.includes(url.hostname.toLowerCase())) return false;
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    return ext !== undefined && ext !== '' && VIDEO_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
};
