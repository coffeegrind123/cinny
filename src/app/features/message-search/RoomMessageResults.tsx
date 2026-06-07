import React, { useEffect, useMemo } from 'react';
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
    queryFn: ({ pageParam }) => searchMessages(pageParam),
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
  // walked, rather than prematurely reporting "no messages".
  const stillScanning = groups.length === 0 && hasNextPage;
  useEffect(() => {
    if (stillScanning && !isFetchingNextPage && status === 'success') {
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

      {status === 'success' && groups.length === 0 && !hasNextPage && (
        <Box
          className={ContainerColor({ variant: 'Surface' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text size="T300">No messages match.</Text>
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

      {groups.length > 0 && hasNextPage && (
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
