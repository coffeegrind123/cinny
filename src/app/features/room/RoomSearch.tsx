import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  Line,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
  toRem,
} from 'folds';
import { useAtomValue, useSetAtom } from 'jotai';
import { Room, SearchOrderBy } from 'matrix-js-sdk';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { mDirectAtom } from '../../state/mDirectList';
import { roomSearchOpenAtom } from '../../state/roomSearch';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { VirtualTile } from '../../components/virtualizer';
import { SequenceCard } from '../../components/sequence-card';
import { ScrollTopContainer } from '../../components/scroll-top-container';
import { MessageSearchParams, useMessageSearch } from '../message-search/useMessageSearch';
import { SearchResultGroup } from '../message-search/SearchResultGroup';
import { SearchInput } from '../message-search/SearchInput';
import * as css from './RoomSearch.css';

type RoomSearchProps = {
  room: Room;
};
export function RoomSearch({ room }: RoomSearchProps) {
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const setSearchOpen = useSetAtom(roomSearchOpenAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const { navigateRoom } = useRoomNavigate();

  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const encrypted = room.hasEncryptionStateEvent();

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState<string>();

  const msgSearchParams: MessageSearchParams = useMemo(
    () => ({
      term,
      order: SearchOrderBy.Recent,
      rooms: [room.roomId],
    }),
    [term, room.roomId]
  );

  const searchMessages = useMessageSearch(msgSearchParams);

  const { status, data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    enabled: !encrypted && !!term,
    queryKey: ['room-search', room.roomId, term],
    queryFn: ({ pageParam }) => searchMessages(pageParam),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextToken,
  });

  const groups = useMemo(() => data?.pages.flatMap((result) => result.groups) ?? [], [data]);
  const highlights = useMemo(() => {
    const mixed = data?.pages.flatMap((result) => result.highlights);
    return Array.from(new Set(mixed));
  }, [data]);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 1,
  });
  const vItems = virtualizer.getVirtualItems();

  // Infinite-scroll: fetch the next page once the last group is rendered.
  const lastVItem = vItems[vItems.length - 1];
  const lastVItemIndex: number | undefined = lastVItem?.index;
  const lastGroupIndex = groups.length - 1;
  useEffect(() => {
    if (
      lastGroupIndex > -1 &&
      lastGroupIndex === lastVItemIndex &&
      !isFetchingNextPage &&
      hasNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVItemIndex, lastGroupIndex, fetchNextPage, isFetchingNextPage, hasNextPage]);

  const handleSearch = (searchTerm: string) => setTerm(searchTerm);
  const handleSearchClear = () => {
    if (searchInputRef.current) searchInputRef.current.value = '';
    setTerm(undefined);
  };

  return (
    <Box
      className={classNames(css.RoomSearch, ContainerColor({ variant: 'Background' }))}
      shrink="No"
      grow="Yes"
      direction="Column"
    >
      <Header className={css.RoomSearchHeader} variant="Background" size="600">
        <Box grow="Yes" alignItems="Center" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Icon size="200" src={Icons.Search} />
            <Text size="H5" truncate>
              Search
            </Text>
          </Box>
          <Box shrink="No" alignItems="Center">
            <TooltipProvider
              position="Bottom"
              align="End"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Close</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton
                  ref={triggerRef}
                  variant="Background"
                  onClick={() => setSearchOpen(false)}
                >
                  <Icon src={Icons.Cross} />
                </IconButton>
              )}
            </TooltipProvider>
          </Box>
        </Box>
      </Header>

      <Box className={css.RoomSearchContentBase} grow="Yes">
        <Scroll ref={scrollRef} variant="Background" size="300" visibility="Hover" hideTrack>
          <Box className={css.RoomSearchContent} direction="Column" gap="300">
            <ScrollTopContainer scrollRef={scrollRef} anchorRef={scrollTopAnchorRef}>
              <IconButton
                onClick={() => virtualizer.scrollToOffset(0)}
                variant="SurfaceVariant"
                radii="Pill"
                outlined
                size="300"
                aria-label="Scroll to Top"
              >
                <Icon src={Icons.ChevronTop} size="300" />
              </IconButton>
            </ScrollTopContainer>

            <Box ref={scrollTopAnchorRef} shrink="No" direction="Column">
              <SearchInput
                active={!!term}
                loading={status === 'pending' && !!term}
                searchInputRef={searchInputRef}
                onSearch={handleSearch}
                onReset={handleSearchClear}
              />
            </Box>

            {encrypted && (
              <Box
                className={ContainerColor({ variant: 'Warning' })}
                style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
                alignItems="Center"
                gap="200"
              >
                <Icon size="200" src={Icons.Info} />
                <Text size="T300">
                  Server-side search can&apos;t read end-to-end encrypted messages, so search is
                  unavailable in this room.
                </Text>
              </Box>
            )}

            {!encrypted && term && groups.length === 0 && status === 'success' && (
              <Box
                className={ContainerColor({ variant: 'Warning' })}
                style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
                alignItems="Center"
                gap="200"
              >
                <Icon size="200" src={Icons.Info} />
                <Text size="T300">
                  No results for <b>{`"${term}"`}</b>
                </Text>
              </Box>
            )}

            {!encrypted && term && status === 'pending' && (
              <Box direction="Column" gap="100">
                {[...Array(6).keys()].map((key) => (
                  <SequenceCard
                    variant="SurfaceVariant"
                    key={key}
                    style={{ minHeight: toRem(80) }}
                  />
                ))}
              </Box>
            )}

            {!encrypted && vItems.length > 0 && (
              <Box direction="Column" gap="200">
                <Line size="300" variant="Surface" />
                <div
                  style={{
                    position: 'relative',
                    height: virtualizer.getTotalSize(),
                  }}
                >
                  {vItems.map((vItem) => {
                    const group = groups[vItem.index];
                    if (!group) return null;
                    const groupRoom = mx.getRoom(group.roomId);
                    if (!groupRoom) return null;

                    return (
                      <VirtualTile
                        virtualItem={vItem}
                        style={{ paddingBottom: config.space.S400 }}
                        ref={virtualizer.measureElement}
                        key={vItem.index}
                      >
                        <SearchResultGroup
                          room={groupRoom}
                          highlights={highlights}
                          items={group.items}
                          mediaAutoLoad={mediaAutoLoad}
                          urlPreview={urlPreview}
                          onOpen={(roomId, eventId) => {
                            navigateRoom(roomId, eventId);
                            // On mobile/tablet the overlay covers the timeline,
                            // so close it to reveal the jumped-to message.
                            if (screenSize !== ScreenSize.Desktop) {
                              setSearchOpen(false);
                            }
                          }}
                          legacyUsernameColor={
                            legacyUsernameColor || mDirects.has(groupRoom.roomId)
                          }
                          hour24Clock={hour24Clock}
                          dateFormatString={dateFormatString}
                        />
                      </VirtualTile>
                    );
                  })}
                </div>
                {isFetchingNextPage && (
                  <Box justifyContent="Center" alignItems="Center">
                    <Spinner size="400" variant="Secondary" />
                  </Box>
                )}
              </Box>
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
        </Scroll>
      </Box>
    </Box>
  );
}
