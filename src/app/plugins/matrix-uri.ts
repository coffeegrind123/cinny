/**
 * Parsing for `matrix:` URIs (MSC2312) and matrix.to links.
 *
 * Both name the same things in different shapes — a room, a user, or an event
 * inside a room — and both arrive from outside the app: an OS deep link, a link
 * in another program, a QR code. Everything here treats the input as hostile
 * text and returns a narrow, typed result rather than something that gets
 * concatenated into a path.
 */

export type MatrixTarget =
  | { kind: 'user'; userId: string }
  | { kind: 'room'; roomIdOrAlias: string; eventId?: string; viaServers: string[] };

const SIGIL_BY_TYPE: Record<string, string> = {
  roomid: '!',
  r: '#',
  u: '@',
  user: '@',
  room: '#',
};

const isPlausibleId = (value: string): boolean =>
  /^[!#@][^\s:]+:[^\s:/]+(?::\d+)?$/.test(value) && value.length <= 255;

const isPlausibleEventId = (value: string): boolean =>
  value.startsWith('$') && value.length > 1 && value.length <= 255 && !/\s/.test(value);

/**
 * Parses a `matrix:` URI.
 *
 * Shapes handled: `matrix:u/alice:example.org`, `matrix:r/room:example.org`,
 * `matrix:roomid/abc:example.org/e/$event?via=example.org`.
 */
const parseMatrixScheme = (raw: string): MatrixTarget | undefined => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'matrix:') return undefined;

  // `matrix:` is an opaque-path URI, so the useful part is pathname, which the
  // URL parser leaves as-is. Strip any leading slash before splitting.
  const path = url.pathname.replace(/^\/+/, '');
  const parts = path.split('/').filter((part) => part !== '');
  if (parts.length < 2) return undefined;

  const [type, rawId, ...rest] = parts;
  const sigil = SIGIL_BY_TYPE[type.toLowerCase()];
  if (!sigil) return undefined;

  // The spec says the sigil is omitted in a matrix: URI, but plenty of things
  // in the wild include it anyway. Prepending unconditionally produced ids like
  // `@@alice:example.org`, which look almost right and resolve to nothing.
  const decoded = decodeURIComponent(rawId);
  const id = decoded.startsWith(sigil) ? decoded : `${sigil}${decoded}`;
  if (!isPlausibleId(id)) return undefined;

  if (sigil === '@') return { kind: 'user', userId: id };

  const viaServers = url.searchParams
    .getAll('via')
    .filter((server) => server !== '' && !/\s/.test(server))
    .slice(0, 10);

  // `.../e/$eventid`
  if (rest.length >= 2 && rest[0].toLowerCase() === 'e') {
    const eventId = `$${decodeURIComponent(rest[1]).replace(/^\$/, '')}`;
    if (isPlausibleEventId(eventId)) {
      return { kind: 'room', roomIdOrAlias: id, eventId, viaServers };
    }
  }

  return { kind: 'room', roomIdOrAlias: id, viaServers };
};

/** Parses `https://matrix.to/#/...` links. */
const parseMatrixTo = (raw: string): MatrixTarget | undefined => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.host !== 'matrix.to') return undefined;

  const fragment = url.hash.replace(/^#\/?/, '');
  if (!fragment) return undefined;

  // The query can sit after the room part OR after the event part — matrix.to
  // links in the wild do both. Taking it only from the room part silently lost
  // the `via` servers of exactly the links that need them: an event permalink
  // into a room you have not joined.
  const queryStart = fragment.indexOf('?');
  const query = queryStart === -1 ? '' : fragment.slice(queryStart + 1);
  const pathOnly = queryStart === -1 ? fragment : fragment.slice(0, queryStart);

  const [idPart, eventPart] = pathOnly.split('/');
  const id = decodeURIComponent(idPart);
  if (!isPlausibleId(id)) return undefined;

  if (id.startsWith('@')) return { kind: 'user', userId: id };

  const params = new URLSearchParams(query);
  const viaServers = params
    .getAll('via')
    .filter((server) => server !== '' && !/\s/.test(server))
    .slice(0, 10);

  if (eventPart) {
    const eventOnly = eventPart;
    const eventId = decodeURIComponent(eventOnly);
    if (isPlausibleEventId(eventId)) {
      return { kind: 'room', roomIdOrAlias: id, eventId, viaServers };
    }
  }

  return { kind: 'room', roomIdOrAlias: id, viaServers };
};

export const parseMatrixTarget = (raw: string): MatrixTarget | undefined => {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith('matrix:')) return parseMatrixScheme(trimmed);
  return parseMatrixTo(trimmed);
};
