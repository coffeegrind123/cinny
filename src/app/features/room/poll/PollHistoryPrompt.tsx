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
import { Room } from 'matrix-js-sdk';
import { stopPropagation } from '../../../utils/keyboard';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { timeDayMonthYear, timeHourMinute } from '../../../utils/time';

type PollHistoryPromptProps = {
  room: Room;
  requestClose: () => void;
};

/**
 * Every poll the client currently knows about in this room, newest first.
 *
 * Scope worth stating plainly: this lists the polls the sdk has processed from
 * the timeline you have actually loaded, not every poll ever sent. Scrolling
 * further back fills it in. There is no server-side "list polls" API to do
 * better with.
 */
export function PollHistoryPrompt({ room, requestClose }: PollHistoryPromptProps) {
  const { navigateRoom } = useRoomNavigate();
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');

  const polls = useMemo(
    () => Array.from(room.polls.values()).sort((a, b) => b.rootEvent.getTs() - a.rootEvent.getTs()),
    [room],
  );

  const active = polls.filter((poll) => !poll.isEnded);
  const ended = polls.filter((poll) => poll.isEnded);

  const renderPoll = (poll: (typeof polls)[number]) => {
    const eventId = poll.rootEvent.getId();
    return (
      <MenuItem
        key={poll.pollId}
        size="400"
        radii="300"
        variant="Surface"
        onClick={() => {
          if (eventId) navigateRoom(room.roomId, eventId);
          requestClose();
        }}
        after={<Icon size="50" src={Icons.ArrowRight} />}
      >
        <Box grow="Yes" direction="Column">
          <Text size="T300" truncate>
            {poll.pollEvent.question.text}
          </Text>
          <Text size="T200" priority="300">
            {`${timeDayMonthYear(poll.rootEvent.getTs())} ${timeHourMinute(
              poll.rootEvent.getTs(),
              hour24Clock,
            )}`}
          </Text>
        </Box>
      </MenuItem>
    );
  };

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
          <Modal size="300">
            <Box grow="Yes" direction="Column">
              <Header
                size="500"
                style={{ padding: config.space.S200, paddingLeft: config.space.S400 }}
              >
                <Box grow="Yes">
                  <Text size="H4">Polls</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={requestClose}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>

              <Box grow="Yes">
                <Scroll size="300" hideTrack>
                  <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                    {polls.length === 0 && (
                      <Text size="T200" priority="300">
                        No polls in the part of this room you have loaded.
                      </Text>
                    )}

                    {active.length > 0 && (
                      <Box direction="Column" gap="100">
                        <Text size="L400">Active</Text>
                        <SequenceCard variant="SurfaceVariant" direction="Column" gap="100">
                          {active.map(renderPoll)}
                        </SequenceCard>
                      </Box>
                    )}

                    {ended.length > 0 && (
                      <Box direction="Column" gap="100">
                        <Text size="L400">Ended</Text>
                        <SequenceCard variant="SurfaceVariant" direction="Column" gap="100">
                          {ended.map(renderPoll)}
                        </SequenceCard>
                      </Box>
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
