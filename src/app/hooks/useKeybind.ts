import { useEffect, useRef } from 'react';
import { isKeyHotkey } from 'is-hotkey';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { getKeybindDefinition } from '../state/keybinds';

export function useKeybind(id: string, handler: (event: KeyboardEvent) => void) {
  const [keybinds] = useSetting(settingsAtom, 'keybinds');
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keyString = keybinds[id] ?? getKeybindDefinition(id)?.defaultKeys ?? id;

  useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (isKeyHotkey(keyString, event)) {
        event.preventDefault();
        handlerRef.current(event);
      }
    };
    window.addEventListener('keydown', callback);
    return () => window.removeEventListener('keydown', callback);
  }, [keyString]);
}
