import { useQuery } from '@tanstack/react-query';
import { isWebUrl } from '../utils/safeUrl';

// MRS (matrix-rooms-search) public room directory.
// https://matrixrooms.info / https://api.matrixrooms.info
//
// Endpoint:  GET /search/{query}/{limit}/{offset}/{sort}
// Query is space-separated terms; `language:EN` filters by detected
// language; an empty query (a single space, url-encoded as %20) plus
// `-_score,-members` sort returns the highest-ranked, most-populated
// rooms across the network. Sort fields: `_score`, `members`, `name`,
// `language`. Prefix with `-` for descending.
//
// Each result has a `room_type` field — `"m.space"` for spaces,
// `""` for ordinary rooms. The server does NOT support `room_type:` as
// a filter token (returns 204), so we slice client-side.
//
// SECURITY: this is an unauthenticated fetch to a third party we do not
// control, and its output is rendered as one-click JOIN targets. Everything it
// returns is untrusted input — a compromised or hostile MRS could otherwise
// steer users into arbitrary rooms, or feed us ids/URLs that end up somewhere
// they should not. Nothing from the response is used before it has been
// validated by parseMrsRoom() below.
const MRS_API_BASE = 'https://api.matrixrooms.info';

export interface MrsRoom {
  id: string;
  type: string;
  alias: string;
  name: string;
  topic: string;
  avatar: string;
  avatar_url: string;
  server: string;
  servers: string;
  members: number;
  language: string;
  room_type: string;
  join_rule: string;
  guest_can_join: boolean;
  world_readable: boolean;
}

interface MrsSearchResult {
  spaces: MrsRoom[];
  rooms: MrsRoom[];
}

// Matrix identifier grammar. Deliberately stricter than utils/matrix's
// isRoomId (which only checks the sigil): these values become join targets, so
// a malformed one must be rejected outright rather than handed to the SDK.
const ROOM_ID_REG = /^![^\s:]{1,255}:[^\s:/]{1,255}(?::\d{1,5})?$/;
const ROOM_ALIAS_REG = /^#[^\s:]{1,255}:[^\s:/]{1,255}(?::\d{1,5})?$/;
// mxc://<server-name>/<media-id> — `avatar` is fed to mxcUrlToHttp, not to an
// <img src> directly, so anything that is not an mxc URI is dropped.
const MXC_URI_REG = /^mxc:\/\/[^\s/]{1,255}\/[^\s/]{1,255}$/;

const MAX_NAME_LEN = 200;
const MAX_TOPIC_LEN = 2000;
const MAX_SHORT_TEXT_LEN = 100;
// Ceiling on entries accepted from one response, independent of what we asked
// for — the server is free to ignore our `limit`.
const MAX_ENTRIES = 200;

/**
 * Untrusted string → bounded plain text.
 *
 * Every one of these fields is rendered as a React text child (RoomCard's
 * name/topic), never as markup and never as an href, so React's own escaping
 * handles injection. What we add here is a length bound: an unbounded `topic`
 * is a cheap way to wreck the layout or the renderer.
 */
const asText = (value: unknown, maxLen: number): string =>
  typeof value === 'string' ? value.slice(0, maxLen) : '';

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : 0;

const asBool = (value: unknown): boolean => value === true;

/**
 * Validate one directory entry against the shape we expect.
 *
 * Returns `undefined` — dropping the entry — when anything load-bearing fails:
 * we would rather show fewer rooms than offer a join target we cannot vouch
 * for.
 */
const parseMrsRoom = (raw: unknown): MrsRoom | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;

  // The room id is the whole point of the entry and the thing we would join.
  // No valid id, no card.
  const id = typeof r.id === 'string' && ROOM_ID_REG.test(r.id) ? r.id : undefined;
  if (!id) return undefined;

  // Alias is optional and preferred for display/navigation when well-formed;
  // an invalid one is dropped rather than failing the entry, since the id
  // still works.
  const alias = typeof r.alias === 'string' && ROOM_ALIAS_REG.test(r.alias) ? r.alias : '';

  const avatar = typeof r.avatar === 'string' && MXC_URI_REG.test(r.avatar) ? r.avatar : '';
  // `avatar_url` is the http form. Not currently rendered, but validate it here
  // so it can never reach an href/src unchecked if a caller starts using it.
  const avatarUrl = isWebUrl(r.avatar_url) ? r.avatar_url : '';

  // Only the two documented values are honoured; anything else is treated as
  // an ordinary room so an unknown value cannot smuggle an entry into the
  // "spaces" bucket (which navigates differently).
  const roomType = r.room_type === 'm.space' ? 'm.space' : '';

  return {
    id,
    type: asText(r.type, MAX_SHORT_TEXT_LEN),
    alias,
    name: asText(r.name, MAX_NAME_LEN),
    topic: asText(r.topic, MAX_TOPIC_LEN),
    avatar,
    avatar_url: avatarUrl,
    server: asText(r.server, MAX_SHORT_TEXT_LEN),
    servers: asText(r.servers, MAX_SHORT_TEXT_LEN),
    members: asCount(r.members),
    language: asText(r.language, MAX_SHORT_TEXT_LEN),
    room_type: roomType,
    join_rule: asText(r.join_rule, MAX_SHORT_TEXT_LEN),
    guest_can_join: asBool(r.guest_can_join),
    world_readable: asBool(r.world_readable),
  };
};

async function fetchMrsSearch(
  query: string,
  limit: number,
  offset: number,
  sort: string,
): Promise<MrsRoom[]> {
  const url = `${MRS_API_BASE}/search/${encodeURIComponent(query)}/${limit}/${offset}/${encodeURIComponent(sort)}`;
  const response = await fetch(url);
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`MRS ${response.status}`);

  const body: unknown = await response.json();
  // Top-level shape check before anything else touches it.
  if (!Array.isArray(body)) throw new Error('MRS: unexpected response shape');

  const parsed: MrsRoom[] = [];
  for (const entry of body.slice(0, MAX_ENTRIES)) {
    const room = parseMrsRoom(entry);
    if (room) parsed.push(room);
  }
  return parsed;
}

/**
 * Fetch the top spaces and rooms from MRS to populate Featured Spaces /
 * Featured Rooms. Single network call pulls 100 results, then we
 * client-side split into spaces vs. rooms.
 *
 * Cached aggressively because the directory rotates slowly and the
 * Featured page is hit on every Explore visit.
 */
export function useMrsFeatured(limit = 100, languageFilter = 'EN') {
  return useQuery<MrsSearchResult, Error>({
    queryKey: ['mrs', 'featured', limit, languageFilter],
    queryFn: async () => {
      const query = languageFilter ? ` language:${languageFilter}` : ' ';
      const all = await fetchMrsSearch(query, limit, 0, '-_score,-members');
      const spaces: MrsRoom[] = [];
      const rooms: MrsRoom[] = [];
      for (const r of all) {
        if (r.room_type === 'm.space') spaces.push(r);
        else rooms.push(r);
      }
      return { spaces, rooms };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 6, // 6 hours
    retry: 1,
  });
}
