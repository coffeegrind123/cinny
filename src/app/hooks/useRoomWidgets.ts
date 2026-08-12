import { useMemo } from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useRoomState } from './useRoomState';

/**
 * Both the stable and legacy widget state event types. Rooms in the wild carry
 * either, and Element writes the `im.vector.*` one, so reading only the modern
 * name would show an empty list in most rooms that actually have widgets.
 */
export const WIDGET_STATE_EVENT_TYPES = ['m.widget', 'im.vector.modular.widgets'] as const;

export type RoomWidget = {
  /** State key — the widget's id within the room. */
  id: string;
  /**
   * Stable key for remembering consent. Includes the URL so that pointing an
   * existing widget id at a different URL asks again instead of inheriting the
   * old widget's permissions.
   */
  permissionKey: string;
  type: string;
  url: string;
  name: string;
  eventType: string;
  senderId?: string;
  data: Record<string, unknown>;
};

const readWidgets = (events: MatrixEvent[]): RoomWidget[] =>
  events
    .map((event): RoomWidget | undefined => {
      const content = event.getContent();
      const id = event.getStateKey();
      const url = content.url;
      const type = content.type;
      if (!id || typeof url !== 'string' || typeof type !== 'string') return undefined;

      return {
        id,
        permissionKey: `${id}|${url}`,
        type,
        url,
        name: typeof content.name === 'string' && content.name ? content.name : type,
        eventType: event.getType(),
        senderId: event.getSender() ?? undefined,
        data: (content.data ?? {}) as Record<string, unknown>,
      };
    })
    .filter((widget): widget is RoomWidget => widget !== undefined);

export const useRoomWidgets = (room: Room): RoomWidget[] => {
  const state = useRoomState(room);

  return useMemo(() => {
    const byId = new Map<string, RoomWidget>();
    // Legacy first so a modern event for the same id wins.
    WIDGET_STATE_EVENT_TYPES.slice()
      .reverse()
      .forEach((eventType) => {
        const events = state.get(eventType);
        if (!events) return;
        readWidgets(Array.from(events.values())).forEach((widget) => byId.set(widget.id, widget));
      });
    // A removed widget leaves an empty content behind rather than disappearing.
    return Array.from(byId.values());
  }, [state]);
};
