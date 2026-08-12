import { FormEventHandler, useCallback, useState } from 'react';
import {
  Box,
  Button,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Switch,
  Text,
  color,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { Room } from 'matrix-js-sdk';
import { PollStartEvent } from 'matrix-js-sdk/lib/extensible_events_v1/PollStartEvent';
import { M_POLL_KIND_DISCLOSED, M_POLL_KIND_UNDISCLOSED } from 'matrix-js-sdk/lib/@types/polls';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { stopPropagation } from '../../../utils/keyboard';
import { useAlive } from '../../../hooks/useAlive';
import { SettingTile } from '../../../components/setting-tile';
import { ModalFlexScroll } from '../../../styles/Modal.css';

const MIN_ANSWERS = 2;
const MAX_ANSWERS = 20;

type PollCreatePromptProps = {
  room: Room;
  requestClose: () => void;
};

export function PollCreatePrompt({ room, requestClose }: PollCreatePromptProps) {
  const mx = useMatrixClient();
  const alive = useAlive();

  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [disclosed, setDisclosed] = useState(true);

  const setAnswer = (index: number, value: string) =>
    setAnswers((prev) => prev.map((answer, i) => (i === index ? value : answer)));

  const addAnswer = () => setAnswers((prev) => (prev.length >= MAX_ANSWERS ? prev : [...prev, '']));

  const removeAnswer = (index: number) =>
    setAnswers((prev) => (prev.length <= MIN_ANSWERS ? prev : prev.filter((_, i) => i !== index)));

  const filledAnswers = answers.map((a) => a.trim()).filter((a) => a !== '');
  const valid = question.trim() !== '' && filledAnswers.length >= MIN_ANSWERS;

  const [sendState, send] = useAsyncCallback<undefined, Error, []>(
    useCallback(async () => {
      const pollEvent = PollStartEvent.from(
        question.trim(),
        filledAnswers,
        disclosed ? M_POLL_KIND_DISCLOSED.name : M_POLL_KIND_UNDISCLOSED.name,
      ).serialize();

      await mx.sendEvent(room.roomId, pollEvent.type as any, pollEvent.content as any);
      return undefined;
    }, [mx, room.roomId, question, filledAnswers, disclosed]),
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!valid) return;
    send().then(() => {
      if (alive()) requestClose();
    });
  };

  const sending = sendState.status === AsyncStatus.Loading;

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
                  <Text size="H4">Create Poll</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={requestClose}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>

              <Box grow="Yes" as="form" onSubmit={handleSubmit} direction="Column">
                <Box grow="Yes">
                  <Scroll className={ModalFlexScroll} size="300" hideTrack>
                    <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                      <Box direction="Column" gap="100">
                        <Text size="L400">Question</Text>
                        <Input
                          value={question}
                          onChange={(evt) => setQuestion(evt.currentTarget.value)}
                          variant="Background"
                          size="400"
                          radii="300"
                          placeholder="What are we deciding?"
                          autoFocus
                        />
                      </Box>

                      <Box direction="Column" gap="100">
                        <Text size="L400">Answers</Text>
                        {answers.map((answer, index) => (
                          <Box
                            // Answers are positional and may repeat while being
                            // typed, so there is no stable id to key on.

                            key={index}
                            gap="200"
                            alignItems="Center"
                          >
                            {/* Column, so the field stretches to the row
                                rather than sizing to its placeholder — folds'
                                Input has no width of its own. */}
                            <Box grow="Yes" direction="Column">
                              <Input
                                value={answer}
                                onChange={(evt) => setAnswer(index, evt.currentTarget.value)}
                                variant="Background"
                                size="400"
                                radii="300"
                                placeholder={`Answer ${index + 1}`}
                              />
                            </Box>
                            <Box shrink="No">
                              <IconButton
                                type="button"
                                size="300"
                                radii="300"
                                variant="SurfaceVariant"
                                onClick={() => removeAnswer(index)}
                                disabled={answers.length <= MIN_ANSWERS}
                                aria-label={`Remove answer ${index + 1}`}
                              >
                                <Icon size="50" src={Icons.Cross} />
                              </IconButton>
                            </Box>
                          </Box>
                        ))}
                        <Box>
                          <Button
                            type="button"
                            size="300"
                            radii="300"
                            variant="Secondary"
                            fill="Soft"
                            outlined
                            onClick={addAnswer}
                            disabled={answers.length >= MAX_ANSWERS}
                            before={<Icon size="50" src={Icons.Plus} />}
                          >
                            <Text size="B300">Add answer</Text>
                          </Button>
                        </Box>
                      </Box>

                      <SettingTile
                        title="Show results as people vote"
                        description="Turn this off to keep the tally hidden until you end the poll."
                        after={
                          <Switch variant="Primary" value={disclosed} onChange={setDisclosed} />
                        }
                      />

                      {sendState.status === AsyncStatus.Error && (
                        <Text size="T200" style={{ color: color.Critical.Main }}>
                          The poll could not be sent.
                        </Text>
                      )}
                    </Box>
                  </Scroll>
                </Box>

                <Box
                  shrink="No"
                  direction="Column"
                  style={{
                    padding: config.space.S400,
                    borderTopWidth: config.borderWidth.B300,
                  }}
                >
                  <Button
                    type="submit"
                    variant="Primary"
                    disabled={!valid || sending}
                    before={
                      sending ? <Spinner fill="Solid" variant="Primary" size="200" /> : undefined
                    }
                  >
                    <Text size="B400">Create Poll</Text>
                  </Button>
                </Box>
              </Box>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
