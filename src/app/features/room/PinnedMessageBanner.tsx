import { useMemo, useState } from 'react';
import { Box, Icon, IconButton, Icons, Text, as, color, config, toRem } from 'folds';
import { useAtom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { useRoomPinnedEvents } from '../../hooks/useRoomPinnedEvents';
import { useRoomEvent } from '../../hooks/useRoomEvent';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { dismissedPinBannerAtom } from '../../state/dismissedPinBanner';
import { getMemberDisplayName, trimReplyFromBody } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';

type PinnedMessageBannerProps = {
  room: Room;
};

/**
 * One-line strip above the composer showing the newest pinned message.
 *
 * The pin list already lives in the room menu; this exists because a pin nobody
 * opens the menu to look at may as well not be pinned. Clicking jumps to the
 * message, the counter cycles through older pins, and dismissing hides only the
 * pin you dismissed — pinning something new brings the banner back.
 */
export const PinnedMessageBanner = as<'div', PinnedMessageBannerProps>(
  ({ room, ...props }, ref) => {
    const pinnedEvents = useRoomPinnedEvents(room);
    const { navigateRoom } = useRoomNavigate();
    const [dismissed, setDismissed] = useAtom(dismissedPinBannerAtom);
    const [index, setIndex] = useState(0);

    // Newest pin first — the state event appends, so the tail is the latest.
    const ordered = useMemo(() => Array.from(pinnedEvents).reverse(), [pinnedEvents]);
    const safeIndex = ordered.length > 0 ? index % ordered.length : 0;
    const eventId: string | undefined = ordered[safeIndex];

    const mEvent = useRoomEvent(room, eventId ?? '');

    if (ordered.length === 0) return null;
    if (!eventId) return null;
    if (dismissed[room.roomId] === ordered[0]) return null;

    // `undefined` is still loading, `null` failed to fetch. Neither is worth a
    // spinner in a strip this small — show nothing until there is something.
    if (!mEvent) return null;
    if (mEvent.isRedacted()) return null;

    const sender = mEvent.getSender();
    const senderName = sender
      ? (getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender)
      : '';
    const content = mEvent.getContent();
    const rawBody = typeof content.body === 'string' ? content.body : '';
    const body = trimReplyFromBody(rawBody);

    return (
      <Box
        alignItems="Center"
        gap="200"
        style={{
          padding: `${config.space.S100} ${config.space.S300}`,
          backgroundColor: color.SurfaceVariant.Container,
          borderLeft: `${config.borderWidth.B500} solid ${color.Primary.Main}`,
          borderRadius: config.radii.R300,
          marginBottom: config.space.S100,
        }}
        {...props}
        ref={ref}
      >
        <Box shrink="No">
          <Icon size="50" src={Icons.Pin} />
        </Box>

        <Box
          as="button"
          grow="Yes"
          alignItems="Center"
          gap="200"
          onClick={() => navigateRoom(room.roomId, eventId)}
          style={{
            minWidth: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'start',
          }}
          title={`${senderName}: ${body}`}
        >
          <Text size="T200" priority="300" style={{ flexShrink: 0, maxWidth: toRem(120) }} truncate>
            {senderName}
          </Text>
          <Text size="T200" truncate>
            {body}
          </Text>
        </Box>

        {ordered.length > 1 && (
          <Box shrink="No" alignItems="Center" gap="100">
            <Text size="T200" priority="300">
              {`${safeIndex + 1}/${ordered.length}`}
            </Text>
            <IconButton
              size="300"
              radii="300"
              variant="SurfaceVariant"
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Show next pinned message"
            >
              <Icon size="50" src={Icons.ChevronRight} />
            </IconButton>
          </Box>
        )}

        <Box shrink="No">
          <IconButton
            size="300"
            radii="300"
            variant="SurfaceVariant"
            onClick={() => setDismissed((prev) => ({ ...prev, [room.roomId]: ordered[0] }))}
            aria-label="Hide pinned message"
          >
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
        </Box>
      </Box>
    );
  },
);
