import { atom } from 'jotai';

export enum KeybindCategory {
  Messages = 'Messages',
  Navigation = 'Navigation',
  Formatting = 'Formatting',
  Chat = 'Chat',
  Input = 'Input',
  Call = 'Call',
}

export interface KeybindDefinition {
  id: string;
  description: string;
  category: KeybindCategory;
  /**
   * The key combo, or — when `gesture` is set — the literal label to show for
   * a pointer gesture that has no combo to capture.
   */
  defaultKeys: string;
  /**
   * A pointer gesture rather than a key.
   *
   * It lives in this registry because this is where a user looks to find out
   * what the client responds to, and a gesture nobody can discover may as well
   * not exist. It is not rebindable — there is no second mouse chord to move it
   * to — so it carries a boolean setting instead, and the settings screen
   * renders a switch where it would otherwise render a key capture.
   */
  gesture?: true;
  /** The `Settings` key holding the on/off state. Only for `gesture` entries. */
  settingKey?: string;
}

export const KEYBIND_DEFINITIONS: KeybindDefinition[] = [
  // ── Messages ─────────────────────────────────────────────
  {
    id: 'edit-message',
    description: 'Edit Message',
    category: KeybindCategory.Messages,
    defaultKeys: 'e',
  },
  {
    id: 'delete-message',
    description: 'Delete Message',
    category: KeybindCategory.Messages,
    defaultKeys: 'backspace',
  },
  {
    id: 'pin-message',
    description: 'Pin Message',
    category: KeybindCategory.Messages,
    defaultKeys: 'p',
  },
  {
    id: 'add-reaction',
    description: 'Add Reaction',
    category: KeybindCategory.Messages,
    defaultKeys: '+',
  },
  {
    id: 'reply-message',
    description: 'Reply',
    category: KeybindCategory.Messages,
    defaultKeys: 'r',
  },
  {
    id: 'reply-double-click',
    description: 'Reply (double-click a message)',
    category: KeybindCategory.Messages,
    defaultKeys: 'Double-click',
    gesture: true,
    settingKey: 'replyOnDoubleClick',
  },
  {
    id: 'forward-message',
    description: 'Forward Message',
    category: KeybindCategory.Messages,
    defaultKeys: 'f',
  },
  {
    id: 'copy-text',
    description: 'Copy Text',
    category: KeybindCategory.Messages,
    defaultKeys: 'mod+c',
  },
  {
    id: 'mark-unread',
    description: 'Mark Unread',
    category: KeybindCategory.Messages,
    defaultKeys: 'alt+enter',
  },
  {
    id: 'focus-textarea',
    description: 'Focus text area',
    category: KeybindCategory.Messages,
    defaultKeys: 'escape',
  },

  // ── Navigation ───────────────────────────────────────────
  {
    id: 'quick-switcher',
    description: 'Toggle QuickSwitcher',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+k',
  },
  {
    id: 'nav-servers-up',
    description: 'Navigate to previous server',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+alt+up',
  },
  {
    id: 'nav-servers-down',
    description: 'Navigate to next server',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+alt+down',
  },
  {
    id: 'nav-channels-up',
    description: 'Navigate to previous channel',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+up',
  },
  {
    id: 'nav-channels-down',
    description: 'Navigate to next channel',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+down',
  },
  {
    id: 'nav-history-back',
    description: 'Navigate back in page history',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+left',
  },
  {
    id: 'nav-history-forward',
    description: 'Navigate forward in page history',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+right',
  },
  {
    id: 'nav-unread-up',
    description: 'Navigate to previous unread channel',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+shift+up',
  },
  {
    id: 'nav-unread-down',
    description: 'Navigate to next unread channel',
    category: KeybindCategory.Navigation,
    defaultKeys: 'alt+shift+down',
  },
  {
    id: 'nav-unread-mentions-up',
    description: 'Navigate to previous unread mention',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+shift+alt+up',
  },
  {
    id: 'nav-unread-mentions-down',
    description: 'Navigate to next unread mention',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+shift+alt+down',
  },

  // ── Formatting ───────────────────────────────────────────
  {
    id: 'format-bold',
    description: 'Bold',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+b',
  },
  {
    id: 'format-italic',
    description: 'Italic',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+i',
  },
  {
    id: 'format-underline',
    description: 'Underline',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+u',
  },
  {
    id: 'format-strikethrough',
    description: 'Strikethrough',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+s',
  },
  {
    id: 'format-inline-code',
    description: 'Inline Code',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+[',
  },
  {
    id: 'format-spoiler',
    description: 'Spoiler',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+h',
  },
  {
    id: 'format-ordered-list',
    description: 'Ordered List',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+7',
  },
  {
    id: 'format-unordered-list',
    description: 'Unordered List',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+8',
  },
  {
    id: 'format-block-quote',
    description: 'Block Quote',
    category: KeybindCategory.Formatting,
    defaultKeys: "mod+'",
  },
  {
    id: 'format-code-block',
    description: 'Code Block',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+;',
  },
  {
    id: 'format-heading-1',
    description: 'Heading 1',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+1',
  },
  {
    id: 'format-heading-2',
    description: 'Heading 2',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+2',
  },
  {
    id: 'format-heading-3',
    description: 'Heading 3',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+3',
  },
  {
    id: 'format-clear',
    description: 'Clear formatting',
    category: KeybindCategory.Formatting,
    defaultKeys: 'mod+e',
  },

  // ── Chat ─────────────────────────────────────────────────
  {
    id: 'mark-server-read',
    description: 'Mark server as read',
    category: KeybindCategory.Chat,
    defaultKeys: 'shift+escape',
  },
  {
    id: 'mark-channel-read',
    description: 'Mark channel as read',
    category: KeybindCategory.Chat,
    // Previously `escape` which collided with focus-textarea. Moved to
    // `alt+shift+r` so plain Escape stays free for focus / overlay-close.
    defaultKeys: 'alt+shift+r',
  },
  {
    id: 'toggle-member-list',
    description: 'Toggle member list',
    category: KeybindCategory.Chat,
    // Previously `mod+u` which collided with format-underline. Moved to
    // `mod+shift+m` (M for Members) so the formatting key stays intact.
    defaultKeys: 'mod+shift+m',
  },
  {
    id: 'toggle-emoji-picker',
    description: 'Toggle emoji picker',
    category: KeybindCategory.Chat,
    // Previously `mod+e` which collided with format-clear. Moved to
    // `mod+shift+e` so the formatting key keeps `mod+e`.
    defaultKeys: 'mod+shift+e',
  },
  {
    id: 'scroll-chat-up',
    description: 'Scroll chat up',
    category: KeybindCategory.Chat,
    defaultKeys: 'pageup',
  },
  {
    id: 'scroll-chat-down',
    description: 'Scroll chat down',
    category: KeybindCategory.Chat,
    defaultKeys: 'pagedown',
  },
  {
    id: 'jump-oldest-unread',
    description: 'Jump to oldest unread',
    category: KeybindCategory.Chat,
    defaultKeys: 'shift+pageup',
  },
  {
    id: 'upload-file',
    description: 'Upload a file',
    category: KeybindCategory.Chat,
    defaultKeys: 'mod+shift+u',
  },

  // ── Input ────────────────────────────────────────────────
  {
    id: 'send-message',
    description: 'Send message',
    category: KeybindCategory.Input,
    defaultKeys: 'mod+enter',
  },
  {
    id: 'indent',
    description: 'Indent',
    category: KeybindCategory.Input,
    defaultKeys: 'tab',
  },
  {
    id: 'unindent',
    description: 'Unindent',
    category: KeybindCategory.Input,
    defaultKeys: 'shift+tab',
  },
  {
    id: 'edit-last-message',
    description: 'Edit last message',
    category: KeybindCategory.Input,
    defaultKeys: 'up',
  },

  // ── Misc ─────────────────────────────────────────────────
  {
    id: 'keyboard-shortcuts',
    description: 'Keyboard shortcuts',
    category: KeybindCategory.Navigation,
    defaultKeys: 'mod+/',
  },

  // ── Call ─────────────────────────────────────────────────
  // These only fire while an Element Call embed is active (gated by
  // `useCallEmbed()` in the binding component). Defaults follow the
  // Discord convention of Mod+Shift+<letter>.
  {
    id: 'call-toggle-microphone',
    description: 'Toggle microphone (in-call)',
    category: KeybindCategory.Call,
    defaultKeys: 'mod+shift+a',
  },
  {
    id: 'call-toggle-video',
    description: 'Toggle camera (in-call)',
    category: KeybindCategory.Call,
    defaultKeys: 'mod+shift+v',
  },
  {
    id: 'call-toggle-screenshare',
    description: 'Toggle screenshare (in-call)',
    category: KeybindCategory.Call,
    defaultKeys: 'mod+shift+s',
  },
  {
    id: 'call-toggle-sound',
    description: 'Toggle outgoing audio (in-call)',
    category: KeybindCategory.Call,
    defaultKeys: 'mod+shift+d',
  },
  {
    id: 'call-hangup',
    description: 'Leave the call',
    category: KeybindCategory.Call,
    defaultKeys: 'mod+shift+h',
  },
];

const KEYBIND_MAP = new Map<string, KeybindDefinition>();
for (const def of KEYBIND_DEFINITIONS) {
  KEYBIND_MAP.set(def.id, def);
}

export function getKeybindDefinition(id: string): KeybindDefinition | undefined {
  return KEYBIND_MAP.get(id);
}

export function getCurrentKey(id: string, overrides: Record<string, string>): string {
  return overrides[id] ?? getKeybindDefinition(id)?.defaultKeys ?? id;
}

export const DEFAULT_KEYBINDS: Record<string, string> = {};
for (const def of KEYBIND_DEFINITIONS) {
  DEFAULT_KEYBINDS[def.id] = def.defaultKeys;
}

export const keyboardShortcutsAtom = atom<boolean>(false);
