import { MouseEventHandler, forwardRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Text,
  Menu,
  MenuItem,
  config,
  PopOut,
  toRem,
  Line,
  RectCords,
  Badge,
  Spinner,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import { FocusTrap } from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import { NavItem, NavItemContent, NavItemOptions, NavLink } from '../../components/nav';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { CallMembership } from 'matrix-js-sdk/lib/matrixrtc/CallMembership';
import {
  getDirectRoomAvatarUrl,
  getMemberAvatarMxc,
  getMemberDisplayName,
  getRoomAvatarUrl,
  getStateEvent,
} from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { getPowersLevelFromMatrixEvent, usePowerLevels } from '../../hooks/usePowerLevels';
import { copyToClipboard, getMouseEventCords } from '../../utils/dom';
import { markAsRead } from '../../utils/notifications';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import {
  getCanonicalAliasOrRoomId,
  getMxIdLocalPart,
  guessDmRoomUserId,
  isRoomAlias,
  mxcUrlToHttp,
} from '../../utils/matrix';
import { getViaServers } from '../../plugins/via-servers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import {
  getRoomNotificationModeIcon,
  RoomNotificationMode,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import { getRoomCreatorsForRoomId, useRoomCreators } from '../../hooks/useRoomCreators';
import { getRoomPermissionsAPI, useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useCallEmbed, useCallStart } from '../../hooks/useCallEmbed';
import { callChatAtom } from '../../state/callEmbed';
import { useCallPreferencesAtom } from '../../state/hooks/callPreferences';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import { livekitSupport } from '../../hooks/useLivekitSupport';
import { useUserPresence } from '../../hooks/useUserPresence';
import { AvatarPresence, PresenceBadge } from '../../components/presence';
import { StateEvent } from '../../../types/matrix/room';
import { webRTCSupported } from '../../utils/rtc';
import { useRoomFavourite, useToggleRoomFavourite } from '../../hooks/useRoomFavourites';
import * as css from './styles.css';

type RoomNavItemMenuProps = {
  room: Room;
  requestClose: () => void;
  notificationMode?: RoomNotificationMode;
  pinnable?: boolean;
};
const RoomNavItemMenu = forwardRef<HTMLDivElement, RoomNavItemMenuProps>(
  ({ room, requestClose, notificationMode, pinnable }, ref) => {
    const mx = useMatrixClient();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
    const pinned = useRoomFavourite(room.roomId);
    const toggleFavourite = useToggleRoomFavourite();
    const [pinning, setPinning] = useState(false);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openRoomSettings = useOpenRoomSettings();
    const space = useSpaceOptionally();

    const [invitePrompt, setInvitePrompt] = useState(false);

    const handleMarkAsRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      requestClose();
    };

    const handleInvite = () => {
      setInvitePrompt(true);
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
      requestClose();
    };

    const handleRoomSettings = () => {
      openRoomSettings(room.roomId, space?.roomId);
      requestClose();
    };

    const handleTogglePin = async () => {
      if (pinning) return;
      setPinning(true);
      try {
        await toggleFavourite(room.roomId, !pinned);
        requestClose();
      } finally {
        setPinning(false);
      }
    };

    return (
      <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        {invitePrompt && room && (
          <InviteUserPrompt
            room={room}
            requestClose={() => {
              setInvitePrompt(false);
              requestClose();
            }}
          />
        )}
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          {pinnable && (
            <MenuItem
              onClick={handleTogglePin}
              size="300"
              after={
                pinning ? (
                  <Spinner size="100" variant="Secondary" />
                ) : (
                  <Icon size="100" src={Icons.Pin} filled={pinned} />
                )
              }
              radii="300"
              aria-pressed={pinned}
            >
              <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                {pinned ? 'Unpin' : 'Pin to Top'}
              </Text>
            </MenuItem>
          )}
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Mark as Read
            </Text>
          </MenuItem>
          <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
            {(handleOpen, opened, changing) => (
              <MenuItem
                size="300"
                after={
                  changing ? (
                    <Spinner size="100" variant="Secondary" />
                  ) : (
                    <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                  )
                }
                radii="300"
                aria-pressed={opened}
                onClick={handleOpen}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Notifications
                </Text>
              </MenuItem>
            )}
          </RoomNotificationModeSwitcher>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            aria-pressed={invitePrompt}
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Invite
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Copy Link
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Room Settings
            </Text>
          </MenuItem>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <UseStateProvider initial={false}>
            {(promptLeave, setPromptLeave) => (
              <>
                <MenuItem
                  onClick={() => setPromptLeave(true)}
                  variant="Critical"
                  fill="None"
                  size="300"
                  after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                  radii="300"
                  aria-pressed={promptLeave}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    Leave Room
                  </Text>
                </MenuItem>
                {promptLeave && (
                  <LeaveRoomPrompt
                    roomId={room.roomId}
                    onDone={requestClose}
                    onCancel={() => setPromptLeave(false)}
                  />
                )}
              </>
            )}
          </UseStateProvider>
        </Box>
      </Menu>
    );
  },
);

function CallChatToggle() {
  const [chat, setChat] = useAtom(callChatAtom);

  return (
    <IconButton
      onClick={() => setChat(!chat)}
      aria-pressed={chat}
      aria-label="Toggle Chat"
      variant="Background"
      fill="None"
      size="300"
      radii="300"
    >
      <Icon size="50" src={Icons.Message} filled={chat} />
    </IconButton>
  );
}

type CallNavItemMembersProps = {
  room: Room;
  members: CallMembership[];
};
function CallNavItemMembers({ room, members }: CallNavItemMembersProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const openUserProfile = useOpenUserRoomProfile();

  return (
    <Box
      direction="Column"
      gap="100"
      style={{ padding: `${config.space.S100} 0 ${config.space.S100} ${config.space.S500}` }}
    >
      {members.map((callMember) => {
        const userId = callMember.sender;
        if (!userId) return null;
        const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
        const avatarMxc = getMemberAvatarMxc(room, userId);
        const avatarUrl = avatarMxc
          ? (mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96) ?? undefined)
          : undefined;

        return (
          <Box
            key={callMember.memberId}
            as="button"
            className={css.CallNavItemMember}
            alignItems="Center"
            gap="200"
            shrink="No"
            onClick={(evt: React.MouseEvent<HTMLButtonElement>) =>
              openUserProfile(
                room.roomId,
                undefined,
                userId,
                getMouseEventCords(evt.nativeEvent),
                'Right',
              )
            }
          >
            <Avatar size="200" radii="400">
              <UserAvatar
                userId={userId}
                src={avatarUrl}
                alt={name}
                renderFallback={() => <Icon size="50" src={Icons.User} filled />}
              />
            </Avatar>
            <Text size="T300" priority="300" truncate>
              {name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

type RoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  direct?: boolean;
  /**
   * Offer Pin/Unpin, and show the pin marker.
   *
   * Only for the flat lists — Direct and Home — which can actually honour a pin
   * by sorting it to the top. A space nav is ordered by its `m.space.child`
   * hierarchy and grouped by subspace, so a pin there would set the tag and
   * visibly do nothing, which is worse than not offering it.
   */
  pinnable?: boolean;
};
export function RoomNavItem({
  room,
  selected,
  showAvatar,
  direct,
  notificationMode,
  linkPath,
  pinnable,
}: RoomNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const pinned = useRoomFavourite(room.roomId);
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const typingMember = useRoomTypingMember(room.roomId).filter(
    (receipt) => receipt.userId !== mx.getUserId(),
  );

  const roomName = useRoomName(room);

  const dmUserId = direct ? guessDmRoomUserId(room, mx.getSafeUserId()) : undefined;
  const dmUserPresence = useUserPresence(dmUserId ?? '');

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const optionsVisible = hover || !!menuAnchor;
  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const startCall = useCallStart(direct);
  const callEmbed = useCallEmbed();
  const callPref = useAtomValue(useCallPreferencesAtom());
  const autoDiscoveryInfo = useAutoDiscoveryInfo();

  const handleStartCall: MouseEventHandler<HTMLAnchorElement> = (evt) => {
    const powerLevelsEvent = getStateEvent(room, StateEvent.RoomPowerLevels);
    const powerLevels = getPowersLevelFromMatrixEvent(powerLevelsEvent);
    const creators = getRoomCreatorsForRoomId(mx, room.roomId);
    const permissions = getRoomPermissionsAPI(creators, powerLevels);

    const hasCallPermission = permissions.stateEvent(
      StateEvent.GroupCallMemberPrefix,
      mx.getSafeUserId(),
    );

    // Do not join if missing permissions or no livekit support or no webRTC support
    if (!hasCallPermission || !livekitSupport(autoDiscoveryInfo) || !webRTCSupported()) {
      return;
    }

    // Do not join if already in call
    if (callEmbed) {
      return;
    }
    // Start call in second click
    if (selected) {
      evt.preventDefault();
      startCall(room, callPref);
    }
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      highlight={unread !== undefined}
      aria-selected={selected}
      data-hover={!!menuAnchor}
      onContextMenu={handleContextMenu}
      style={callMembers.length > 0 ? { flexWrap: 'wrap' } : undefined}
      {...hoverProps}
      {...focusWithinProps}
    >
      <NavLink to={linkPath} onClick={room.isCallRoom() ? handleStartCall : undefined}>
        <NavItemContent>
          <Box as="span" grow="Yes" alignItems="Center" gap="200">
            <AvatarPresence
              badge={
                dmUserPresence ? (
                  <PresenceBadge
                    presence={dmUserPresence.presence}
                    status={dmUserPresence.status}
                    size="200"
                  />
                ) : null
              }
            >
              <Avatar size="200" radii="400">
                {showAvatar ? (
                  <RoomAvatar
                    roomId={room.roomId}
                    src={
                      direct
                        ? getDirectRoomAvatarUrl(mx, room, 96, useAuthentication)
                        : getRoomAvatarUrl(mx, room, 96, useAuthentication)
                    }
                    alt={roomName}
                    renderFallback={() => (
                      <Text as="span" size="H6">
                        {nameInitials(roomName)}
                      </Text>
                    )}
                  />
                ) : (
                  <RoomIcon
                    style={{
                      opacity: unread ? config.opacity.P500 : config.opacity.P300,
                    }}
                    filled={selected}
                    size="100"
                    joinRule={room.getJoinRule()}
                    roomType={room.getType()}
                  />
                )}
              </Avatar>
            </AvatarPresence>
            <Box as="span" grow="Yes">
              <Text priority={unread ? '500' : '300'} as="span" size="Inherit" truncate>
                {roomName}
              </Text>
            </Box>
            {pinnable && pinned && !optionsVisible && (
              <Icon size="50" src={Icons.Pin} filled aria-label="Pinned" />
            )}
            {!optionsVisible && !unread && !selected && typingMember.length > 0 && (
              <Badge size="300" variant="Secondary" fill="Soft" radii="Pill" outlined>
                <TypingIndicator size="300" disableAnimation />
              </Badge>
            )}
            {!optionsVisible && unread && (
              <UnreadBadgeCenter>
                <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
              </UnreadBadgeCenter>
            )}
            {!optionsVisible && notificationMode !== RoomNotificationMode.Unset && (
              <Icon
                size="50"
                src={getRoomNotificationModeIcon(notificationMode)}
                aria-label={notificationMode}
              />
            )}
          </Box>
        </NavItemContent>
      </NavLink>
      {optionsVisible && (
        <NavItemOptions>
          {selected && (callEmbed?.roomId === room.roomId || room.isCallRoom()) && (
            <CallChatToggle />
          )}
          <PopOut
            id={`menu-${room.roomId}`}
            aria-expanded={!!menuAnchor}
            anchor={menuAnchor}
            offset={menuAnchor?.width === 0 ? 0 : undefined}
            alignOffset={menuAnchor?.width === 0 ? 0 : -5}
            position="Bottom"
            align={menuAnchor?.width === 0 ? 'Start' : 'End'}
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: () => setMenuAnchor(undefined),
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <RoomNavItemMenu
                  room={room}
                  requestClose={() => setMenuAnchor(undefined)}
                  notificationMode={notificationMode}
                  pinnable={pinnable}
                />
              </FocusTrap>
            }
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-pressed={!!menuAnchor}
              aria-controls={`menu-${room.roomId}`}
              aria-label="More Options"
              variant="Background"
              fill="None"
              size="300"
              radii="300"
            >
              <Icon size="50" src={Icons.VerticalDots} />
            </IconButton>
          </PopOut>
        </NavItemOptions>
      )}
      {callMembers.length > 0 && (
        <Box style={{ flexBasis: '100%', width: '100%' }}>
          <CallNavItemMembers room={room} members={callMembers} />
        </Box>
      )}
    </NavItem>
  );
}
