import { IEventWithRoomId, IResultContext, Room } from 'matrix-js-sdk';
import { Box, Text, toRem } from 'folds';
import { getResultDisplayName, getResultProfile } from './resultUtils';

const getPlainBody = (event: IEventWithRoomId): string | undefined => {
  if (event.unsigned?.redacted_because) return undefined;
  const content = event.content as { body?: unknown; 'm.new_content'?: { body?: unknown } };
  const body = content['m.new_content']?.body ?? content.body;
  if (typeof body !== 'string') return undefined;
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type SearchResultContextProps = {
  room: Room;
  context: IResultContext | undefined;
  /** which side of the match these events sit on */
  position: 'before' | 'after';
};
/**
 * Single-line, de-emphasised preview of the messages surrounding a match, so a
 * hit can be read without leaving the results list.
 */
export function SearchResultContext({ room, context, position }: SearchResultContextProps) {
  const events = position === 'before' ? context?.events_before : context?.events_after;
  if (!events || events.length === 0) return null;

  // server returns `events_before` newest first; read them oldest first
  const ordered = position === 'before' ? [...events].reverse() : events;

  return (
    <Box direction="Column">
      {ordered.map((event) => {
        const body = getPlainBody(event);
        if (!body) return null;
        const displayName = getResultDisplayName(
          room,
          event.sender,
          getResultProfile(context, event.sender),
        );

        return (
          <Box key={event.event_id} gap="200" alignItems="Baseline">
            <Text
              style={{ flexShrink: 0, maxWidth: toRem(140) }}
              size="T200"
              priority="300"
              truncate
            >
              {displayName}
            </Text>
            <Text size="T200" priority="300" truncate>
              {body}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
