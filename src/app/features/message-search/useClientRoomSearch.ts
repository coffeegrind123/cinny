import { EventTimeline, EventType, IEventWithRoomId, MatrixEvent, Room } from 'matrix-js-sdk';
import { useCallback, useRef } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ResultGroup, ResultItem, SearchResult } from './useMessageSearch';

// Server-side `/search` can't read end-to-end encrypted messages because the
// homeserver only holds ciphertext. For encrypted rooms we instead search the
// timeline the client has locally — back-paginating (and decrypting) history
// until we've scanned the room or hit a safety cap. Results are cached per term
// so the infinite-query pages slice an already-built list.

const PAGE_SIZE = 20;
// Hard ceiling on how many events a single search will walk. Individual chats
// (the common case) are far smaller; this only guards pathological rooms from
// hanging the UI with thousands of back-pagination round-trips.
const MAX_SCANNED_EVENTS = 50000;
// Events fetched per back-pagination request.
const PAGINATION_LIMIT = 100;

type ClientSearchCursor = {
  term: string;
  /** Live timeline we walk backwards; pagination state lives on it. */
  timeline: EventTimeline;
  /** Event ids already scanned, so re-scans after pagination skip them. */
  seen: Set<string>;
  /** All matches found so far, newest-first. Pages slice into this. */
  matches: MatrixEvent[];
  /** Total events walked — bounded by {@link MAX_SCANNED_EVENTS}. */
  scanned: number;
  /** True once history is fully walked (or the cap is hit): no more to find. */
  exhausted: boolean;
};

const toEventWithRoomId = (mEvent: MatrixEvent, roomId: string): IEventWithRoomId =>
  ({
    ...mEvent.getEffectiveEvent(),
    room_id: roomId,
  } as IEventWithRoomId);

const groupMatches = (events: MatrixEvent[], roomId: string): ResultGroup[] => {
  if (events.length === 0) return [];

  const items: ResultItem[] = events.map((mEvent, index) => ({
    // Higher rank = more relevant. Preserve newest-first ordering.
    rank: events.length - index,
    event: toEventWithRoomId(mEvent, roomId),
    context: {
      events_before: [],
      events_after: [],
      profile_info: {},
    },
  }));

  return [{ roomId, items }];
};

const eventMatches = (mEvent: MatrixEvent, needle: string, words: string[]): boolean => {
  if (mEvent.getType() !== EventType.RoomMessage) return false;
  if (mEvent.isRedacted()) return false;

  const content = mEvent.getContent();
  const body = typeof content.body === 'string' ? content.body.toLowerCase() : '';
  if (!body) return false;

  // Phrase match first, then fall back to all-words-present (AND) so multi-word
  // queries behave like the server's term search rather than requiring the exact
  // adjacency.
  if (body.includes(needle)) return true;
  return words.length > 1 && words.every((word) => body.includes(word));
};

/**
 * Client-side message search for a single (typically encrypted) room.
 * Mirrors the shape returned by {@link useMessageSearch} so `RoomSearch` can use
 * either interchangeably behind the same infinite-query.
 */
export const useClientRoomSearch = (room: Room, term?: string) => {
  const mx = useMatrixClient();
  const cursorRef = useRef<ClientSearchCursor | null>(null);

  return useCallback(
    async (nextBatch?: string): Promise<SearchResult> => {
      const needle = term?.toLowerCase().trim();
      if (!term || !needle) {
        return { highlights: [], groups: [] };
      }
      const words = needle.split(/\s+/).filter(Boolean);

      // (Re)initialize the scan cursor when the term changes. The cursor carries
      // pagination progress across pages so we never rescan covered history.
      if (!cursorRef.current || cursorRef.current.term !== term) {
        cursorRef.current = {
          term,
          timeline: room.getLiveTimeline(),
          seen: new Set<string>(),
          matches: [],
          scanned: 0,
          exhausted: false,
        };
      }
      const cursor = cursorRef.current;
      const { timeline, seen } = cursor;

      const scanLoaded = async () => {
        const events = timeline.getEvents();
        // Walk newest -> oldest so `matches` stays in Recent order. Newly
        // back-paginated (older) events are prepended to the timeline; the
        // `seen` set keeps us from rescanning what we already covered.
        for (let i = events.length - 1; i >= 0; i -= 1) {
          const mEvent = events[i];
          const id = mEvent.getId();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          cursor.scanned += 1;

          // Decrypt lazily — most timeline events are already decrypted, but
          // freshly back-paginated encrypted events may not be.
          if (
            mEvent.isEncrypted() &&
            mEvent.getType() === EventType.RoomMessageEncrypted &&
            !mEvent.isDecryptionFailure()
          ) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await mx.decryptEventIfNeeded(mEvent);
            } catch {
              // Undecryptable (missing keys) — skip it.
            }
          }

          if (eventMatches(mEvent, needle, words)) {
            cursor.matches.push(mEvent);
          }
        }
      };

      const offset = nextBatch ? parseInt(nextBatch, 10) || 0 : 0;
      // We only need enough matches to fill the page being requested. Crucially
      // we DON'T exhaust the whole room before returning — we paginate just far
      // enough to satisfy this page, then stop. Dense terms return almost
      // instantly; further pages resume back-pagination on demand as the user
      // scrolls.
      const target = offset + PAGE_SIZE;

      // Pick up anything already loaded (the synced recent history) first.
      await scanLoaded();

      while (
        cursor.matches.length < target &&
        !cursor.exhausted &&
        cursor.scanned < MAX_SCANNED_EVENTS
      ) {
        const token = timeline.getPaginationToken(EventTimeline.BACKWARDS);
        if (!token) {
          cursor.exhausted = true;
          break;
        }
        let ok = false;
        try {
          // eslint-disable-next-line no-await-in-loop
          ok = await mx.paginateEventTimeline(timeline, {
            backwards: true,
            limit: PAGINATION_LIMIT,
          });
        } catch {
          ok = false;
        }
        if (!ok) {
          cursor.exhausted = true;
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        await scanLoaded();
      }
      if (cursor.scanned >= MAX_SCANNED_EVENTS) cursor.exhausted = true;

      const pageEvents = cursor.matches.slice(offset, offset + PAGE_SIZE);
      const nextOffset = offset + pageEvents.length;
      // Offer another page when we already hold further matches, or when there's
      // still unscanned history that could contain some. When the room is fully
      // exhausted and we've returned everything, drop the token so the UI can
      // settle on a final "no results"/end state instead of spinning.
      const hasMore = cursor.matches.length > nextOffset || !cursor.exhausted;

      return {
        highlights: words,
        groups: groupMatches(pageEvents, room.roomId),
        nextToken: hasMore ? String(nextOffset) : undefined,
      };
    },
    [mx, room, term]
  );
};
