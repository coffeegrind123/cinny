import { useCallback, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, color } from 'folds';
import classNames from 'classnames';
import { MatrixEvent, RelationType, Room } from 'matrix-js-sdk';
import { M_POLL_END, M_POLL_RESPONSE } from 'matrix-js-sdk/lib/@types/polls';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { PollState, usePoll } from '../../../hooks/usePoll';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import * as css from './PollContent.css';

type PollOptionProps = {
  text: string;
  count: number;
  totalVotes: number;
  selected: boolean;
  winner: boolean;
  showResults: boolean;
  disabled: boolean;
  onClick: () => void;
};

function PollOption({
  text,
  count,
  totalVotes,
  selected,
  winner,
  showResults,
  disabled,
  onClick,
}: PollOptionProps) {
  const share = totalVotes > 0 ? count / totalVotes : 0;

  return (
    <button
      type="button"
      className={classNames(
        css.PollOption,
        selected && css.PollOptionSelected,
        winner && css.PollOptionWinner,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      {showResults && (
        <span className={css.PollOptionBar} style={{ transform: `scaleX(${share})` }} />
      )}
      <Box className={css.PollOptionContent} alignItems="Center" gap="200">
        <Box shrink="No">
          <Icon
            size="50"
            src={selected ? Icons.CheckTwice : Icons.Check}
            style={{ opacity: selected ? 1 : 0.25 }}
          />
        </Box>
        <Box grow="Yes">
          <Text size="T300">{text}</Text>
        </Box>
        {showResults && (
          <Box shrink="No">
            <Text size="T200" priority="300">
              {count === 1 ? '1 vote' : `${count} votes`}
            </Text>
          </Box>
        )}
      </Box>
    </button>
  );
}

export type PollContentProps = {
  room: Room;
  mEvent: MatrixEvent;
  /** Whether the viewer may end this poll (its sender, or a redactor). */
  canEnd?: boolean;
};

/**
 * A poll, with live tallies.
 *
 * Undisclosed polls deliberately show no counts at all until they end — not
 * even your own — because revealing a running tally is the whole thing that
 * kind of poll exists to avoid.
 */
export function PollContent({ room, mEvent, canEnd }: PollContentProps) {
  const mx = useMatrixClient();
  const poll: PollState | undefined = usePoll(room, mEvent);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const pollId = mEvent.getId();

  const [voteState, vote] = useAsyncCallback<undefined, Error, [string]>(
    useCallback(
      async (answerId) => {
        if (!pollId) return undefined;
        await mx.sendEvent(
          room.roomId,
          M_POLL_RESPONSE.name as any,
          {
            'm.relates_to': {
              rel_type: RelationType.Reference,
              event_id: pollId,
            },
            [M_POLL_RESPONSE.name]: {
              answers: [answerId],
            },
          } as any,
        );
        return undefined;
      },
      [mx, room.roomId, pollId],
    ),
  );

  const [endState, endPoll] = useAsyncCallback<undefined, Error, []>(
    useCallback(async () => {
      if (!pollId) return undefined;
      await mx.sendEvent(
        room.roomId,
        M_POLL_END.name as any,
        {
          'm.relates_to': {
            rel_type: RelationType.Reference,
            event_id: pollId,
          },
          [M_POLL_END.name]: {},
          // Fallback text for clients that do not understand poll ends.
          'org.matrix.msc1767.text': 'The poll has closed. Top answer(s) shown.',
        } as any,
      );
      return undefined;
    }, [mx, room.roomId, pollId]),
  );

  if (!poll) {
    // The sdk fills room.polls as it processes timeline events, so a poll from
    // backfill is legitimately missing for a tick. Show the fallback text the
    // sender included rather than claiming it is broken.
    const fallback = mEvent.getContent()['org.matrix.msc1767.text'];
    return (
      <Box direction="Column" gap="100">
        <Text size="T300" style={{ whiteSpace: 'pre-wrap' }}>
          {typeof fallback === 'string' ? fallback : 'Poll'}
        </Text>
        <Box alignItems="Center" gap="200">
          <Spinner size="100" variant="Secondary" />
          <Text size="T200" priority="300">
            Loading poll…
          </Text>
        </Box>
      </Box>
    );
  }

  // Counts stay hidden on a running undisclosed poll. Once it ends, the results
  // are published in the end event's own right and everyone sees them.
  const showResults = poll.ended || poll.disclosed;
  const voting = voteState.status === AsyncStatus.Loading;

  return (
    <Box direction="Column" gap="200" style={{ minWidth: 0 }}>
      <Text size="T400">
        <b>{poll.question}</b>
      </Text>

      {poll.loading && (
        <Box alignItems="Center" gap="200">
          <Spinner size="100" variant="Secondary" />
          <Text size="T200" priority="300">
            Counting votes…
          </Text>
        </Box>
      )}

      <Box direction="Column" gap="100">
        {poll.answers.map((answer) => (
          <PollOption
            key={answer.id}
            text={answer.text}
            count={answer.count}
            totalVotes={poll.totalVotes}
            selected={answer.mine}
            winner={answer.winner}
            showResults={showResults}
            disabled={poll.ended || voting}
            onClick={() => vote(answer.id)}
          />
        ))}
      </Box>

      <Box alignItems="Center" gap="200" wrap="Wrap">
        <Text size="T200" priority="300">
          {(() => {
            if (poll.ended) {
              return poll.totalVotes === 1
                ? 'Final result — 1 vote'
                : `Final result — ${poll.totalVotes} votes`;
            }
            if (!poll.disclosed) return 'Results are hidden until the poll ends';
            if (poll.totalVotes === 0) return 'No votes yet';
            return poll.totalVotes === 1 ? '1 vote' : `${poll.totalVotes} votes`;
          })()}
        </Text>

        {poll.undecryptableCount > 0 && (
          <Text size="T200" style={{ color: color.Warning.Main }}>
            {`${poll.undecryptableCount} vote(s) could not be decrypted and are not counted.`}
          </Text>
        )}

        {voteState.status === AsyncStatus.Error && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            Your vote could not be sent.
          </Text>
        )}
      </Box>

      {!poll.ended && canEnd && (
        <Box alignItems="Center" gap="200">
          {confirmEnd ? (
            <>
              <Text size="T200">Ending a poll is permanent.</Text>
              <Button
                size="300"
                radii="300"
                variant="Critical"
                fill="Soft"
                onClick={() => endPoll()}
                disabled={endState.status === AsyncStatus.Loading}
              >
                <Text size="B300">End poll</Text>
              </Button>
              <Button
                size="300"
                radii="300"
                variant="Secondary"
                fill="None"
                onClick={() => setConfirmEnd(false)}
              >
                <Text size="B300">Cancel</Text>
              </Button>
            </>
          ) : (
            <Button
              size="300"
              radii="300"
              variant="Secondary"
              fill="Soft"
              outlined
              onClick={() => setConfirmEnd(true)}
            >
              <Text size="B300">End poll</Text>
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
