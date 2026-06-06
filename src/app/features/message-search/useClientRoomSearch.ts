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
  matches: MatrixEvent[];
  /** True when the scan stopped at the cap rather than the start of history. */
  capped: boolean;
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

      // Build (or reuse) the full match list for this term. The bounded scan
      // runs once; subsequent pages just slice the cached list.
      if (!cursorRef.current || cursorRef.current.term !== term) {
        const timeline = room.getLiveTimeline();
        const seen = new Set<string>();
        const matches: MatrixEvent[] = [];
        let scanned = 0;

        const scanLoaded = async () => {
          const events = timeline.getEvents();
          // Walk newest -> oldest so `matches` stays in Recent order. Newly
          // back-paginated (older) events are prepended to the array; the `seen`
          // set keeps us from rescanning what we already covered.
          for (let i = events.length - 1; i >= 0; i -= 1) {
            const mEvent = events[i];
            const id = mEvent.getId();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            scanned += 1;

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
              matches.push(mEvent);
            }
          }
        };

        await scanLoaded();
        while (scanned < MAX_SCANNED_EVENTS) {
          const token = timeline.getPaginationToken(EventTimeline.BACKWARDS);
          if (!token) break;
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
          if (!ok) break;
          // eslint-disable-next-line no-await-in-loop
          await scanLoaded();
        }

        cursorRef.current = {
          term,
          matches,
          capped: scanned >= MAX_SCANNED_EVENTS,
        };
      }

      const { matches } = cursorRef.current;
      const offset = nextBatch ? parseInt(nextBatch, 10) || 0 : 0;
      const pageEvents = matches.slice(offset, offset + PAGE_SIZE);
      const nextOffset = offset + PAGE_SIZE;

      return {
        highlights: words,
        groups: groupMatches(pageEvents, room.roomId),
        nextToken: nextOffset < matches.length ? String(nextOffset) : undefined,
      };
    },
    [mx, room, term]
  );
};
