import { useQuery } from '@tanstack/react-query';

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
  return response.json();
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
