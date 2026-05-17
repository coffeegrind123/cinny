import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { useKeybind } from '../../hooks/useKeybind';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useSelectedSpace } from '../../hooks/router/useSelectedSpace';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { settingsAtom } from '../../state/settings';
import { useSetSetting, useSetting } from '../../state/hooks/settings';
import { keyboardShortcutsAtom } from '../../state/keybinds';
import { searchModalAtom } from '../../state/searchModal';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { mDirectAtom } from '../../state/mDirectList';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useSpaces } from '../../state/hooks/roomList';
import { markAsRead } from '../../utils/notifications';
import { isSpace } from '../../utils/room';

// True when an editable element is focused (text input, textarea, or any
// contenteditable). Used to suppress global keybinds that would otherwise
// hijack typing (e.g. Escape, PageUp/Down with no modifier).
function isEditableElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

// Roll over to the other end of the list when reaching the boundary so
// power-users can keep tapping the same key without thinking about wrap.
function step<T>(list: readonly T[], current: T | undefined, dir: 1 | -1): T | undefined {
  if (list.length === 0) return undefined;
  const idx = current === undefined ? -1 : list.indexOf(current);
  if (idx < 0) return list[dir === 1 ? 0 : list.length - 1];
  const next = (idx + dir + list.length) % list.length;
  return list[next];
}

export function GlobalKeybinds() {
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const selectedRoomId = useSelectedRoom();
  const selectedSpaceId = useSelectedSpace();
  const { navigateRoom, navigateSpace } = useRoomNavigate();

  const setKeyboardShortcutsOpen = useSetAtom(keyboardShortcutsAtom);
  const setSearchOpen = useSetAtom(searchModalAtom);
  const setSettings = useSetSetting(settingsAtom, 'isPeopleDrawer');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const allRooms = useAtomValue(allRoomsAtom);
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const spaces = useSpaces(mx, allRoomsAtom);

  // ── Member-list drawer (Mod+Shift+M) ─────────────────────────
  useKeybind('toggle-member-list', () => {
    setSettings((prev) => !prev);
  });

  // ── Shortcuts panel (Mod+/) ──────────────────────────────────
  useKeybind('keyboard-shortcuts', () => {
    setKeyboardShortcutsOpen(true);
  });

  // ── Quick switcher (Mod+K) ───────────────────────────────────
  // Search.tsx already opens this on Mod+K via its own listener, but
  // duplicating here keeps the binding configurable through the registry
  // and is harmless (the modal open atom is idempotent).
  useKeybind('quick-switcher', () => {
    setSearchOpen((prev) => !prev);
  });

  // ── History back / forward (Alt+Left / Alt+Right) ────────────
  useKeybind('nav-history-back', () => {
    navigate(-1);
  });
  useKeybind('nav-history-forward', () => {
    navigate(1);
  });

  // ── Sibling rooms within the current view ────────────────────
  // Pick the ordered list of rooms that are siblings of the currently
  // selected one. If we're inside a space, that's the rooms of that
  // space. If we're at the top-level Home view, that's orphan rooms
  // and DMs. Falls back to the global ordered list.
  const visibleRoomIds = useCallback((): string[] => {
    if (selectedSpaceId) {
      return allRooms.filter((rid) => {
        const room = mx.getRoom(rid);
        if (!room || isSpace(room)) return false;
        const parents = roomToParents.get(rid);
        return parents?.has(selectedSpaceId) ?? false;
      });
    }
    return allRooms.filter((rid) => {
      const room = mx.getRoom(rid);
      return !!room && !isSpace(room);
    });
  }, [allRooms, mx, roomToParents, selectedSpaceId]);

  useKeybind('nav-channels-up', () => {
    const list = visibleRoomIds();
    const next = step(list, selectedRoomId, -1);
    if (next) navigateRoom(next);
  });
  useKeybind('nav-channels-down', () => {
    const list = visibleRoomIds();
    const next = step(list, selectedRoomId, 1);
    if (next) navigateRoom(next);
  });

  // ── Space switching (Mod+Alt+Up / Mod+Alt+Down) ──────────────
  useKeybind('nav-servers-up', () => {
    const next = step(spaces, selectedSpaceId, -1);
    if (next) navigateSpace(next);
  });
  useKeybind('nav-servers-down', () => {
    const next = step(spaces, selectedSpaceId, 1);
    if (next) navigateSpace(next);
  });

  // ── Unread / unread-mention navigation ───────────────────────
  // Filtered lists are computed at keypress time, not memoized, because
  // they're cheap and the underlying unread map changes constantly.
  useKeybind('nav-unread-up', () => {
    const list = allRooms.filter((rid) => (roomToUnread.get(rid)?.total ?? 0) > 0);
    const next = step(list, selectedRoomId, -1);
    if (next) navigateRoom(next);
  });
  useKeybind('nav-unread-down', () => {
    const list = allRooms.filter((rid) => (roomToUnread.get(rid)?.total ?? 0) > 0);
    const next = step(list, selectedRoomId, 1);
    if (next) navigateRoom(next);
  });
  useKeybind('nav-unread-mentions-up', () => {
    const list = allRooms.filter((rid) => (roomToUnread.get(rid)?.highlight ?? 0) > 0);
    const next = step(list, selectedRoomId, -1);
    if (next) navigateRoom(next);
  });
  useKeybind('nav-unread-mentions-down', () => {
    const list = allRooms.filter((rid) => (roomToUnread.get(rid)?.highlight ?? 0) > 0);
    const next = step(list, selectedRoomId, 1);
    if (next) navigateRoom(next);
  });

  // ── Mark current room / current space as read ────────────────
  // Escape is also bound to mark-channel-read; suppress when an
  // editable element has focus so the composer's escape (clear reply)
  // and modal escapes win.
  useKeybind('mark-channel-read', () => {
    if (isEditableElementFocused()) return;
    if (selectedRoomId) {
      markAsRead(mx, selectedRoomId, hideActivity);
    }
  });
  useKeybind('mark-server-read', () => {
    if (isEditableElementFocused()) return;
    if (selectedSpaceId) {
      // Only rooms whose parents include the current space.
      allRooms.forEach((rid) => {
        const room = mx.getRoom(rid);
        if (!room || isSpace(room)) return;
        const parents = roomToParents.get(rid);
        if (!parents?.has(selectedSpaceId)) return;
        markAsRead(mx, rid, hideActivity);
      });
    } else {
      // Top-level Home: clear every non-space room + DMs.
      allRooms.forEach((rid) => {
        const room = mx.getRoom(rid);
        if (!room || isSpace(room)) return;
        if (mDirects.has(rid) || !roomToParents.has(rid)) {
          markAsRead(mx, rid, hideActivity);
        }
      });
    }
  });

  // ── Jump to oldest unread in current room ────────────────────
  useKeybind('jump-oldest-unread', () => {
    if (!selectedRoomId) return;
    const room = mx.getRoom(selectedRoomId);
    if (!room) return;
    const userId = mx.getUserId();
    if (!userId) return;
    const readUpTo = room.getEventReadUpTo(userId);
    if (readUpTo) {
      navigateRoom(selectedRoomId, readUpTo);
    }
  });

  // ── Scroll the active timeline ───────────────────────────────
  // The RoomTimeline registers its scroll container via the global
  // ref below (see setTimelineScroll). We dispatch synthetic
  // scroll-by-page operations to that element.
  const scrollActiveTimeline = (dir: 1 | -1, factor = 0.9) => {
    if (isEditableElementFocused()) return;
    const el = getActiveTimelineScrollContainer();
    if (!el) return;
    const page = el.clientHeight * factor;
    el.scrollBy({ top: dir * page, behavior: 'smooth' });
  };
  useKeybind('scroll-chat-up', () => scrollActiveTimeline(-1));
  useKeybind('scroll-chat-down', () => scrollActiveTimeline(1));

  return null;
}

// ── Active-timeline scroll registration ─────────────────────────
// The room timeline component registers its scroll container here on
// mount. The global PageUp/PageDown keybind walks this ref to scroll
// the current room without needing a context plumbed through the tree.
let activeTimelineScrollEl: HTMLElement | null = null;
export function setActiveTimelineScrollContainer(el: HTMLElement | null) {
  activeTimelineScrollEl = el;
}
export function getActiveTimelineScrollContainer(): HTMLElement | null {
  return activeTimelineScrollEl;
}
