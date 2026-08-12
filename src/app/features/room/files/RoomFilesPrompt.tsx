import { useMemo } from 'react';
import {
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  MenuItem,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { MatrixEvent, MsgType, Room } from 'matrix-js-sdk';
import { stopPropagation } from '../../../utils/keyboard';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { timeDayMonthYear, timeHourMinute } from '../../../utils/time';
import { getMemberDisplayName } from '../../../utils/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import { bytesToSize } from '../../../utils/common';
import { isVoiceMessageContent } from '../../../utils/voice-message';
import { ModalFlexScroll } from '../../../styles/Modal.css';

const FILE_MSGTYPES = new Set<string>([MsgType.Image, MsgType.Video, MsgType.Audio, MsgType.File]);

const iconFor = (msgtype: string | undefined) => {
  if (msgtype === MsgType.Image) return Icons.Photo;
  if (msgtype === MsgType.Video) return Icons.Play;
  if (msgtype === MsgType.Audio) return Icons.Play;
  return Icons.File;
};

type RoomFilesPromptProps = {
  room: Room;
  requestClose: () => void;
};

/**
 * Every attachment in the part of the room that is loaded, newest first.
 *
 * Scoped to the loaded timeline on purpose rather than paginating the whole
 * room: this is the "where was that PDF" list, and fetching a room's entire
 * history to build it would cost far more than scrolling up a little.
 */
export function RoomFilesPrompt({ room, requestClose }: RoomFilesPromptProps) {
  const { navigateRoom } = useRoomNavigate();
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');

  const files = useMemo(() => {
    const events: MatrixEvent[] = room
      .getUnfilteredTimelineSet()
      .getLiveTimeline()
      .getEvents()
      .filter((mEvent) => {
        if (mEvent.isRedacted()) return false;
        if (mEvent.getType() !== 'm.room.message') return false;
        const content = mEvent.getContent();
        if (!FILE_MSGTYPES.has(content.msgtype ?? '')) return false;
        // A voice message is not a file anybody goes looking for in this list.
        return !isVoiceMessageContent(content);
      });
    return events.reverse();
  }, [room]);

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal size="300" flexHeight>
            <Box grow="Yes" direction="Column">
              <Header
                size="500"
                style={{ padding: config.space.S200, paddingLeft: config.space.S400 }}
              >
                <Box grow="Yes">
                  <Text size="H4">Files</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={requestClose}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>

              <Box grow="Yes">
                <Scroll className={ModalFlexScroll} size="300" hideTrack>
                  <Box style={{ padding: config.space.S400 }} direction="Column" gap="200">
                    {files.length === 0 && (
                      <Text size="T200" priority="300">
                        No attachments in the part of this room you have loaded. Scroll further back
                        to find older ones.
                      </Text>
                    )}

                    {files.length > 0 && (
                      <SequenceCard variant="SurfaceVariant" direction="Column" gap="100">
                        {files.map((mEvent) => {
                          const content = mEvent.getContent();
                          const sender = mEvent.getSender() ?? '';
                          const senderName =
                            getMemberDisplayName(room, sender) ??
                            getMxIdLocalPart(sender) ??
                            sender;
                          const size =
                            typeof content.info?.size === 'number'
                              ? bytesToSize(content.info.size)
                              : undefined;

                          return (
                            <MenuItem
                              key={mEvent.getId()}
                              size="400"
                              radii="300"
                              variant="Surface"
                              before={<Icon size="100" src={iconFor(content.msgtype)} />}
                              onClick={() => {
                                const eventId = mEvent.getId();
                                if (eventId) navigateRoom(room.roomId, eventId);
                                requestClose();
                              }}
                            >
                              <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
                                <Text size="T300" truncate>
                                  {typeof content.body === 'string' ? content.body : 'Attachment'}
                                </Text>
                                <Text size="T200" priority="300" truncate>
                                  {`${senderName} · ${timeDayMonthYear(
                                    mEvent.getTs(),
                                  )} ${timeHourMinute(mEvent.getTs(), hour24Clock)}${
                                    size ? ` · ${size}` : ''
                                  }`}
                                </Text>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </SequenceCard>
                    )}
                  </Box>
                </Scroll>
              </Box>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
