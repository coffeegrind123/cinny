import { useCallback, useEffect } from 'react';
import {
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { MatrixEvent, RelationType, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { stopPropagation } from '../../../utils/keyboard';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { timeDayMonthYear, timeHourMinute } from '../../../utils/time';

type Revision = {
  ts: number;
  body: string;
};

/**
 * Pulls every edit of an event from the server, oldest first, with the
 * original as the first entry.
 *
 * Server-side rather than from the local timeline on purpose: the timeline only
 * holds the edits that happened to arrive in this session, so a message edited
 * before you opened the app would show a history with nothing in it.
 */
const fetchRevisions = async (
  mx: ReturnType<typeof useMatrixClient>,
  room: Room,
  mEvent: MatrixEvent,
): Promise<Revision[]> => {
  const eventId = mEvent.getId();
  if (!eventId) return [];

  const edits: MatrixEvent[] = [];
  let from: string | undefined;

  // Paginate rather than taking the first page: a much-edited message has more
  // than one page of replacements, and the interesting one is usually the
  // original at the far end.
  for (let page = 0; page < 10; page += 1) {
    const result = await mx.relations(
      room.roomId,
      eventId,
      RelationType.Replace,
      null,
      from ? { from } : undefined,
    );
    edits.push(...result.events);
    if (!result.nextBatch) break;
    from = result.nextBatch;
  }

  const originalBody = mEvent.getContent().body;
  const revisions: Revision[] = [
    {
      ts: mEvent.getTs(),
      body: typeof originalBody === 'string' ? originalBody : '',
    },
  ];

  edits
    // Only the original sender can edit; anything else claiming to replace this
    // event is not a revision of it.
    .filter((edit) => edit.getSender() === mEvent.getSender())
    .sort((a, b) => a.getTs() - b.getTs())
    .forEach((edit) => {
      const newContent = edit.getContent()['m.new_content'];
      const body = newContent?.body ?? edit.getContent().body;
      revisions.push({
        ts: edit.getTs(),
        body: typeof body === 'string' ? body : '',
      });
    });

  return revisions;
};

type EditHistoryPromptProps = {
  room: Room;
  mEvent: MatrixEvent;
  requestClose: () => void;
};

export function EditHistoryPrompt({ room, mEvent, requestClose }: EditHistoryPromptProps) {
  const mx = useMatrixClient();
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');

  const [state, load] = useAsyncCallback<Revision[], Error, []>(
    useCallback(() => fetchRevisions(mx, room, mEvent), [mx, room, mEvent]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const revisions = state.status === AsyncStatus.Success ? state.data : [];

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
                style={{
                  padding: config.space.S200,
                  paddingLeft: config.space.S400,
                }}
              >
                <Box grow="Yes">
                  <Text size="H4">Edit History</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={requestClose}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>

              <Box grow="Yes">
                <Scroll size="300" hideTrack>
                  <Box style={{ padding: config.space.S400 }} direction="Column" gap="300">
                    {state.status === AsyncStatus.Loading && (
                      <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
                        <Spinner variant="Secondary" size="400" />
                      </Box>
                    )}

                    {state.status === AsyncStatus.Error && (
                      <Text size="T200" style={{ color: color.Critical.Main }}>
                        Could not load the edit history from the server.
                      </Text>
                    )}

                    {state.status === AsyncStatus.Success && revisions.length <= 1 && (
                      <Text size="T200" priority="300">
                        No earlier versions are available. The server may have expired them.
                      </Text>
                    )}

                    {revisions.map((revision, index) => (
                      <SequenceCard
                        key={`${revision.ts}-${index}`}
                        variant="SurfaceVariant"
                        direction="Column"
                        gap="100"
                        style={{ padding: config.space.S300 }}
                      >
                        <Text size="L400" priority="300">
                          {index === 0 ? 'Original' : `Edit ${index}`} —{' '}
                          {timeDayMonthYear(revision.ts)} {timeHourMinute(revision.ts, hour24Clock)}
                        </Text>
                        <Text size="T300" style={{ whiteSpace: 'pre-wrap' }}>
                          {revision.body}
                        </Text>
                      </SequenceCard>
                    ))}
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
