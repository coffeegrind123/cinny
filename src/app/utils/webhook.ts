import { MatrixEvent } from 'matrix-js-sdk';

/**
 * Where a Discord-compatible webhook puts the identity it posted under.
 *
 * Kept in sync with `WEBHOOK_IDENTITY_KEY` in @prinny/bot's webhook server —
 * changing it in one place without the other silently stops webhook messages
 * being attributed, with nothing failing to say so.
 */
export const WEBHOOK_IDENTITY_KEY = 'in.prinny.webhook';

export type WebhookIdentity = {
  /** The webhook's id, so several webhooks in one room stay distinguishable. */
  id?: string;
  username?: string;
  avatarUrl?: string;
};

/**
 * A per-message sender identity, if the event carries one.
 *
 * Discord webhooks set `username` and `avatar_url` per message, which is how
 * one bot account posts as "CI", "Deploy" and "Alerts" in the same channel.
 * Matrix has no equivalent — a message is from the account that sent it — so
 * the bot passes the intended identity in this content key and the client
 * attributes the message to it.
 *
 * This is self-asserted by the sender, exactly like a display name, and it is
 * displayed with a WEBHOOK badge for that reason: it says who the message is
 * *from*, it does not claim the sender is anyone else. The underlying account
 * is still one hover away on the timestamp row.
 */
export const getWebhookIdentity = (mEvent: MatrixEvent): WebhookIdentity | undefined => {
  const raw = mEvent.getContent()[WEBHOOK_IDENTITY_KEY];
  if (typeof raw !== 'object' || raw === null) return undefined;

  const record = raw as Record<string, unknown>;
  const username = typeof record.username === 'string' ? record.username.trim() : undefined;
  const avatarUrl = typeof record.avatar_url === 'string' ? record.avatar_url : undefined;
  const id = typeof record.id === 'string' ? record.id : undefined;

  if (!username && !avatarUrl) return undefined;

  return {
    id,
    // A name is chrome, and chrome that can contain newlines can push the rest
    // of the header off screen. One line, bounded.
    username: username ? username.replace(/\s+/g, ' ').slice(0, 80) : undefined,
    /**
     * Only `mxc://` is honoured.
     *
     * `avatar_url` is an arbitrary URL chosen by whoever holds the webhook
     * token, and rendering it would make every viewer fetch from a host that
     * party controls — an IP-address collector attached to a message anyone can
     * post. An mxc URI is served by the homeserver the client is already
     * talking to, so it leaks nothing new. An https avatar is dropped and the
     * sending account's own avatar is shown instead.
     */
    avatarUrl: avatarUrl?.startsWith('mxc://') ? avatarUrl : undefined,
  };
};
