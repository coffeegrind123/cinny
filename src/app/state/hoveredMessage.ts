// Module-level mutable ref tracking the message currently under the
// cursor. Used by keybinds (edit / delete / pin / reply / copy / mark
// unread) so a global keydown handler can act on the "current" message
// without React context plumbing.
//
// Deliberately not a jotai atom — every Message component would re-render
// on every hover change in the timeline.

let hoveredEventId: string | null = null;

export function setHoveredMessageEventId(id: string | null) {
  hoveredEventId = id;
}

export function clearHoveredMessageEventId(id: string) {
  // Only clear if this message is still the active one — protects
  // against a mouseleave handler firing after the cursor has already
  // moved onto the next message.
  if (hoveredEventId === id) {
    hoveredEventId = null;
  }
}

export function getHoveredMessageEventId(): string | null {
  return hoveredEventId;
}
