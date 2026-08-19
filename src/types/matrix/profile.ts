import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { RICH_PRESENCE_PROFILE_FIELDS } from './richPresence';

// Both are needed for `.tz()`: the timezone plugin is built on utc.
dayjs.extend(utc);
dayjs.extend(timezone);

export const MSC4247_PRONOUNS = 'io.fsky.nyx.pronouns';
export const M_PRONOUNS = 'm.pronouns';
export const MSC4427_BANNER = 'chat.commet.profile_banner';
export const M_BANNER_URL = 'm.banner_url';
export const MSC4440_BIOGRAPHY = 'gay.fomx.biography';
export const M_BIOGRAPHY = 'm.biography';
/**
 * MSC4175 time zone. Unlike the three fields above, this one is NOT a proposal:
 * `m.tz` has been a defined profile key since **Matrix 1.16**, and the
 * `/profile/{userId}/{keyName}` endpoint validates it against the pattern
 * `^(avatar_url|displayname|m\.tz|…)$`. The unstable key is still read because
 * clients that shipped it before 1.16 are still writing it.
 */
export const MSC4175_TIMEZONE = 'us.cloke.msc4175.tz';
export const M_TIMEZONE = 'm.tz';

export const USER_PROFILE_FIELDS = [
  ...RICH_PRESENCE_PROFILE_FIELDS,
  MSC4247_PRONOUNS,
  M_PRONOUNS,
  MSC4427_BANNER,
  M_BANNER_URL,
  MSC4440_BIOGRAPHY,
  M_BIOGRAPHY,
  MSC4175_TIMEZONE,
  M_TIMEZONE,
];

export type ProfilePronoun = {
  summary: string;
  language: string;
  grammaticalGender?: string;
};

const parsePronoun = (value: unknown): ProfilePronoun | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const content = value as Record<string, unknown>;
  if (typeof content.summary !== 'string' || typeof content.language !== 'string') return undefined;
  return {
    summary: content.summary,
    language: content.language,
    grammaticalGender:
      typeof content.grammatical_gender === 'string' ? content.grammatical_gender : undefined,
  };
};

export const getProfilePronouns = (profile: Record<string, unknown>): ProfilePronoun[] => {
  const value = profile[MSC4247_PRONOUNS] ?? profile[M_PRONOUNS];
  return Array.isArray(value)
    ? value.map(parsePronoun).filter((pronoun): pronoun is ProfilePronoun => !!pronoun)
    : [];
};

export const getProfileBanner = (profile: Record<string, unknown>): string | undefined => {
  const value = profile[MSC4427_BANNER] ?? profile[M_BANNER_URL];
  return typeof value === 'string' && value.startsWith('mxc://') ? value : undefined;
};

export const getProfileBiography = (profile: Record<string, unknown>): string | undefined => {
  const value = profile[MSC4440_BIOGRAPHY] ?? profile[M_BIOGRAPHY];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const text = (value as Record<string, unknown>)['m.text'];
  if (!Array.isArray(text)) return undefined;
  const representation = text.find((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const content = item as Record<string, unknown>;
    return typeof content.body === 'string' && content.mimetype !== 'text/html';
  }) as Record<string, unknown> | undefined;
  return representation ? String(representation.body) : undefined;
};

/**
 * The user's IANA time zone, e.g. `Europe/Helsinki`.
 *
 * Validated against the runtime's own ICU data rather than trusted: this string
 * arrives from another user's profile and is fed straight to
 * `Intl.DateTimeFormat`, which THROWS a RangeError on an unknown zone. An
 * unvalidated value therefore turns someone else's profile into a blank screen.
 */
export const getProfileTimezone = (profile: Record<string, unknown>): string | undefined => {
  const value = profile[M_TIMEZONE] ?? profile[MSC4175_TIMEZONE];
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return undefined;
  return isValidTimezone(value) ? value : undefined;
};

/** True when the runtime recognises `tz` as an IANA time zone identifier. */
export const isValidTimezone = (tz: string): boolean => {
  try {
    // Constructing is the validation — `Intl.DateTimeFormat` throws a
    // RangeError on an unknown zone (verified) and there is no predicate form.
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * `HH:MM` in `tz`, or undefined if the zone is unusable.
 *
 * Formatted with an explicit `en-GB` locale and `hourCycle`, not the viewer's
 * locale: the string sits next to a label that already says whose time it is,
 * and a 12-hour rendering there reads as ambiguous without an am/pm the layout
 * has no room for.
 */
export const formatTimeInTimezone = (tz: string, at: Date = new Date()): string | undefined => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(at);
  } catch {
    return undefined;
  }
};

/**
 * A specific instant, as the clock read in `tz`. Undefined if the zone is unusable.
 *
 * The date is included **only when the instant falls on a different calendar day
 * there than it does here**, and that condition is the whole point of the
 * function rather than a detail. A message sent at 23:30 in London is 08:30 the
 * NEXT DAY in Tokyo; rendering that as a bare "08:30" beside a message dated
 * yesterday is not a time-zone conversion, it is a wrong timestamp — and the
 * cases where the reader most wants to know the sender's local time (someone
 * messaging in the middle of their night) are exactly the cases where the day
 * has rolled over.
 *
 * Not included when the day matches, because then it is noise: the surrounding
 * timeline already establishes the date.
 *
 * The zone's CITY is deliberately not part of the string. It used to be
 * appended ("15:40 Helsinki") on the argument that a bare time is not visibly
 * anyone else's, but it cost more than it explained: the slot in `SenderTime`
 * is sized to hold this string, so every message from a sender with a
 * published zone reserved a city's width of invisible space, and in the
 * avatar-gutter timestamp — which is right-aligned inside a fixed box — that
 * pushed the visible time bodily to the left of where it belongs. The zone is
 * still named in full in the element's `title`, which is where someone asking
 * "where are they?" rather than "what time is it for them?" can read it.
 */
export const formatInstantInTimezone = (
  tz: string,
  at: Date,
  hour24Clock: boolean,
  dateFormatString: string
): string | undefined => {
  try {
    // Formatted through dayjs with the caller's settings rather than a fixed
    // locale, so a timestamp reads the same whichever clock it is on: the same
    // `HH:mm` / `hh:mm A` the timeline uses for the 24-hour setting, and the
    // date pattern chosen in Settings -> General rather than a hardcoded
    // "19 Aug". `.tz()` throws on an unusable zone, which the catch answers.
    const there = dayjs(at).tz(tz);
    const time = there.format(hour24Clock ? 'HH:mm' : 'hh:mm A');

    // ISO-ordered on both sides, so the days are comparable as strings.
    const sameDay = there.format('YYYY-MM-DD') === dayjs(at).format('YYYY-MM-DD');
    if (sameDay) return time;

    return `${there.format(dateFormatString)} ${time}`;
  } catch {
    return undefined;
  }
};
