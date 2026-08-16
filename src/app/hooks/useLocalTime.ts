import { useCallback, useEffect, useState } from 'react';
import { useInterval } from './useInterval';
import { formatTimeInTimezone } from '../../types/matrix/profile';

/**
 * The current `HH:MM` in `tz` (MSC4175), refreshed while it is on screen.
 *
 * Returns `undefined` when there is no time zone or the runtime rejects it, so
 * the caller renders nothing rather than a stale or wrong clock.
 *
 * The tick is 15s rather than 60s deliberately: a 60s timer started at an
 * arbitrary moment lands, on average, 30 seconds after the minute rolls over,
 * so the displayed time is visibly wrong for up to a minute. 15s bounds that
 * error without being a busy loop, and the state only changes when the rendered
 * string actually differs.
 */
export const useLocalTime = (tz: string | undefined): string | undefined => {
  const [time, setTime] = useState(() => (tz ? formatTimeInTimezone(tz) : undefined));

  useEffect(() => {
    setTime(tz ? formatTimeInTimezone(tz) : undefined);
  }, [tz]);

  const tick = useCallback(() => {
    if (!tz) return;
    const next = formatTimeInTimezone(tz);
    setTime((prev) => (prev === next ? prev : next));
  }, [tz]);

  useInterval(tick, tz ? 15000 : -1);

  return time;
};
