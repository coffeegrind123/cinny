import { CSSProperties, useCallback, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import classNames from 'classnames';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { UrlConfirmDialog } from '../../UrlConfirmDialog';
import {
  buttonAction,
  describeUrlTarget,
  isInlineKeyboardMarkup,
  type InlineKeyboardButton,
  type ReplyMarkup,
} from '../../../../types/matrix/bot';
import { useBotCallback, buttonKey } from '../../../hooks/useBotCallback';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import * as css from './BotKeyboard.css';

const DialogHeaderStyles: CSSProperties = {
  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
};

type BotKeyboardProps = {
  room: Room;
  mEvent: MatrixEvent;
  markup: ReplyMarkup;
  /** Prefill the composer. Absent means `switch_inline` buttons render disabled. */
  onSwitchInline?: (query: string) => void;
};

/**
 * Inline keyboard under a bot message.
 *
 * Everything here treats the markup as hostile input: it has already been
 * through `sanitizeReplyMarkup`, labels render as text and never as markup,
 * and no action fires without a click. See the client obligations section of
 * the protocol spec.
 */
export function BotKeyboard({ room, mEvent, markup, onSwitchInline }: BotKeyboardProps) {
  const [renderKeyboards] = useSetting(settingsAtom, 'renderBotKeyboards');
  const [confirmUrls] = useSetting(settingsAtom, 'confirmBotUrls');
  const { press, pending, answer, timedOut, error, dismiss } = useBotCallback(room, mEvent);
  const [confirmingUrl, setConfirmingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const openUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleUrl = useCallback(
    (url: string) => {
      if (confirmUrls) setConfirmingUrl(url);
      else openUrl(url);
    },
    [confirmUrls, openUrl],
  );

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(key))
      .catch(() => undefined);
  }, []);

  // The off switch. The message body still carries the plain-text listing that
  // every bot sends, so nothing is lost — the user just reads it instead.
  if (!renderKeyboards) return null;
  if (!isInlineKeyboardMarkup(markup)) return null;

  const renderButton = (button: InlineKeyboardButton, row: number, col: number) => {
    const key = buttonKey(row, col);
    const action = buttonAction(button);
    const isPending = pending === key;
    const disabled = action.kind === 'disabled' || (pending !== null && !isPending);

    let title: string | undefined;
    if (action.kind === 'disabled') {
      if (action.reason === 'invalid_url') title = 'This button links somewhere unopenable';
      else if (action.reason === 'ambiguous') title = 'This button asks for two things at once';
      else title = 'This button uses a feature this client does not support';
    } else if (action.kind === 'url') {
      title = action.url;
    }

    const onClick = () => {
      if (action.kind === 'callback') press(action.data, row, col);
      else if (action.kind === 'url') handleUrl(action.url);
      else if (action.kind === 'copy') handleCopy(key, action.text);
      else if (action.kind === 'switch_inline') onSwitchInline?.(action.query);
    };

    return (
      <button
        key={key}
        type="button"
        className={classNames(
          css.Button,
          button.style === 'primary' && css.ButtonPrimary,
          button.style === 'danger' && css.ButtonDanger,
        )}
        // `switch_inline` needs a composer to prefill; without one there is
        // nothing the click could do, so it is honestly disabled rather than
        // silently inert.
        disabled={disabled || (action.kind === 'switch_inline' && !onSwitchInline)}
        title={title}
        onClick={onClick}
      >
        <span className={css.ButtonInner}>
          {isPending && <Spinner size="100" variant="Secondary" />}
          {action.kind === 'url' && !isPending && <Icon size="50" src={Icons.External} />}
          {action.kind === 'copy' && !isPending && (
            <Icon size="50" src={copied === key ? Icons.Check : Icons.File} />
          )}
          <Text as="span" size="B300" truncate>
            {button.text}
          </Text>
        </span>
      </button>
    );
  };

  const showAlert = answer?.show_alert === true && (answer.text || answer.url);

  return (
    <Box className={css.Keyboard} direction="Column" gap="100">
      {markup.inline_keyboard.map((row, rowIndex) => (
        // Row position is the only stable identity a keyboard row has; the
        // buttons in it carry no ids of their own.
        <div key={rowIndex} className={css.Row}>
          {row.map((button, colIndex) => renderButton(button, rowIndex, colIndex))}
        </div>
      ))}

      {!showAlert && answer?.text && (
        <Box className={css.Answer} alignItems="Center" gap="200">
          <Box grow="Yes">
            <Text size="T200">{answer.text}</Text>
          </Box>
          <IconButton size="300" radii="300" variant="SurfaceVariant" onClick={dismiss}>
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
        </Box>
      )}

      {!showAlert && answer?.url && (
        <Box className={css.Answer}>
          <Button
            variant="Secondary"
            fill="Soft"
            size="300"
            radii="300"
            onClick={() => handleUrl(answer.url!)}
          >
            <Text size="B300">Open {describeUrlTarget(answer.url)}</Text>
          </Button>
        </Box>
      )}

      {timedOut && (
        <Box className={css.Answer} alignItems="Center" gap="200">
          <Box grow="Yes">
            <Text size="T200" priority="300">
              No response from the bot.
            </Text>
          </Box>
          <IconButton size="300" radii="300" variant="SurfaceVariant" onClick={dismiss}>
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
        </Box>
      )}

      {error && (
        <Box className={classNames(css.Answer, css.AnswerCritical)} alignItems="Center" gap="200">
          <Box grow="Yes">
            <Text size="T200">Could not send: {error}</Text>
          </Box>
          <IconButton size="300" radii="300" variant="SurfaceVariant" onClick={dismiss}>
            <Icon size="50" src={Icons.Cross} />
          </IconButton>
        </Box>
      )}

      {showAlert && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                onDeactivate: dismiss,
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <Dialog variant="Surface">
                <Header style={DialogHeaderStyles} variant="Surface" size="500">
                  <Box grow="Yes">
                    <Text size="H4">Bot</Text>
                  </Box>
                  <IconButton size="300" onClick={dismiss} radii="300">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Header>
                <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                  {answer?.text && (
                    <Text size="T300" style={{ whiteSpace: 'pre-wrap' }}>
                      {answer.text}
                    </Text>
                  )}
                  <Box gap="200" justifyContent="End">
                    {answer?.url && (
                      <Button
                        variant="Secondary"
                        fill="Soft"
                        radii="300"
                        onClick={() => handleUrl(answer.url!)}
                      >
                        <Text size="B400">Open {describeUrlTarget(answer.url)}</Text>
                      </Button>
                    )}
                    <Button variant="Primary" radii="300" onClick={dismiss}>
                      <Text size="B400">OK</Text>
                    </Button>
                  </Box>
                </Box>
              </Dialog>
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}

      {confirmingUrl && (
        <UrlConfirmDialog
          url={confirmingUrl}
          onConfirm={() => {
            openUrl(confirmingUrl);
            setConfirmingUrl(null);
          }}
          onCancel={() => setConfirmingUrl(null)}
        />
      )}
    </Box>
  );
}
