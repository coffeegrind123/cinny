// Escapes text destined for a formatted_body. The composer's own HTML path
// does this itself; /rainbow builds markup from raw text, so it has to.
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hslToHex = (h: number, s: number, l: number): string => {
  // Lightness has to be normalised BEFORE computing `a`: with l still on the
  // 0-100 scale, `Math.min(l, 1 - l)` picks a large negative number and every
  // channel lands far outside 0-255, which stringifies to hex like
  // "#-304f314f314f" — syntactically a colour attribute, visibly nothing.
  const lightness = l / 100;
  const a = (s * Math.min(lightness, 1 - lightness)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const colour = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * colour)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Wraps each character in a `<font>` spanning the hue wheel.
 *
 * `<font>` rather than an inline style because that is what the Matrix spec's
 * allowed-tag list permits — a `style` attribute is stripped by every receiving
 * client's sanitiser, including ours, and the message arrives plain.
 *
 * Both `data-mx-color` and `color` are set on purpose. The spec's attribute is
 * `data-mx-color`, and our own sanitiser (utils/sanitize.ts `transformFontTag`)
 * builds its style from that key alone — a `<font color>` with no data-mx-color
 * renders as `color: undefined` and comes out with no colour at all. Older
 * clients read the plain `color` attribute instead, so sending only one of the
 * two makes the message colourless on one side or the other.
 *
 * Whitespace is left uncoloured so a long message does not become one enormous
 * run of markup for no visible gain.
 */
export const rainbowHtml = (text: string): string => {
  const chars = Array.from(text);
  const visibleCount = chars.filter((char) => char.trim() !== '').length;
  if (visibleCount === 0) return escapeHtml(text);

  let visibleIndex = 0;
  return chars
    .map((char) => {
      if (char.trim() === '') return escapeHtml(char);
      const hue = (visibleIndex / visibleCount) * 360;
      visibleIndex += 1;
      const colour = hslToHex(hue, 100, 50);
      return `<font data-mx-color="${colour}" color="${colour}">${escapeHtml(char)}</font>`;
    })
    .join('');
};
