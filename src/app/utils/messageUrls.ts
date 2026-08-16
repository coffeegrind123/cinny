import { URL_REG } from './regex';
import { trimReplyFromFormattedBody } from './room';
import { decodeHtmlEntities } from './htmlText';

/**
 * Which links in a message get a preview card.
 *
 * Scanning the plain `body` with a regex is not enough on its own, because the
 * plain body is prose — it is whatever the sending client thought a human
 * should read, and it is allowed to disagree with the actual link target. The
 * failure that motivated this is a link whose path contains spaces:
 *
 *   body:           https://host/misc/12 - Pan Sonic - Tykitys.mp3
 *   formatted_body: <a href="https://host/misc/12%20-%20Pan%20Sonic%20-%20Tykitys.mp3">…</a>
 *
 * A URL regex has to stop at the first space, so the body scan yields
 * `https://host/misc/12` — a URL that 404s, has no file extension, and
 * therefore never reaches the direct-audio player. The card silently degrades
 * to a dead generic preview of a URL nobody sent. The same mismatch happens
 * with `<https://…>` bracket-wrapped links (trailing `>` swallowed into the
 * match) and with markdown-style links whose text is not the target at all.
 *
 * The anchor hrefs in `formatted_body` are the real targets, so they win. The
 * body scan is still consulted, because plenty of clients emit a formatted
 * body that leaves bare URLs un-anchored (`<b>look</b> https://example.com`),
 * and those links would otherwise lose their preview.
 */

// Only `href` on an anchor, and only quoted values. Regex rather than
// DOMParser because this runs on every rendered message in the timeline and
// `parseFromString` on each one is a per-message DOM build; the value is
// re-validated as a web URL below, and nothing here is injected anywhere.
const ANCHOR_HREF_REG = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

const HTTP_SCHEME_REG = /^https?:\/\//i;

const anchorHrefs = (formattedBody: string): string[] => {
  // Cheap bail-out for the overwhelmingly common case of a formatted body with
  // no links in it at all, so the scan below only runs where it can pay off.
  if (!formattedBody.includes('href')) return [];

  const hrefs: string[] = [];
  ANCHOR_HREF_REG.lastIndex = 0;
  let match = ANCHOR_HREF_REG.exec(formattedBody);
  while (match !== null) {
    const raw = match[1] ?? match[2] ?? '';
    const href = decodeHtmlEntities(raw).trim();
    // http(s) only: `mailto:`, `matrix:` and relative hrefs are not previewable
    // and must never be handed to a fetch.
    if (HTTP_SCHEME_REG.test(href)) hrefs.push(href);
    match = ANCHOR_HREF_REG.exec(formattedBody);
  }
  return hrefs;
};

/**
 * True when a body-scanned URL is the damaged twin of a link we already have
 * from an anchor, rather than a distinct link of its own:
 *
 *  - the anchor href starts with it — the body scan truncated it (spaces);
 *  - it contains the anchor href — the body scan over-ran it (`<url>`, or a
 *    trailing character the anchor does not have).
 *
 * Either way the anchor is the accurate one and the body's version would only
 * add a second, broken card for the same link.
 */
const supersededByAnchor = (bodyUrl: string, hrefs: string[]): boolean =>
  hrefs.some((href) => href === bodyUrl || href.startsWith(bodyUrl) || bodyUrl.includes(href));

export const extractPreviewUrls = (body: string, formattedBody?: string): string[] => {
  // `body` reaches this function with the reply fallback already trimmed; the
  // formatted body must get the same treatment or a reply would preview every
  // link in the message it quotes, none of which the replier sent.
  const hrefs =
    typeof formattedBody === 'string' ? anchorHrefs(trimReplyFromFormattedBody(formattedBody)) : [];
  const bodyUrls = body.match(URL_REG) ?? [];

  const urls = [...hrefs];
  bodyUrls.forEach((bodyUrl) => {
    if (!supersededByAnchor(bodyUrl, hrefs)) urls.push(bodyUrl);
  });

  return [...new Set(urls)];
};
