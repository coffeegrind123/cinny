import { useEffect, useMemo, useRef } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, config, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import { Room, SearchOrderBy } from 'matrix-js-sdk';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { mDirectAtom } from '../../state/mDirectList';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { SequenceCard } from '../../components/sequence-card';
import { MessageSearchParams, useMessageSearch } from './useMessageSearch';
import { useClientRoomSearch } from './useClientRoomSearch';
import { SearchResultGroup } from './SearchResultGroup';

// Upper bound on pages the "keep looking" loop below will pull on its own.
//
// Why bounded: this component is rendered from the members drawer against a
// live, debounced search box. Each auto-fetched page of the encrypted-room path
// costs up to MAX_PAGINATIONS_PER_PAGE `/messages` round-trips and decrypts
// every event it walks, so an unbounded loop turns a single typed term into
// hundreds of server requests and tens of thousands of megolm decryptions —
// enough to stall the client and to look like abuse from the homeserver's side.
// Past this point the user drives it with the explicit "Search older messages"
// button, which is unbounded by design because it is a deliberate action.
// Raised from 5 alongside the drop in back-paginations per page (8 -> 2 in
// useClientRoomSearch), so the ceiling on total work is unchanged — the same
// budget is just spent in smaller instalments that each render as they land.
const MAX_AUTO_SEARCH_PAGES = 20;

// Keep auto-pulling until the list looks like a list. Stopping at the first
// match, as this used to, meant one stray hit from recent history froze the
// results there and everything older only appeared if the user happened to
// scroll — which reads as search having finished when it has barely started.
const MIN_RESULTS_BEFORE_PAUSE = 20;

type RoomMessageResultsProps = {
  room: Room;
  /** Debounced search term. Empty/undefined renders nothing. */
  term?: string;
  onOpen: (roomId: string, eventId: string) => void;
};

/**
 * Headerless message-search results for a single room, rendered inline (e.g. in
 * the members drawer below the people list). Encrypted rooms use the local
 * client-side scan; others use the homeserver `/search`. Both expose the same
 * paginated shape, so a single infinite-query drives either.
 */
export function RoomMessageResults({ room, term, onOpen }: RoomMessageResultsProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);

  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const encrypted = room.hasEncryptionStateEvent();

  const msgSearchParams: MessageSearchParams = useMemo(
    () => ({
      term,
      order: SearchOrderBy.Recent,
      rooms: [room.roomId],
    }),
    [term, room.roomId]
  );

  const serverSearchMessages = useMessageSearch(msgSearchParams);
  const clientSearchMessages = useClientRoomSearch(room, term);
  const searchMessages = encrypted ? clientSearchMessages : serverSearchMessages;

  const { status, data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    enabled: !!term,
    queryKey: ['room-search', room.roomId, encrypted ? 'client' : 'server', term],
    // Consume `signal` so query-core aborts the in-flight scan when this query
    // loses its observer — the term changing (new queryKey) or the drawer
    // closing (unmount). Previously the loop ran to completion in the
    // background for every superseded keystroke.
    queryFn: ({ pageParam, signal }) => searchMessages(pageParam, signal),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextToken,
  });

  const groups = useMemo(() => data?.pages.flatMap((result) => result.groups) ?? [], [data]);
  const highlights = useMemo(() => {
    const mixed = data?.pages.flatMap((result) => result.highlights);
    return Array.from(new Set(mixed));
  }, [data]);

  // Each page scans only a bounded slice of history (so typing stays snappy), so
  // a page can legitimately come back empty while older history is still
  // unscanned. Keep pulling pages until a match surfaces or the room is fully
  // walked, rather than prematurely reporting "no messages" — but only up to
  // MAX_AUTO_SEARCH_PAGES, after which the user must ask for more explicitly.
  const autoPagesRef = useRef(0);
  const searchGeneration = `${room.roomId}|${encrypted}|${term ?? ''}`;
  const generationRef = useRef(searchGeneration);
  if (generationRef.current !== searchGeneration) {
    // New term (or room) = fresh budget. Reset in render rather than in an
    // effect: an effect lands a render too late, and the stale exhausted budget
    // would suppress the first page of the new search with nothing to re-trigger
    // it (a ref write does not re-render).
    generationRef.current = searchGeneration;
    autoPagesRef.current = 0;
  }

  const autoBudgetLeft = autoPagesRef.current < MAX_AUTO_SEARCH_PAGES;
  const resultCount = useMemo(
    () => groups.reduce((total, group) => total + group.items.length, 0),
    [groups]
  );
  const stillScanning = resultCount < MIN_RESULTS_BEFORE_PAUSE && hasNextPage && autoBudgetLeft;
  useEffect(() => {
    if (stillScanning && !isFetchingNextPage && status === 'success') {
      autoPagesRef.current += 1;
      fetchNextPage();
    }
  }, [stillScanning, isFetchingNextPage, status, fetchNextPage]);

  if (!term) return null;

  return (
    <Box direction="Column" gap="200">
      <Text size="L400">Messages</Text>

      {status === 'pending' || stillScanning ? (
        <Box direction="Column" gap="100">
          {[...Array(3).keys()].map((key) => (
            <SequenceCard variant="SurfaceVariant" key={key} style={{ minHeight: toRem(64) }} />
          ))}
        </Box>
      ) : null}

      {status === 'success' && groups.length === 0 && !stillScanning && (
        <Box
          className={ContainerColor({ variant: 'Surface' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text size="T300">
            {hasNextPage
              ? // Auto-scan budget spent, history not exhausted. Say so instead
                // of claiming "no match", which would be untrue.
                'No matches in recent history.'
              : 'No messages match.'}
          </Text>
        </Box>
      )}

      {groups.map((group, index) => {
        const groupRoom = mx.getRoom(group.roomId);
        if (!groupRoom) return null;
        return (
          <SearchResultGroup
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            room={groupRoom}
            highlights={highlights}
            items={group.items}
            mediaAutoLoad={mediaAutoLoad}
            urlPreview={urlPreview}
            onOpen={onOpen}
            legacyUsernameColor={legacyUsernameColor || mDirects.has(groupRoom.roomId)}
            hour24Clock={hour24Clock}
            dateFormatString={dateFormatString}
          />
        );
      })}

      {hasNextPage && !stillScanning && status === 'success' && (
        <Button
          variant="Secondary"
          fill="Soft"
          size="300"
          radii="400"
          outlined
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
          before={isFetchingNextPage ? <Spinner size="100" variant="Secondary" /> : undefined}
        >
          <Text size="B300">{isFetchingNextPage ? 'Searching…' : 'Search older messages'}</Text>
        </Button>
      )}

      {error && (
        <Box
          className={ContainerColor({ variant: 'Critical' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          direction="Column"
          gap="200"
        >
          <Text size="L400">{error.name}</Text>
          <Text size="T300">{error.message}</Text>
        </Box>
      )}
    </Box>
  );
}
