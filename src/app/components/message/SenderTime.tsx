import { ComponentProps, ReactNode, useState } from 'react';
import { useHover } from 'react-aria';
import { Time, TimeProps } from './Time';
import { useUserTimezone } from '../../hooks/useUserTimezone';
import { formatInstantInTimezone } from '../../../types/matrix/profile';
import * as css from './SenderTime.css';

type SenderTimeProps = TimeProps & {
  /** Whose clock to show. Their MSC4175 time zone is looked up on hover. */
  senderId: string;
  /**
   * Rendered immediately after the timestamp text — a sending clock, a status
   * dot, anything that reads as belonging TO the time rather than next to it.
   *
   * It belongs in here rather than as a sibling of `SenderTime` because the
   * slot is sized to the sender-local string, which is invisible and — on the
   * days that string carries a date — wider than the timestamp. A sibling
   * therefore sat at the far edge of a gap it could not see the cause of,
   * looking unrelated to the message it was reporting on.
   */
  trailing?: ReactNode;
};

/**
 * A message timestamp that turns into the sender's local time while hovered.
 *
 * Answers the question a timestamp raises in a room spread across time zones —
 * not "when was this sent" but "what time was it *for them*". Reading that a
 * reply came at 03:40 their time is the difference between someone being slow
 * and someone being awake at four in the morning.
 *
 * The same instant on their clock, not the current time there: this is still the
 * message's timestamp, only somewhere else. (What time it is for them *now*
 * already appears in their profile.) Just the time, with no city after it — the
 * zone's name lives in the `title` instead, so the swapped-in string is the same
 * width as the timestamp it replaces. The date joins it only when the zone shift
 * moves the instant onto another day.
 *
 * Falls back to the ordinary timestamp whenever there is nothing better to
 * show: no zone set, a homeserver without extended profiles, or the lookup
 * still in flight. Nothing flickers and nothing is lost — the hover simply does
 * nothing, which is the correct behaviour for a user who has not published a
 * zone.
 */
export function SenderTime({
  senderId,
  trailing,
  ...timeProps
}: SenderTimeProps & ComponentProps<typeof Time>) {
  const [hovered, setHovered] = useState(false);
  // react-aria's useHover deliberately ignores touch, which is right here: this
  // is a pointer affordance, and on a touch screen it would either never fire
  // or fire on a tap meant for the message.
  const { hoverProps } = useHover({ onHoverChange: setHovered });

  const timezone = useUserTimezone(senderId, hovered);
  const senderLocal = timezone
    ? formatInstantInTimezone(
        timezone,
        new Date(timeProps.ts),
        timeProps.hour24Clock,
        timeProps.dateFormatString
      )
    : undefined;
  const showing = hovered && senderLocal !== undefined;

  // Hover belongs on the SLOT, not on the timestamp inside it. The slot is the
  // thing that holds still; tracking the inner element would put the pointer
  // back on a target that changes size under it, which is what made this
  // flicker in the first place.
  return (
    <span className={css.SenderTimeSlot} {...hoverProps}>
      <span className={css.SenderTimeVisible}>
        <Time
          {...timeProps}
          overrideText={showing ? senderLocal : undefined}
          // Names the zone in full — the visible string is now only a time, so
          // this is the one place that says WHERE that clock is. Only while the
          // swap is actually showing.
          title={showing ? `Local time for ${senderId} (${timezone})` : undefined}
        />
        {trailing}
      </span>
      {senderLocal !== undefined && (
        // The measuring copy carries `trailing` too: the swap must not change
        // the slot's width, and it would if only one of the two strings had the
        // icon's width added to it.
        <span className={css.SenderTimeSizer} aria-hidden>
          <Time {...timeProps} overrideText={senderLocal} />
          {trailing}
        </span>
      )}
    </span>
  );
}
