import { MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useCallback, useEffect, useMemo } from 'react';
import { useStateEventCallback } from './useStateEventCallback';
import { useForceUpdate } from './useForceUpdate';
import { getStateEvents } from '../utils/room';
import { MessageEvent, StateEvent } from '../../types/matrix/room';
import { sanitizeBotInfo, type BotInfo } from '../../types/matrix/bot';

/** Bots that have advertised themselves in a room, keyed by MXID. */
export type RoomBots = Map<string, BotInfo>;

/**
 * How far back to look for a timeline-form advertisement.
 *
 * Bounded on purpose. A bot with power to set state does not need this path at
 * all, and one without it is expected to re-advertise on join — so scanning
 * the entire loaded timeline would cost more than it could ever find.
 */
const TIMELINE_SCAN_DEPTH = 200;

const collectBots = (room: Room): RoomBots => {
  const bots: RoomBots = new Map();

  // The state event is authoritative. A bot may only advertise under its own
  // MXID, so an event whose state key is somebody else is either a mistake or
  // an attempt to put words in another user's mouth; either way, ignore it.
  getStateEvents(room, StateEvent.BotInfo).forEach((event) => {
    const sender = event.getSender();
    const stateKey = event.getStateKey();
    if (!sender || stateKey !== sender) return;
    const info = sanitizeBotInfo(event.getContent());
    if (info) bots.set(sender, info);
  });

  // Timeline fallback, for bots without power level 50. Newest wins, and a
  // state event always beats it.
  const timeline = room.getLiveTimeline().getEvents();
  const start = Math.max(0, timeline.length - TIMELINE_SCAN_DEPTH);
  for (let i = timeline.length - 1; i >= start; i -= 1) {
    const event = timeline[i];
    if (!event || event.getType() !== MessageEvent.BotInfo) continue;
    const sender = event.getSender();
    if (!sender || bots.has(sender)) continue;
    const info = sanitizeBotInfo(event.getContent());
    if (info) bots.set(sender, info);
  }

  return bots;
};

/**
 * Every bot advertising itself in this room.
 *
 * This is the client half of Telegram's `setMyCommands`: Matrix has no
 * server-side command registry, so a bot's commands only exist where the bot
 * has written them, and this is where the client reads them back.
 */
export const useRoomBots = (room: Room): RoomBots => {
  const [updateCount, forceUpdate] = useForceUpdate();

  useStateEventCallback(
    room.client,
    useCallback(
      (event: MatrixEvent) => {
        if (event.getRoomId() !== room.roomId) return;
        if (event.getType() !== StateEvent.BotInfo) return;
        forceUpdate();
      },
      [room, forceUpdate],
    ),
  );

  useEffect(() => {
    const handleTimeline = (event: MatrixEvent, eventRoom: Room | undefined) => {
      if (eventRoom?.roomId !== room.roomId) return;
      if (event.getType() !== MessageEvent.BotInfo) return;
      forceUpdate();
    };
    room.client.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      room.client.removeListener(RoomEvent.Timeline, handleTimeline);
    };
  }, [room, forceUpdate]);

  return useMemo(
    () => collectBots(room),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, updateCount],
  );
};

/** The advertisement for one user in a room, if they published one. */
export const useBotInfo = (room: Room, userId: string): BotInfo | undefined => {
  const bots = useRoomBots(room);
  return bots.get(userId);
};

/**
 * Whether a user should carry a BOT badge in this room.
 *
 * Two independent signals, either of which is enough: a published
 * advertisement, or a `m.room.member` flag the user set on themselves. Both
 * are self-asserted — this is a hint about how an account behaves, not a
 * verified identity claim, and it should never be presented as one.
 */
export const useIsBot = (room: Room, userId: string): boolean => {
  const bots = useRoomBots(room);
  if (bots.has(userId)) return true;
  const member = room.getMember(userId);
  return member?.events?.member?.getContent()['app.prinny.bot'] === true;
};
