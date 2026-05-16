import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Spinner, Text, color } from 'folds';
import { useAtomValue } from 'jotai';
import { useClientConfig } from '../../../hooks/useClientConfig';
import { RoomCard, RoomCardGrid } from '../../../components/room-card';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { RoomSummaryLoader } from '../../../components/RoomSummaryLoader';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHeader,
  PageHero,
  PageHeroSection,
} from '../../../components/page';
import { RoomTopicViewer } from '../../../components/room-topic-viewer';
import * as css from './style.css';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { useMrsFeatured, MrsRoom } from '../../../hooks/useMatrixRoomsInfo';

// How many to show in each grid. MRS returns 100 rooms by default;
// ~12 per category is enough to fill a few rows without scroll fatigue.
const SPACES_LIMIT = 12;
const ROOMS_LIMIT = 18;

function MrsRoomCardRow({
  entries,
  onView,
}: {
  entries: MrsRoom[];
  onView: (roomId: string) => void;
}) {
  const allRooms = useAtomValue(allRoomsAtom);
  return (
    <RoomCardGrid>
      {entries.map((entry) => (
        <RoomCard
          key={entry.id}
          roomIdOrAlias={entry.alias || entry.id}
          allRooms={allRooms}
          avatarUrl={entry.avatar || undefined}
          name={entry.name}
          topic={entry.topic}
          memberCount={entry.members}
          roomType={entry.room_type || undefined}
          onView={onView}
          renderTopicViewer={(name, topic, requestClose) => (
            <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
          )}
        />
      ))}
    </RoomCardGrid>
  );
}

function ConfigRoomCardRow({
  ids,
  onView,
}: {
  ids: string[];
  onView: (roomId: string) => void;
}) {
  const allRooms = useAtomValue(allRoomsAtom);
  return (
    <RoomCardGrid>
      {ids.map((roomIdOrAlias) => (
        <RoomSummaryLoader key={roomIdOrAlias} roomIdOrAlias={roomIdOrAlias}>
          {(roomSummary) => (
            <RoomCard
              roomIdOrAlias={roomIdOrAlias}
              allRooms={allRooms}
              avatarUrl={roomSummary?.avatar_url}
              name={roomSummary?.name}
              topic={roomSummary?.topic}
              memberCount={roomSummary?.num_joined_members}
              onView={onView}
              renderTopicViewer={(name, topic, requestClose) => (
                <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
              )}
            />
          )}
        </RoomSummaryLoader>
      ))}
    </RoomCardGrid>
  );
}

export function FeaturedRooms() {
  const { featuredCommunities } = useClientConfig();
  const { rooms: configRooms, spaces: configSpaces } = featuredCommunities ?? {};
  const screenSize = useScreenSizeContext();
  const { navigateSpace, navigateRoom } = useRoomNavigate();

  // Pull live Featured Spaces/Rooms from matrixrooms.info (MRS public room
  // directory). Falls back to whatever's in config.json when the API is
  // unreachable or returns nothing.
  const mrs = useMrsFeatured(100, 'EN');

  const apiSpaces = mrs.data?.spaces.slice(0, SPACES_LIMIT) ?? [];
  const apiRooms = mrs.data?.rooms.slice(0, ROOMS_LIMIT) ?? [];

  const showLoading = mrs.isLoading;
  const showApiSpaces = apiSpaces.length > 0;
  const showApiRooms = apiRooms.length > 0;
  const showFallbackSpaces = !showApiSpaces && !!configSpaces && configSpaces.length > 0;
  const showFallbackRooms = !showApiRooms && !!configRooms && configRooms.length > 0;
  const showEmpty =
    !showLoading &&
    !showApiSpaces &&
    !showApiRooms &&
    !showFallbackSpaces &&
    !showFallbackRooms;

  return (
    <Page>
      {screenSize === ScreenSize.Mobile && (
        <PageHeader>
          <Box shrink="No">
            <BackRouteHandler>
              {(onBack) => (
                <IconButton onClick={onBack}>
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              )}
            </BackRouteHandler>
          </Box>
        </PageHeader>
      )}
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <Box direction="Column" gap="200">
                <PageHeroSection>
                  <PageHero
                    icon={<Icon size="600" src={Icons.Bulb} />}
                    title="Featured Communities"
                    subTitle="Browse popular public Matrix spaces and rooms from the matrixrooms.info directory."
                  />
                </PageHeroSection>
                <Box direction="Column" gap="700">
                  {showLoading && (
                    <Box alignItems="Center" justifyContent="Center" style={{ minHeight: 120 }}>
                      <Spinner variant="Secondary" size="400" />
                    </Box>
                  )}

                  {showApiSpaces && (
                    <Box direction="Column" gap="400">
                      <Text size="H4">Featured Spaces</Text>
                      <MrsRoomCardRow entries={apiSpaces} onView={navigateSpace} />
                    </Box>
                  )}
                  {showApiRooms && (
                    <Box direction="Column" gap="400">
                      <Text size="H4">Featured Rooms</Text>
                      <MrsRoomCardRow entries={apiRooms} onView={navigateRoom} />
                    </Box>
                  )}

                  {showFallbackSpaces && (
                    <Box direction="Column" gap="400">
                      <Text size="H4">Featured Spaces</Text>
                      <ConfigRoomCardRow ids={configSpaces!} onView={navigateSpace} />
                    </Box>
                  )}
                  {showFallbackRooms && (
                    <Box direction="Column" gap="400">
                      <Text size="H4">Featured Rooms</Text>
                      <ConfigRoomCardRow ids={configRooms!} onView={navigateRoom} />
                    </Box>
                  )}

                  {mrs.error && (showFallbackSpaces || showFallbackRooms) && (
                    <Text size="T200" style={{ color: color.Critical.Main }}>
                      Could not reach matrixrooms.info — showing fallback list.
                    </Text>
                  )}

                  {showEmpty && (
                    <Box
                      className={css.RoomsInfoCard}
                      direction="Column"
                      justifyContent="Center"
                      alignItems="Center"
                      gap="200"
                    >
                      <Icon size="400" src={Icons.Info} />
                      <Text size="T300" align="Center">
                        No rooms or spaces are currently featured.
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
