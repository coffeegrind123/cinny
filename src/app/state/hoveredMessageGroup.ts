// Which message GROUP the pointer is inside, published to the group's first
// message.
//
// A run of consecutive messages from the same sender renders as one group: the
// first message carries the header (avatar, display name, time, mxid) and every
// message after it is collapsed. The sender's mxid belongs on that header, but
// the pointer is just as likely to be on one of the collapsed messages below it
// — so the message that has to *react* to the hover is not the message being
// hovered.
//
// Deliberately not a jotai atom, for the same reason `hoveredMessage` is not:
// a shared atom re-renders every message in the timeline on every hover change.
// Listeners are keyed by group head, so a hover moving between groups wakes
// exactly two components — the head that lost the pointer and the one that
// gained it — and moving *within* a group wakes none at all.

type Listener = () => void;

/** Event id of the message directly under the pointer. */
let hoveredEventId: string | null = null;
/** Event id of the first message in that message's group. */
let hoveredGroupHeadId: string | null = null;

const listeners = new Map<string, Set<Listener>>();

const notify = (groupHeadId: string | null) => {
  if (!groupHeadId) return;
  listeners.get(groupHeadId)?.forEach((listener) => listener());
};

export function setHoveredMessageGroup(eventId: string, groupHeadId: string) {
  if (hoveredEventId === eventId && hoveredGroupHeadId === groupHeadId) return;
  const prevGroupHeadId = hoveredGroupHeadId;
  hoveredEventId = eventId;
  hoveredGroupHeadId = groupHeadId;

  // Moving between two messages of the SAME group changes nothing anybody is
  // subscribed to — the label is already up on the head, and re-notifying would
  // re-render it for no visible change.
  if (prevGroupHeadId === groupHeadId) return;
  notify(prevGroupHeadId);
  notify(groupHeadId);
}

export function clearHoveredMessageGroup(eventId: string) {
  // Only clear if this message is still the one under the pointer. A mouseleave
  // can commit after the neighbour's mouseenter — including when the neighbour
  // is in the same group, where clearing would drop the label for an instant
  // while the pointer never left the group.
  if (hoveredEventId !== eventId) return;
  const prevGroupHeadId = hoveredGroupHeadId;
  hoveredEventId = null;
  hoveredGroupHeadId = null;
  notify(prevGroupHeadId);
}

export function subscribeHoveredMessageGroup(groupHeadId: string, listener: Listener): () => void {
  const groupListeners = listeners.get(groupHeadId) ?? new Set<Listener>();
  groupListeners.add(listener);
  listeners.set(groupHeadId, groupListeners);

  return () => {
    groupListeners.delete(listener);
    if (groupListeners.size === 0) listeners.delete(groupHeadId);
  };
}

export function isHoveredMessageGroup(groupHeadId: string): boolean {
  return hoveredGroupHeadId === groupHeadId;
}
