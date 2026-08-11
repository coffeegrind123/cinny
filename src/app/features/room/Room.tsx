import { useCallback, useEffect } from 'react';
import { Box, Line } from 'folds';
import { useParams } from 'react-router-dom';
import { isKeyHotkey } from '../../utils/is-hotkey';
import { useAtom, useAtomValue } from 'jotai';
import { RoomView } from './RoomView';
import { MembersDrawer } from './MembersDrawer';
import { roomSearchOpenAtom } from '../../state/roomSearch';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { PowerLevelsContextProvider, usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { CallView } from '../call/CallView';
import { RoomViewHeader } from './RoomViewHeader';
import { callChatAtom } from '../../state/callEmbed';
import { CallChatView } from './CallChatView';
import { MobileSwipeBack } from './MobileSwipeBack';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useIsRoomBackdrop } from '../../hooks/useRoomBackdrop';

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const callEmbed = useCallEmbed();

  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [searchOpen, setSearchOpen] = useAtom(roomSearchOpenAtom);
  const screenSize = useScreenSizeContext();

  // Search drawer is ephemeral — close it when switching rooms or leaving.
  useEffect(() => {
    setSearchOpen(false);
    return () => setSearchOpen(false);
  }, [room.roomId, setSearchOpen]);
  const powerLevels = usePowerLevels(room);
  const members = useRoomMembers(mx, room.roomId);
  const chat = useAtomValue(callChatAtom);

  // This listener is on `window`, so a backdrop room mounted behind the room
  // list would answer Escape too — marking a room read that is not even on
  // screen, and racing the visible room for the same key.
  const isBackdrop = useIsRoomBackdrop();
  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isBackdrop) return;
        if (isKeyHotkey('escape', evt)) {
          markAsRead(mx, room.roomId, hideActivity);
        }
      },
      [mx, room.roomId, hideActivity, isBackdrop]
    )
  );

  const callView = callEmbed?.roomId === room.roomId || room.isCallRoom() || callMembers.length > 0;

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <MobileSwipeBack>
        <Box grow="Yes">
        {callView && (screenSize === ScreenSize.Desktop || !chat) && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader callView />
            <Box grow="Yes">
              <CallView />
            </Box>
          </Box>
        )}
        {!callView && (
          <Box grow="Yes" direction="Column" style={{ position: 'relative' }}>
            <RoomViewHeader />
            <Box grow="Yes">
              <RoomView eventId={eventId} />
            </Box>
            {searchOpen && screenSize !== ScreenSize.Desktop && (
              <Box style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                {/*
                  Same component the desktop side panel uses, rendered
                  full-screen. There used to be a second, messages-only search
                  view here, so the toolbar's search button led somewhere
                  different depending purely on window width. Both were driven
                  by the same hooks (useMessageSearch / useClientRoomSearch /
                  SearchResultGroup), so collapsing onto this one costs no
                  capability and gains people search on mobile.
                */}
                <MembersDrawer
                  key={room.roomId}
                  room={room}
                  members={members}
                  overlay
                  onClose={() => setSearchOpen(false)}
                />
              </Box>
            )}
          </Box>
        )}

        {callView && chat && (
          <>
            {screenSize === ScreenSize.Desktop && (
              <Line variant="Background" direction="Vertical" size="300" />
            )}
            <CallChatView />
          </>
        )}
        {!callView && screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer key={room.roomId} room={room} members={members} />
          </>
        )}
      </Box>
      </MobileSwipeBack>
    </PowerLevelsContextProvider>
  );
}
