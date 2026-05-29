import { isKeyHotkey } from 'is-hotkey';
import { KeyboardEventHandler } from 'react';

export interface KeyboardEventLike {
  key: string;
  which: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
}

export const onTabPress = (evt: KeyboardEventLike, callback: () => void) => {
  if (isKeyHotkey('tab', evt)) {
    evt.preventDefault();
    callback();
  }
};

// Autocomplete menus (emoji / mention / room / command) render their items
// as buttons tagged with `data-autocomplete-index`. The FocusTrap inside
// AutocompleteMenu moves real DOM focus between those buttons as the user
// presses ArrowUp/ArrowDown, so `document.activeElement` is the selected
// item. Committing on Enter/Tab used to ignore that and always pick item 0,
// so arrow-key selection had no effect. When an item is focused we click it
// instead — reusing the exact same code path as a mouse click, so the
// *selected* item is inserted and the caret is restored correctly. Returns
// false when focus is still in the editor (no item arrowed to), letting each
// menu fall back to its own "commit first / unknown" logic.
export const clickFocusedAutocompleteItem = (): boolean => {
  const active = document.activeElement as HTMLElement | null;
  const focused = active?.closest<HTMLElement>('[data-autocomplete-index]') ?? null;
  if (focused) {
    focused.click();
    return true;
  }
  return false;
};

export const preventScrollWithArrowKey: KeyboardEventHandler = (evt) => {
  if (isKeyHotkey(['arrowup', 'arrowright', 'arrowdown', 'arrowleft'], evt)) {
    evt.preventDefault();
  }
};

export const onEnterOrSpace =
  <T>(callback: (evt: T) => void) =>
  (evt: KeyboardEventLike) => {
    if (isKeyHotkey('enter', evt) || isKeyHotkey('space', evt)) {
      evt.preventDefault();
      callback(evt as T);
    }
  };

export const stopPropagation = (evt: KeyboardEvent): boolean => {
  const ae = document.activeElement;
  const editableActiveElement = ae
    ? ae.nodeName.toLowerCase() === 'input' ||
      ae.nodeName.toLowerCase() === 'textarea' ||
      ae.getAttribute('contenteditable') === 'true'
    : false;

  if (editableActiveElement) return false;

  evt.stopPropagation();
  return true;
};
