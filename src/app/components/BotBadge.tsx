import { Badge, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useIsBot } from '../hooks/useBotInfo';

type BotBadgeProps = {
  room: Room;
  userId: string;
};

/**
 * A "BOT" tag beside a display name.
 *
 * Shown when the account has published an `app.prinny.bot.info` in this room,
 * or flagged itself in its `m.room.member` content. Both signals are
 * self-asserted — Matrix has no verified notion of a bot account — so this is
 * a hint about how something behaves, not a claim about who it is, and it is
 * styled as a quiet label rather than anything resembling a verification mark.
 *
 * It is per-room for the same reason: the only evidence is what that account
 * published in this room.
 */
export function BotBadge({ room, userId }: BotBadgeProps) {
  const isBot = useIsBot(room, userId);
  if (!isBot) return null;

  return (
    <Badge as="span" size="400" variant="Secondary" fill="Soft" radii="300">
      <Text as="span" size="L400">
        BOT
      </Text>
    </Badge>
  );
}
