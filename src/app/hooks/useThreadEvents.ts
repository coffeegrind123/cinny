import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Direction,
  EventTimelineSetHandlerMap,
  MatrixEvent,
  RelationType,
  Room,
  RoomEvent,
} from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export type ThreadEvents = {
  /** Replies, oldest first. Excludes the root. */
  events: MatrixEvent[];
  loading: boolean;
  /** True while older replies remain on the server. */
  canPaginate: boolean;
  paginate: () => void;
};

/**
 * The replies in a thread.
 *
 * Built from `mx.relations` plus the room's own timeline rather than from the
 * sdk's `Thread` model, because that model only exists when the client is
 * created with `threadSupport: true` — and turning that on moves every threaded
 * reply OUT of the main timeline, which would make messages appear to vanish
 * from rooms for anyone who has been using this client. Reading the relations
 * directly gives a thread view without changing where anything else lives.
 */
export const useThreadEvents = (room: Room, rootId: string): ThreadEvents => {
  const mx = useMatrixClient();

  const [fetched, setFetched] = useState<MatrixEvent[]>([]);
  const [nextBatch, setNextBatch] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [liveRevision, setLiveRevision] = useState(0);

  const loadPage = useCallback(
    async (from?: string) => {
      setLoading(true);
      try {
        const result = await mx.relations(room.roomId, rootId, RelationType.Thread, null, {
          from,
          dir: Direction.Backward,
        });
        setFetched((prev) => {
          const seen = new Set(prev.map((e) => e.getId()));
          return [...prev, ...result.events.filter((e) => !seen.has(e.getId()))];
        });
        setNextBatch(result.nextBatch ?? undefined);
        if (!result.nextBatch) setExhausted(true);
      } catch {
        // A server that cannot serve thread relations leaves us with whatever
        // the local timeline holds, which is still a usable thread view.
        setExhausted(true);
      } finally {
        setLoading(false);
      }
    },
    [mx, room.roomId, rootId],
  );

  useEffect(() => {
    setFetched([]);
    setNextBatch(undefined);
    setExhausted(false);
    loadPage();
  }, [loadPage]);

  // Live replies arrive on the room timeline (they are not routed elsewhere
  // without threadSupport), so watch it and re-derive.
  useEffect(() => {
    const handleTimeline: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      toStartOfTimeline,
      removed,
      data,
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      if (mEvent.threadRootId !== rootId) return;
      setLiveRevision((n) => n + 1);
    };
    const handleRedaction = () => setLiveRevision((n) => n + 1);

    room.on(RoomEvent.Timeline, handleTimeline);
    room.on(RoomEvent.Redaction, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimeline);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
    };
  }, [room, rootId]);

  const events = useMemo(() => {
    const byId = new Map<string, MatrixEvent>();

    // Everything the room already has loaded, including local echoes for
    // messages this client just sent — those are not in the relations API yet,
    // and leaving them out makes your own reply look like it failed.
    room
      .getUnfilteredTimelineSet()
      .getLiveTimeline()
      .getEvents()
      .forEach((mEvent) => {
        if (mEvent.threadRootId === rootId) {
          const id = mEvent.getId();
          if (id) byId.set(id, mEvent);
        }
      });

    fetched.forEach((mEvent) => {
      const id = mEvent.getId();
      // Never let a server copy replace a local echo that is still sending.
      if (id && !byId.has(id)) byId.set(id, mEvent);
    });

    return Array.from(byId.values())
      .filter((mEvent) => !mEvent.isRelation(RelationType.Annotation))
      .sort((a, b) => a.getTs() - b.getTs());
    // `liveRevision` is the signal that the room timeline changed underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, rootId, fetched, liveRevision]);

  return {
    events,
    loading,
    canPaginate: !exhausted && !!nextBatch,
    paginate: useCallback(() => {
      if (nextBatch && !loading) loadPage(nextBatch);
    }, [nextBatch, loading, loadPage]),
  };
};
