import { useCallback, useEffect } from 'react';
import { MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useForceUpdate } from '../../../hooks/useForceUpdate';
import { getEventReactions, getReactionContent } from '../../../utils/room';
import { factoryEventSentBy } from '../../../utils/matrix';
import { MessageEvent } from '../../../../types/matrix/room';

/** The feed's one-tap reaction. Matches what the emoji board sends for a heart. */
export const FEED_REACTION_KEY = '❤️';

export type MediaReaction = {
  count: number;
  reacted: boolean;
  toggle: () => void;
};

/**
 * The heart on a feed page — a real `m.reaction`, not a local like.
 *
 * Same send/redact dance as the timeline's reaction buttons, so a heart here
 * and a 👍 in the timeline are the same kind of thing and are visible to
 * everyone in the room. Reactions arrive as ordinary timeline events, so the
 * count follows the room live.
 */
export const useMediaReaction = (room: Room, eventId: string): MediaReaction => {
  const mx = useMatrixClient();
  const [, forceUpdate] = useForceUpdate();

  useEffect(() => {
    const handleUpdate = (mEvent: MatrixEvent) => {
      const type = mEvent.getType();
      if (type !== MessageEvent.Reaction && type !== MessageEvent.RoomRedaction) return;
      forceUpdate();
    };
    const handleRedaction = () => forceUpdate();

    room.on(RoomEvent.Timeline, handleUpdate);
    room.on(RoomEvent.Redaction, handleRedaction);
    room.on(RoomEvent.LocalEchoUpdated, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleUpdate);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
      room.removeListener(RoomEvent.LocalEchoUpdated, handleRedaction);
    };
  }, [room, forceUpdate]);

  // Read straight from the relations rather than memoising: the answer has to
  // be recomputed on every one of those events anyway, and it is a lookup in a
  // map plus a filter over a handful of reactions.
  const relations = getEventReactions(room.getUnfilteredTimelineSet(), eventId);
  const [, reactionSet] =
    relations?.getSortedAnnotationsByKey()?.find(([key]) => key === FEED_REACTION_KEY) ?? [];
  const reactions = reactionSet
    ? Array.from(reactionSet).filter((mEvent) => !mEvent.isRedacted())
    : [];
  const myReaction = reactions.find(factoryEventSentBy(mx.getSafeUserId()));

  const toggle = useCallback(() => {
    const currentRelations = getEventReactions(room.getUnfilteredTimelineSet(), eventId);
    const [, currentSet] =
      currentRelations?.getSortedAnnotationsByKey()?.find(([key]) => key === FEED_REACTION_KEY) ??
      [];
    const current = currentSet ? Array.from(currentSet) : [];
    const mine = current.find(factoryEventSentBy(mx.getSafeUserId()));

    if (mine && mine.isRelation() && !mine.isRedacted()) {
      const myId = mine.getId();
      if (myId) mx.redactEvent(room.roomId, myId);
      return;
    }
    mx.sendEvent(
      room.roomId,
      MessageEvent.Reaction as any,
      getReactionContent(eventId, FEED_REACTION_KEY),
    );
  }, [mx, room, eventId]);

  return {
    count: reactions.length,
    reacted: !!myReaction,
    toggle,
  };
};
