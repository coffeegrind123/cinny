import { Box, Icon, IconButton, Icons, Text } from 'folds';
import classNames from 'classnames';
import { Room } from 'matrix-js-sdk';
import type { BotReplyKeyboardState } from '../../hooks/useBotReplyKeyboard';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import * as css from './BotReplyKeyboard.css';

type BotReplyKeyboardProps = {
  room: Room;
  keyboard: BotReplyKeyboardState;
  /** Send a key's label as an ordinary message. */
  onPressKey: (label: string) => void;
};

/**
 * The quick-reply bar a bot puts above the composer.
 *
 * Pressing a key sends its label as a normal text message — it does not send a
 * callback. That is Telegram's behaviour and it is what makes reply keyboards
 * work everywhere: to a bot, and to any other client in the room, the user
 * simply typed the words.
 */
export function BotReplyKeyboard({ room, keyboard, onPressKey }: BotReplyKeyboardProps) {
  const { state, dismiss, noteUsed, collapsed, expand } = keyboard;

  if (state.kind !== 'keyboard') return null;

  const botName =
    getMemberDisplayName(room, state.botUserId) ??
    getMxIdLocalPart(state.botUserId) ??
    state.botUserId;

  if (collapsed) {
    return (
      <Box className={css.Bar} alignItems="Center" gap="200">
        <Box grow="Yes">
          <button type="button" className={css.Key} onClick={expand}>
            <Text as="span" size="B300">
              Show {botName}&apos;s quick replies
            </Text>
          </button>
        </Box>
      </Box>
    );
  }

  const fixedWidth = state.markup.resize_keyboard !== true;

  return (
    <Box className={css.Bar} direction="Column" gap="100">
      <Box alignItems="Center" gap="200">
        <Box grow="Yes">
          <Text size="T200" priority="300" truncate>
            {state.markup.input_field_placeholder ?? `Quick replies from ${botName}`}
          </Text>
        </Box>
        <Box shrink="No">
          <IconButton
            onClick={dismiss}
            variant="SurfaceVariant"
            size="300"
            radii="300"
            aria-label="Hide quick replies"
          >
            <Icon src={Icons.Cross} size="50" />
          </IconButton>
        </Box>
      </Box>

      {state.markup.keyboard.map((row, rowIndex) => (
        // Position is a row's only identity; the keys carry no ids.
        <div key={rowIndex} className={css.Row}>
          {row.map((key) => (
            <button
              key={key.text}
              type="button"
              className={classNames(css.Key, fixedWidth && css.KeyFixed)}
              onClick={() => {
                onPressKey(key.text);
                noteUsed();
              }}
            >
              <Text as="span" size="B300" truncate>
                {key.text}
              </Text>
            </button>
          ))}
        </div>
      ))}
    </Box>
  );
}
