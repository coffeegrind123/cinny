import { useEffect, useRef } from 'react';
import { isKeyHotkey } from '../utils/is-hotkey';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { getKeybindDefinition } from '../state/keybinds';

type Handler = (event: KeyboardEvent) => void | false;
type KeybindOptions = {
  // If true, the binding still fires when an `<input>`, `<textarea>`, or
  // any `contenteditable` element holds focus. Default: only fire in
  // editables when the binding includes a modifier (Mod/Ctrl/Alt/Shift),
  // so plain-letter bindings like "e" or "p" don't hijack typing.
  allowInEditable?: boolean;
};

const MODIFIER_RE = /(^|\+)\s*(mod|ctrl|cmd|control|alt|opt|shift|meta|win)\s*\+/i;
function bindingHasModifier(keyString: string): boolean {
  return MODIFIER_RE.test(keyString);
}

function isEditableElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeybind(id: string, handler: Handler, options?: KeybindOptions) {
  const [keybinds] = useSetting(settingsAtom, 'keybinds');
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keyString = keybinds[id] ?? getKeybindDefinition(id)?.defaultKeys ?? id;
  const allowInEditable = options?.allowInEditable ?? bindingHasModifier(keyString);

  useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (!isKeyHotkey(keyString, event)) return;
      if (!allowInEditable && isEditableElementFocused()) return;
      const result = handlerRef.current(event);
      // Returning `false` opts out of preventDefault — lets Mod+C fall
      // through to the browser when a real text selection exists, etc.
      if (result !== false) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', callback);
    return () => window.removeEventListener('keydown', callback);
  }, [keyString, allowInEditable]);
}
