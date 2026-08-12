import { MatrixEvent, MatrixEventEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useForceUpdate } from './useForceUpdate';
import {
  BotContentKey,
  isForceReply,
  isReplyKeyboardMarkup,
  isReplyKeyboardRemove,
  sanitizeReplyMarkup,
  type ForceReply,
  type ReplyKeyboardMarkup,
} from '../../types/matrix/bot';

/** The composer state a bot has most recently asked for in this room. */
export type BotComposerState =
  | { kind: 'none' }
  | {
      kind: 'keyboard';
      markup: ReplyKeyboardMarkup;
      botUserId: string;
      /** The message that set it — its id keys the one-time dismissal. */
      eventId: string;
    }
  | {
      kind: 'force_reply';
      markup: ForceReply;
      botUserId: string;
      eventId: string;
    };

/**
 * How far back to look.
 *
 * A keyboard set by a bot two hundred messages ago is not a keyboard anyone is
 * still looking at, and scanning the whole loaded timeline on every render for
 * a feature most rooms never use is not worth it.
 */
const SCAN_DEPTH = 200;

/** Whether a `selective` markup is meant for us. */
const mentionsUs = (event: MatrixEvent, userId: string | null): boolean => {
  if (!userId) return false;
  const mentions = event.getContent()['m.mentions'] as { user_ids?: string[] } | undefined;
  return Array.isArray(mentions?.user_ids) && mentions.user_ids.includes(userId);
};

const findComposerState = (room: Room, userId: string | null): BotComposerState => {
  const timeline = room.getLiveTimeline().getEvents();
  const start = Math.max(0, timeline.length - SCAN_DEPTH);

  for (let i = timeline.length - 1; i >= start; i -= 1) {
    const event = timeline[i];
    if (!event || event.isRedacted()) continue;
    const sender = event.getSender();
    if (!sender || sender === userId) continue;

    const markup = sanitizeReplyMarkup(event.getContent()[BotContentKey.ReplyMarkup]);
    if (!markup) continue;
    // An inline keyboard lives under its own message and says nothing about
    // the composer, so it is not part of this search.
    if (!isReplyKeyboardMarkup(markup) && !isReplyKeyboardRemove(markup) && !isForceReply(markup)) {
      continue;
    }

    // `selective` narrows a keyboard to the users the message mentions.
    // Anyone else carries on as though it had not been sent — including
    // treating it as "not the latest instruction", so an unrelated user's
    // keyboard cannot clear theirs.
    if (markup.selective && !mentionsUs(event, userId)) continue;

    const eventId = event.getId();
    if (!eventId) continue;

    // The most recent instruction wins, whatever it is. A `remove_keyboard`
    // found first means the bar is gone, and searching further back for an
    // older keyboard would be undoing exactly what the bot asked for.
    if (isReplyKeyboardRemove(markup)) return { kind: 'none' };
    if (isForceReply(markup)) return { kind: 'force_reply', markup, botUserId: sender, eventId };
    return { kind: 'keyboard', markup, botUserId: sender, eventId };
  }

  return { kind: 'none' };
};

export type BotReplyKeyboardState = {
  state: BotComposerState;
  /** Dismiss the current keyboard or prompt for this session. */
  dismiss: () => void;
  /** Call after sending a key press, so `one_time_keyboard` can collapse. */
  noteUsed: () => void;
  /** True when a one-time keyboard has been used and is collapsed. */
  collapsed: boolean;
  /** Re-open a collapsed one-time keyboard. */
  expand: () => void;
};

/**
 * The reply keyboard or force-reply prompt in force for this room.
 *
 * Derived from the timeline rather than stored: the timeline already syncs
 * across devices and survives a reload, so deriving costs nothing and cannot
 * drift from what the bot actually said. Only the user's own dismissal is
 * local state, and only for the session — a fresh look at the room should show
 * what the bot is asking for.
 */
export const useBotReplyKeyboard = (room: Room): BotReplyKeyboardState => {
  const mx = useMatrixClient();
  const [updateCount, forceUpdate] = useForceUpdate();
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);
  const [usedEventId, setUsedEventId] = useState<string | null>(null);

  useEffect(() => {
    const handle = (event: MatrixEvent, eventRoom?: Room) => {
      if (eventRoom && eventRoom.roomId !== room.roomId) return;
      if (event.getRoomId() !== room.roomId) return;
      if (event.getContent()[BotContentKey.ReplyMarkup] === undefined) return;
      forceUpdate();
    };
    const handleDecrypted = (event: MatrixEvent) => handle(event);

    mx.on(RoomEvent.Timeline, handle);
    // In an encrypted room the markup is inside the ciphertext, so the event
    // is uninteresting until it decrypts.
    mx.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handle);
      mx.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mx, room.roomId, forceUpdate]);

  const found = useMemo(
    () => findComposerState(room, mx.getUserId()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, mx, updateCount],
  );

  // Memoised, not computed inline: the dismissed branch builds a fresh
  // `{ kind: 'none' }` every render, which would give the returned object a new
  // identity each time and re-render every consumer of this hook forever.
  const state = useMemo<BotComposerState>(
    () => (found.kind !== 'none' && found.eventId === dismissedEventId ? { kind: 'none' } : found),
    [found, dismissedEventId],
  );

  const dismiss = useCallback(() => {
    if (found.kind !== 'none') setDismissedEventId(found.eventId);
  }, [found]);

  const noteUsed = useCallback(() => {
    if (found.kind === 'keyboard' && found.markup.one_time_keyboard) {
      setUsedEventId(found.eventId);
    }
  }, [found]);

  const expand = useCallback(() => setUsedEventId(null), []);

  const collapsed =
    state.kind === 'keyboard' &&
    state.markup.one_time_keyboard === true &&
    state.eventId === usedEventId;

  return useMemo(
    () => ({ state, dismiss, noteUsed, collapsed, expand }),
    [state, dismiss, noteUsed, collapsed, expand],
  );
};
