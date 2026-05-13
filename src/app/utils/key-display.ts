import { KeySymbol } from './key-symbol';
import { isMacOS } from './user-agent';

const KEY_NAME_MAP: Record<string, string> = {
  mod: isMacOS() ? KeySymbol.Command : 'Ctrl',
  ctrl: 'Ctrl',
  shift: KeySymbol.Shift,
  alt: isMacOS() ? KeySymbol.Option : 'Alt',
  meta: isMacOS() ? KeySymbol.Command : 'Meta',
  escape: 'Esc',
  enter: 'Enter',
  backspace: 'Backspace',
  delete: 'Del',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: 'Page Up',
  pagedown: 'Page Down',
  space: 'Space',
  tab: 'Tab',
  '+': '+',
  '/': '/',
};

export function formatKeyCombo(keyString: string): string {
  return keyString
    .split('+')
    .map((k) => k.trim())
    .map((k) => KEY_NAME_MAP[k.toLowerCase()] ?? k.toUpperCase())
    .join('');
}

export function formatKeyComboSplit(keyString: string): string[] {
  return keyString
    .split('+')
    .map((k) => k.trim())
    .map((k) => KEY_NAME_MAP[k.toLowerCase()] ?? k.toUpperCase());
}
