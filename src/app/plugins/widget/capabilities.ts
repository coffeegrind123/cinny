import {
  Capability,
  EventDirection,
  MatrixCapabilities,
  WidgetEventCapability,
} from 'matrix-widget-api';

/**
 * Turns a widget capability string into something a person can decide about.
 *
 * A consent prompt listing `org.matrix.msc2762.receive.event:m.room.message` is
 * not consent, it is paperwork. Anything this cannot describe is shown as its
 * raw string and marked unrecognised, so an unknown capability reads as a
 * reason for suspicion rather than being quietly hidden.
 */
export type CapabilityDescription = {
  capability: Capability;
  text: string;
  /** True when we have no idea what this grants. */
  unknown: boolean;
  /** True for capabilities that expose message content or identity. */
  sensitive: boolean;
};

const STATIC_DESCRIPTIONS: Record<string, { text: string; sensitive?: boolean }> = {
  [MatrixCapabilities.AlwaysOnScreen]: {
    text: 'Stay visible on screen while you use other rooms',
  },
  [MatrixCapabilities.StickerSending]: {
    text: 'Send stickers to this room as you',
    sensitive: true,
  },
  [MatrixCapabilities.Screenshots]: {
    text: 'Take screenshots of itself',
  },
  [MatrixCapabilities.RequiresClient]: {
    text: 'Only run inside this app',
  },
  [MatrixCapabilities.MSC2931Navigate]: {
    text: 'Send you to other rooms and users in this app',
    sensitive: true,
  },
  [MatrixCapabilities.MSC3846TurnServers]: {
    text: "Use your homeserver's voice relay servers",
  },
  [MatrixCapabilities.MSC3973UserDirectorySearch]: {
    text: 'Search the user directory on your server',
    sensitive: true,
  },
  'org.matrix.msc4157.send.delayed_event': {
    text: 'Schedule events to be sent later',
    sensitive: true,
  },
  'org.matrix.msc4157.update_delayed_event': {
    text: 'Change or cancel events it scheduled',
  },
  'org.matrix.msc3819.send.to_device': {
    text: 'Send messages directly to your other devices',
    sensitive: true,
  },
  'org.matrix.msc3819.receive.to_device': {
    text: 'Read messages sent directly to your devices',
    sensitive: true,
  },
};

const describeEventCapability = (
  parsed: WidgetEventCapability,
): { text: string; sensitive: boolean } => {
  const verb = parsed.direction === EventDirection.Send ? 'Send' : 'Read';
  const what = parsed.keyStr ? `${parsed.eventType} (${parsed.keyStr})` : parsed.eventType;

  // Message content is the thing worth being loudest about.
  const sensitive =
    parsed.eventType === 'm.room.message' ||
    parsed.eventType === 'm.room.encrypted' ||
    parsed.direction === EventDirection.Send;

  if (parsed.eventType === 'm.room.message') {
    return {
      text: verb === 'Send' ? 'Send messages to this room as you' : 'Read messages in this room',
      sensitive: true,
    };
  }

  return {
    text: `${verb} "${what}" events in this room`,
    sensitive,
  };
};

export const describeCapability = (capability: Capability): CapabilityDescription => {
  const staticEntry = STATIC_DESCRIPTIONS[capability];
  if (staticEntry) {
    return {
      capability,
      text: staticEntry.text,
      unknown: false,
      sensitive: staticEntry.sensitive ?? false,
    };
  }

  const parsed = WidgetEventCapability.findEventCapabilities([capability]);
  if (parsed.length > 0) {
    const described = describeEventCapability(parsed[0]);
    return {
      capability,
      text: described.text,
      unknown: false,
      sensitive: described.sensitive,
    };
  }

  return {
    capability,
    text: capability,
    unknown: true,
    // An unrecognised capability is treated as sensitive by default. Being
    // wrong in that direction only over-warns; the other way hides something
    // real.
    sensitive: true,
  };
};

export const describeCapabilities = (capabilities: Iterable<Capability>): CapabilityDescription[] =>
  Array.from(capabilities)
    .map(describeCapability)
    .sort((a, b) => Number(b.sensitive) - Number(a.sensitive));
