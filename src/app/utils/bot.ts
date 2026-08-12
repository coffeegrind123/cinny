import { IContent } from 'matrix-js-sdk';
import { BotContentKey } from '../../types/matrix/bot';

/**
 * Strip the plain-text button listing from a message we are about to render
 * buttons for.
 *
 * Every keyboard message carries its buttons twice: once as
 * `app.prinny.bot.reply_markup`, and once as a numbered listing appended to
 * `body` so that clients without button support still show the user something
 * they can act on. The sender puts the un-annotated text in
 * `app.prinny.bot.plain_body`.
 *
 * So when we draw the real buttons we display that clean copy, and a user here
 * never sees the `[1] Deploy / [2] Cancel` block. When we do not — the setting
 * is off, or the markup did not survive sanitisation — `body` is left alone
 * and the listing is exactly what the user needs.
 *
 * Returns the original object when there is nothing to substitute, so this is
 * free for the overwhelming majority of messages, which are not from bots.
 */
export const botDisplayContent = (content: IContent, hasKeyboard: boolean): IContent => {
  if (!hasKeyboard) return content;

  const plainBody = content[BotContentKey.PlainBody];
  const plainFormattedBody = content[BotContentKey.PlainFormattedBody];
  if (typeof plainBody !== 'string' && typeof plainFormattedBody !== 'string') return content;

  const next: IContent = { ...content };
  if (typeof plainBody === 'string') next.body = plainBody;
  if (typeof plainFormattedBody === 'string') {
    next.formatted_body = plainFormattedBody;
  } else if (typeof plainBody === 'string') {
    // The sender gave a clean plain body but no clean HTML one. Keeping the
    // old `formatted_body` would show the listing anyway, since a formatted
    // body wins over `body` wherever both exist.
    delete next.formatted_body;
    delete next.format;
  }
  return next;
};
