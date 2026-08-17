import { ComponentProps, useState } from 'react';
import { useHover } from 'react-aria';
import { Time, TimeProps } from './Time';
import { useUserTimezone } from '../../hooks/useUserTimezone';
import { formatInstantInTimezone } from '../../../types/matrix/profile';

type SenderTimeProps = TimeProps & {
  /** Whose clock to show. Their MSC4175 time zone is looked up on hover. */
  senderId: string;
};

/**
 * A message timestamp that turns into the sender's local time while hovered.
 *
 * Answers the question a timestamp raises in a room spread across time zones —
 * not "when was this sent" but "what time was it *for them*". Reading that a
 * reply came at 03:40 their time is the difference between someone being slow
 * and someone being awake at four in the morning.
 *
 * The same instant in their zone, not the current time there: this is still the
 * message's timestamp, only on their clock. (What time it is for them *now*
 * already appears in their profile.) `formatInstantInTimezone` adds the date
 * when the zone shift moves the instant onto another day, which is exactly when
 * this is most worth reading.
 *
 * Falls back to the ordinary timestamp whenever there is nothing better to
 * show: no zone set, a homeserver without extended profiles, or the lookup
 * still in flight. Nothing flickers and nothing is lost — the hover simply does
 * nothing, which is the correct behaviour for a user who has not published a
 * zone.
 */
export function SenderTime({
  senderId,
  ...timeProps
}: SenderTimeProps & ComponentProps<typeof Time>) {
  const [hovered, setHovered] = useState(false);
  // react-aria's useHover deliberately ignores touch, which is right here: this
  // is a pointer affordance, and on a touch screen it would either never fire
  // or fire on a tap meant for the message.
  const { hoverProps } = useHover({ onHoverChange: setHovered });

  const timezone = useUserTimezone(senderId, hovered);
  const senderLocal = timezone
    ? formatInstantInTimezone(timezone, new Date(timeProps.ts))
    : undefined;
  const showing = hovered && senderLocal !== undefined;

  return (
    <Time
      {...hoverProps}
      {...timeProps}
      overrideText={showing ? senderLocal : undefined}
      // Names the zone, so the swapped-in time is not a number with no
      // explanation. Only while it is actually swapped in.
      title={showing ? `${senderLocal} — local time for ${senderId} (${timezone})` : undefined}
    />
  );
}
