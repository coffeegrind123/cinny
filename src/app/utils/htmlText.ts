/**
 * Turning fragments of HTML that arrive from third-party APIs into plain text.
 *
 * Nothing here produces markup: the output is meant for React children, which
 * escape it. These helpers exist so an API's HTML (Hacker News comment bodies,
 * an escaped attribute value) can be *read* without ever being injected.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Decode the entity forms that actually occur in the wild — the five XML named
 * ones, `&nbsp;`, and numeric references in both decimal and hex. An unknown
 * entity is left exactly as it came rather than guessed at, so a literal
 * `&foo;` in someone's text survives unchanged.
 */
export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, name: string) => {
    const key = name.toLowerCase();
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    if (key.startsWith('#x')) {
      const code = parseInt(key.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith('#')) {
      const code = parseInt(key.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return match;
  });

/**
 * Flatten an HTML fragment to readable text: paragraph and line-break tags
 * become newlines, every other tag is dropped, entities are decoded, and runs
 * of blank lines collapse.
 *
 * Tag-stripping by regex is safe *because the result is never markup* — it is
 * handed to React as a string. The one thing it must not do is leave a
 * half-stripped tag that a caller might later treat as HTML, so `<` and `>`
 * that survive as text are exactly the ones that were `&lt;`/`&gt;` in the
 * source, decoded after the strip.
 */
export const htmlToPlainText = (html: string): string =>
  html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/?\s*p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => decodeHtmlEntities(line).trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
