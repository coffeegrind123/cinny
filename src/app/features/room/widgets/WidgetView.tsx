import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, color, config } from 'folds';
import { Room } from 'matrix-js-sdk';
import { Capability, ClientWidgetApi, IWidget, Widget } from 'matrix-widget-api';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { RoomWidget } from '../../../hooks/useRoomWidgets';
import { checkWidgetUrl, fillWidgetUrlTemplate } from '../../../plugins/widget/widgetUrl';
import { GenericWidgetDriver } from '../../../plugins/widget/GenericWidgetDriver';
import {
  getGrantedCapabilities,
  getUndecidedCapabilities,
  setGrantedCapabilities,
} from '../../../plugins/widget/permissions';
import { describeCapabilities } from '../../../plugins/widget/capabilities';

type CapabilityPromptProps = {
  widget: RoomWidget;
  requested: Capability[];
  onDecide: (decisions: Record<string, boolean>) => void;
  onCancel: () => void;
};

/**
 * Asks before a widget is granted anything.
 *
 * Capabilities are listed individually and can be refused individually, with
 * the ones that touch message content or act as you sorted to the top and
 * marked. "Allow all" exists because a prompt that is tedious to accept
 * honestly is a prompt people learn to dismiss without reading — but it is not
 * the default action.
 */
function CapabilityPrompt({ widget, requested, onDecide, onCancel }: CapabilityPromptProps) {
  const described = useMemo(() => describeCapabilities(requested), [requested]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(requested.map((capability) => [capability, false])),
  );

  return (
    <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
      <Box direction="Column" gap="100">
        <Text size="H5">{widget.name}</Text>
        <Text size="T200" priority="300">
          {new URL(widget.url).host}
        </Text>
      </Box>

      <Text size="T300">This widget is asking to:</Text>

      <Box direction="Column" gap="200">
        {described.map((item) => (
          <Box key={item.capability} as="label" alignItems="Start" gap="200">
            <input
              type="checkbox"
              checked={checked[item.capability] ?? false}
              onChange={(evt) =>
                setChecked((prev) => ({ ...prev, [item.capability]: evt.currentTarget.checked }))
              }
              style={{ marginTop: '4px' }}
            />
            <Box direction="Column">
              <Text size="T300" style={item.sensitive ? { color: color.Warning.Main } : undefined}>
                {item.text}
              </Text>
              {item.unknown && (
                <Text size="T200" priority="300">
                  This app does not recognise this permission.
                </Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      <Text size="T200" priority="300">
        Anything you allow here applies whenever this widget is opened, until you remove it in the
        widget list.
      </Text>

      <Box gap="200" wrap="Wrap">
        <Button variant="Primary" size="300" radii="300" onClick={() => onDecide(checked)}>
          <Text size="B300">Continue</Text>
        </Button>
        <Button
          variant="Secondary"
          size="300"
          radii="300"
          fill="Soft"
          outlined
          onClick={() =>
            onDecide(Object.fromEntries(requested.map((capability) => [capability, true])))
          }
        >
          <Text size="B300">Allow all</Text>
        </Button>
        <Button variant="Secondary" size="300" radii="300" fill="None" onClick={onCancel}>
          <Text size="B300">Cancel</Text>
        </Button>
      </Box>
    </Box>
  );
}

type WidgetViewProps = {
  room: Room;
  widget: RoomWidget;
  onClose: () => void;
};

export function WidgetView({ room, widget, onClose }: WidgetViewProps) {
  const mx = useMatrixClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ClientWidgetApi | undefined>(undefined);

  const urlCheck = useMemo(() => checkWidgetUrl(widget.url), [widget.url]);

  // Everything a widget could ask for. The widget API negotiates the subset it
  // actually wants at load time, but consent is collected up front so the user
  // is never interrupted by a modal appearing over a running widget.
  const requested = useMemo<Capability[]>(() => {
    const undecided = getUndecidedCapabilities(mx, widget.permissionKey, [
      'm.always_on_screen',
      'm.sticker',
      'org.matrix.msc2762.receive.state_event:m.room.member',
      'org.matrix.msc2762.receive.event:m.room.message',
      'org.matrix.msc2762.send.event:m.room.message',
    ]);
    return undecided;
  }, [mx, widget.permissionKey]);

  const [needsConsent, setNeedsConsent] = useState(requested.length > 0);
  const [started, setStarted] = useState(false);

  const handleDecide = useCallback(
    async (decisions: Record<string, boolean>) => {
      await setGrantedCapabilities(mx, widget.permissionKey, decisions);
      setNeedsConsent(false);
    },
    [mx, widget.permissionKey],
  );

  useEffect(() => {
    if (needsConsent || !urlCheck.ok) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const url = fillWidgetUrlTemplate(widget.url, {
      widgetId: widget.id,
      roomId: room.roomId,
      userId: mx.getSafeUserId(),
      deviceId: mx.getDeviceId() ?? undefined,
      baseUrl: mx.baseUrl,
    });

    const iframe = document.createElement('iframe');
    iframe.title = widget.name;
    // `allow-same-origin` is safe here in a way it is not for the call embed:
    // widgetUrl.ts guarantees this src is cross-origin, so "same origin" means
    // the widget's own, and it cannot reach our storage or our window.
    iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads';
    // No microphone, camera or display-capture. A third-party widget that wants
    // your camera can ask for it in a browser tab of its own.
    iframe.allow = '';
    iframe.referrerPolicy = 'no-referrer';
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.append(iframe);

    const widgetDef: IWidget = {
      id: widget.id,
      creatorUserId: widget.senderId ?? mx.getSafeUserId(),
      type: widget.type,
      url: widget.url,
      name: widget.name,
      data: widget.data,
    };

    const granted = getGrantedCapabilities(mx, widget.permissionKey);
    const driver = new GenericWidgetDriver(mx, room.roomId, granted);
    const api = new ClientWidgetApi(new Widget(widgetDef), iframe, driver);
    apiRef.current = api;
    setStarted(true);

    return () => {
      api.stop();
      apiRef.current = undefined;
      iframe.remove();
    };
  }, [needsConsent, urlCheck, widget, room.roomId, mx]);

  if (!urlCheck.ok) {
    return (
      <Box direction="Column" gap="200" style={{ padding: config.space.S400 }}>
        <Text size="H5">{widget.name}</Text>
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {urlCheck.message}
        </Text>
        <Text size="T200" priority="300">
          {widget.url}
        </Text>
        <Box>
          <Button variant="Secondary" size="300" radii="300" fill="Soft" onClick={onClose}>
            <Text size="B300">Close</Text>
          </Button>
        </Box>
      </Box>
    );
  }

  if (needsConsent) {
    return (
      <CapabilityPrompt
        widget={widget}
        requested={requested}
        onDecide={handleDecide}
        onCancel={onClose}
      />
    );
  }

  return (
    <Box grow="Yes" direction="Column">
      <Box alignItems="Center" gap="200" style={{ padding: config.space.S200 }}>
        <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
          <Text size="T300" truncate>
            {widget.name}
          </Text>
          <Text size="T200" priority="300" truncate>
            {urlCheck.url.host}
          </Text>
        </Box>
        <Button variant="Secondary" size="300" radii="300" fill="Soft" onClick={onClose}>
          <Icon size="50" src={Icons.Cross} />
        </Button>
      </Box>
      <Box grow="Yes" style={{ position: 'relative', minHeight: '320px' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {!started && (
          <Box
            alignItems="Center"
            justifyContent="Center"
            style={{ position: 'absolute', inset: 0 }}
          >
            <Spinner variant="Secondary" size="400" />
          </Box>
        )}
      </Box>
    </Box>
  );
}
