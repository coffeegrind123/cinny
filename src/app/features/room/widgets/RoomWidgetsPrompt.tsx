import { FormEventHandler, useCallback, useState } from 'react';
import {
  Box,
  Button,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { RoomWidget, useRoomWidgets } from '../../../hooks/useRoomWidgets';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { stopPropagation } from '../../../utils/keyboard';
import { SequenceCard } from '../../../components/sequence-card';
import { checkWidgetUrl } from '../../../plugins/widget/widgetUrl';
import { revokeWidget } from '../../../plugins/widget/permissions';
import { WidgetView } from './WidgetView';
import { usePowerLevelsContext } from '../../../hooks/usePowerLevels';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../../hooks/useRoomCreators';

const WIDGET_STATE_TYPE = 'im.vector.modular.widgets';

type RoomWidgetsPromptProps = {
  room: Room;
  requestClose: () => void;
};

export function RoomWidgetsPrompt({ room, requestClose }: RoomWidgetsPromptProps) {
  const mx = useMatrixClient();
  const widgets = useRoomWidgets(room);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canManage = permissions.stateEvent(WIDGET_STATE_TYPE, mx.getSafeUserId());

  const [open, setOpen] = useState<RoomWidget>();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [urlError, setUrlError] = useState<string>();

  const [addState, add] = useAsyncCallback<void, Error, [string, string]>(
    useCallback(
      async (widgetUrl, widgetName) => {
        const id = `prinny-${Date.now()}`;
        await mx.sendStateEvent(
          room.roomId,
          WIDGET_STATE_TYPE as never,
          {
            type: 'customwidget',
            url: widgetUrl,
            name: widgetName || 'Widget',
            creatorUserId: mx.getSafeUserId(),
          } as never,
          id,
        );
        setUrl('');
        setName('');
      },
      [mx, room.roomId],
    ),
  );

  const [removeState, remove] = useAsyncCallback<void, Error, [RoomWidget]>(
    useCallback(
      async (widget) => {
        // Removing means writing empty content — widgets have no redaction.
        await mx.sendStateEvent(room.roomId, widget.eventType as never, {} as never, widget.id);
        await revokeWidget(mx, widget.permissionKey);
      },
      [mx, room.roomId],
    ),
  );

  const handleAdd: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const check = checkWidgetUrl(url.trim());
    if (!check.ok) {
      setUrlError(check.message);
      return;
    }
    setUrlError(undefined);
    add(url.trim(), name.trim());
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          {/* The widget *list* sizes to its content — folds' Modal is
              `height: 100%` by default, so a room with two widgets drew a
              full-height dialog with an empty band under them. An *open*
              widget is an iframe that has to fill the dialog, so it keeps the
              fixed height; `height: unset` would collapse it to nothing. */}
          <Modal size="500" flexHeight={!open}>
            <Box grow="Yes" direction="Column">
              <Header
                size="500"
                style={{ padding: config.space.S200, paddingLeft: config.space.S400 }}
              >
                <Box grow="Yes">
                  <Text size="H4">{open ? 'Widget' : 'Widgets'}</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={requestClose}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>

              {open ? (
                <WidgetView room={room} widget={open} onClose={() => setOpen(undefined)} />
              ) : (
                <Box grow="Yes">
                  <Scroll size="300" hideTrack>
                    <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                      {widgets.length === 0 && (
                        <Text size="T200" priority="300">
                          This room has no widgets.
                        </Text>
                      )}

                      {widgets.map((widget) => {
                        const check = checkWidgetUrl(widget.url);
                        return (
                          <SequenceCard
                            key={widget.id}
                            variant="SurfaceVariant"
                            direction="Column"
                            gap="200"
                            style={{ padding: config.space.S300 }}
                          >
                            <Box alignItems="Center" gap="200">
                              <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
                                <Text size="T300" truncate>
                                  {widget.name}
                                </Text>
                                <Text size="T200" priority="300" truncate>
                                  {widget.url}
                                </Text>
                              </Box>
                              <Box shrink="No" gap="100">
                                <Button
                                  size="300"
                                  radii="300"
                                  variant="Primary"
                                  fill="Soft"
                                  disabled={!check.ok}
                                  onClick={() => setOpen(widget)}
                                >
                                  <Text size="B300">Open</Text>
                                </Button>
                                {canManage && (
                                  <Button
                                    size="300"
                                    radii="300"
                                    variant="Critical"
                                    fill="None"
                                    onClick={() => remove(widget)}
                                    disabled={removeState.status === AsyncStatus.Loading}
                                  >
                                    <Text size="B300">Remove</Text>
                                  </Button>
                                )}
                              </Box>
                            </Box>
                            {!check.ok && (
                              <Text size="T200" style={{ color: color.Critical.Main }}>
                                {check.message}
                              </Text>
                            )}
                          </SequenceCard>
                        );
                      })}

                      {canManage && (
                        <Box as="form" onSubmit={handleAdd} direction="Column" gap="200">
                          <Text size="L400">Add a widget</Text>
                          <Input
                            value={name}
                            onChange={(evt) => setName(evt.currentTarget.value)}
                            variant="Background"
                            size="400"
                            radii="300"
                            placeholder="Name"
                          />
                          <Input
                            value={url}
                            onChange={(evt) => setUrl(evt.currentTarget.value)}
                            variant="Background"
                            size="400"
                            radii="300"
                            placeholder="https://example.com/widget"
                          />
                          {urlError && (
                            <Text size="T200" style={{ color: color.Critical.Main }}>
                              {urlError}
                            </Text>
                          )}
                          {addState.status === AsyncStatus.Error && (
                            <Text size="T200" style={{ color: color.Critical.Main }}>
                              Could not add the widget.
                            </Text>
                          )}
                          <Text size="T200" priority="300">
                            Everyone in the room sees widgets you add, and a widget can read and
                            send what you allow it to. Only add ones you trust.
                          </Text>
                          <Box>
                            <Button
                              type="submit"
                              variant="Primary"
                              size="300"
                              radii="300"
                              disabled={!url.trim() || addState.status === AsyncStatus.Loading}
                              before={
                                addState.status === AsyncStatus.Loading ? (
                                  <Spinner size="200" fill="Solid" variant="Primary" />
                                ) : undefined
                              }
                            >
                              <Text size="B300">Add</Text>
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Scroll>
                </Box>
              )}
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
