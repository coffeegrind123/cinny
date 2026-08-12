import { CSSProperties, useCallback, useEffect, useState } from 'react';
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
import { MsgType, Preset, Visibility } from 'matrix-js-sdk';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useRoomNavigate } from '../hooks/useRoomNavigate';
import { addRoomIdToMDirect, getDMRoomFor } from '../utils/matrix';
import { createRoomEncryptionState } from './create-room';
import { isTauri } from '../utils/desktop-notifications';
import { botStartMessage, parseBotDeepLink, type BotDeepLink } from '../plugins/bot-deeplink';
import { AsyncStatus, useAsyncCallback } from '../hooks/useAsyncCallback';
import { stopPropagation } from '../utils/keyboard';

const DialogHeaderStyles: CSSProperties = {
  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
};

/**
 * Bot deep links: `https://prinny.app/bot/@bot:server?start=payload`.
 *
 * Following one opens (or creates) a direct message with that account and
 * sends `/start payload`. Both of those are things done in the user's name, so
 * neither happens without an explicit confirmation showing exactly which
 * account and exactly what will be sent. A link is an invitation, not an
 * instruction.
 */
export function BotStartLinkHandler() {
  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();
  const [pending, setPending] = useState<BotDeepLink | null>(null);

  const [startState, start] = useAsyncCallback(
    useCallback(
      async (link: BotDeepLink) => {
        let roomId = getDMRoomFor(mx, link.userId)?.roomId;

        if (!roomId) {
          const result = await mx.createRoom({
            is_direct: true,
            invite: [link.userId],
            visibility: Visibility.Private,
            preset: Preset.TrustedPrivateChat,
            initial_state: [createRoomEncryptionState()],
          });
          roomId = result.room_id;
          await addRoomIdToMDirect(mx, roomId, link.userId);
        }

        await mx.sendMessage(roomId, {
          msgtype: MsgType.Text,
          body: botStartMessage(link.payload),
        } as never);

        navigateRoom(roomId);
        return roomId;
      },
      [mx, navigateRoom],
    ),
  );

  const handleLink = useCallback((url: string): boolean => {
    const link = parseBotDeepLink(url);
    if (!link) return false;
    setPending(link);
    return true;
  }, []);

  // In-app clicks on a bot link. Capture phase, matching MatrixLinkHandler, so
  // this runs before anything that would navigate away.
  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
      const target = evt.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href');
      if (!href) return;
      if (handleLink(href)) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [handleLink]);

  // Links opened from outside the app, forwarded by the desktop/mobile shell.
  useEffect(() => {
    if (!isTauri()) return undefined;

    let unlisten: (() => void) | undefined;
    let disposed = false;

    import('@tauri-apps/plugin-deep-link')
      .then(async ({ onOpenUrl, getCurrent }) => {
        // A link that launched the app arrives before any listener exists.
        const current = await getCurrent().catch(() => undefined);
        current?.forEach((url) => handleLink(url));

        const stop = await onOpenUrl((urls) => {
          urls.forEach((url) => handleLink(url));
        });
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {
        // Shell without the plugin, or a platform where it is unavailable.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleLink]);

  const close = useCallback(() => setPending(null), []);

  useEffect(() => {
    if (startState.status === AsyncStatus.Success) setPending(null);
  }, [startState.status]);

  if (!pending) return null;

  const loading = startState.status === AsyncStatus.Loading;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: close,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header style={DialogHeaderStyles} variant="Surface" size="500">
              <Box grow="Yes">
                <Text size="H4">Start a chat with a bot?</Text>
              </Box>
              <IconButton size="300" onClick={close} radii="300">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
              <Box direction="Column" gap="200">
                <Text size="T200" priority="300">
                  This opens a direct message with:
                </Text>
                <Text size="H5">{pending.userId}</Text>
                <Text size="T200" priority="300">
                  and sends:
                </Text>
                <Text size="T300">
                  <code>{botStartMessage(pending.payload)}</code>
                </Text>
              </Box>

              {startState.status === AsyncStatus.Error && (
                <Text size="T200" style={{ color: 'var(--fo-color-critical-main)' }}>
                  Could not start the chat. {String(startState.error)}
                </Text>
              )}

              <Box gap="200" justifyContent="End">
                <Button variant="Secondary" fill="Soft" radii="300" onClick={close}>
                  <Text size="B400">Cancel</Text>
                </Button>
                <Button
                  variant="Primary"
                  radii="300"
                  disabled={loading}
                  before={loading ? <Spinner size="100" variant="Primary" fill="Solid" /> : null}
                  onClick={() => start(pending)}
                >
                  <Text size="B400">Start</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
