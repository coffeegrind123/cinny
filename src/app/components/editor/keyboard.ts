import { isKeyHotkey } from '../../utils/is-hotkey';
import { KeyboardEvent } from 'react';
import { Editor, Element as SlateElement, Range, Transforms } from 'slate';
import { isAnyMarkActive, isBlockActive, removeAllMark, toggleBlock, toggleMark } from './utils';
import { BlockType, MarkType } from './types';
import { getSettings } from '../../state/settings';

function getKeybind(id: string, fallback: string): string {
  try {
    const settings = getSettings();
    return settings.keybinds[id] ?? fallback;
  } catch {
    return fallback;
  }
}

const INLINE_DEFAULTS: Record<string, MarkType> = {
  'mod+b': MarkType.Bold,
  'mod+i': MarkType.Italic,
  'mod+u': MarkType.Underline,
  'mod+s': MarkType.StrikeThrough,
  'mod+[': MarkType.Code,
  'mod+h': MarkType.Spoiler,
};

const BLOCK_DEFAULTS: Record<string, BlockType> = {
  'mod+7': BlockType.OrderedList,
  'mod+8': BlockType.UnorderedList,
  "mod+'": BlockType.BlockQuote,
  'mod+;': BlockType.CodeBlock,
};

const INLINE_IDS: Record<string, string> = {
  'mod+b': 'format-bold',
  'mod+i': 'format-italic',
  'mod+u': 'format-underline',
  'mod+s': 'format-strikethrough',
  'mod+[': 'format-inline-code',
  'mod+h': 'format-spoiler',
};

const BLOCK_IDS: Record<string, string> = {
  'mod+7': 'format-ordered-list',
  'mod+8': 'format-unordered-list',
  "mod+'": 'format-block-quote',
  'mod+;': 'format-code-block',
};

function getInlineHotkeys(): Record<string, MarkType> {
  const result: Record<string, MarkType> = {};
  for (const [defaultKey, markType] of Object.entries(INLINE_DEFAULTS)) {
    const id = INLINE_IDS[defaultKey];
    const key = id ? getKeybind(id, defaultKey) : defaultKey;
    result[key] = markType;
  }
  return result;
}

function getBlockHotkeys(): Record<string, BlockType> {
  const result: Record<string, BlockType> = {};
  for (const [defaultKey, blockType] of Object.entries(BLOCK_DEFAULTS)) {
    const id = BLOCK_IDS[defaultKey];
    const key = id ? getKeybind(id, defaultKey) : defaultKey;
    result[key] = blockType;
  }
  return result;
}

/**
 * @return boolean true if shortcut is toggled.
 */
export const toggleKeyboardShortcut = (editor: Editor, event: KeyboardEvent<Element>): boolean => {
  if (isKeyHotkey('backspace', event) && editor.selection && Range.isCollapsed(editor.selection)) {
    const startPoint = Range.start(editor.selection);
    if (startPoint.offset !== 0) return false;

    const [parentNode, parentPath] = Editor.parent(editor, startPoint);
    const parentLocation = { at: parentPath };
    const [previousNode] = Editor.previous(editor, parentLocation) ?? [];
    const [nextNode] = Editor.next(editor, parentLocation) ?? [];

    if (Editor.isEditor(parentNode)) return false;

    if (parentNode.type === BlockType.Heading) {
      toggleBlock(editor, BlockType.Paragraph);
      return true;
    }
    if (
      parentNode.type === BlockType.CodeLine ||
      parentNode.type === BlockType.QuoteLine ||
      parentNode.type === BlockType.ListItem
    ) {
      // exit formatting only when line block
      // is first of last of it's parent
      if (!previousNode || !nextNode) {
        toggleBlock(editor, BlockType.Paragraph);
        return true;
      }
    }
    // Unwrap paragraph children to put them
    // in previous none paragraph element
    if (SlateElement.isElement(previousNode) && previousNode.type !== BlockType.Paragraph) {
      Transforms.unwrapNodes(editor, {
        at: startPoint,
      });
    }
    Editor.deleteBackward(editor);
    return true;
  }

  const clearKey = getKeybind('format-clear', 'mod+e');

  if (isKeyHotkey(clearKey, event) || isKeyHotkey('escape', event)) {
    if (isAnyMarkActive(editor)) {
      removeAllMark(editor);
      return true;
    }

    if (!isBlockActive(editor, BlockType.Paragraph)) {
      toggleBlock(editor, BlockType.Paragraph);
      return true;
    }
    return false;
  }

  const blockHotkeys = getBlockHotkeys();
  const blockKeys = Object.keys(blockHotkeys);
  const blockToggled = blockKeys.find((hotkey) => {
    if (isKeyHotkey(hotkey, event)) {
      event.preventDefault();
      toggleBlock(editor, blockHotkeys[hotkey]);
      return true;
    }
    return false;
  });
  if (blockToggled) return true;

  const h1Key = getKeybind('format-heading-1', 'mod+1');
  const h2Key = getKeybind('format-heading-2', 'mod+2');
  const h3Key = getKeybind('format-heading-3', 'mod+3');
  if (isKeyHotkey(h1Key, event)) {
    toggleBlock(editor, BlockType.Heading, { level: 1 });
    return true;
  }
  if (isKeyHotkey(h2Key, event)) {
    toggleBlock(editor, BlockType.Heading, { level: 2 });
    return true;
  }
  if (isKeyHotkey(h3Key, event)) {
    toggleBlock(editor, BlockType.Heading, { level: 3 });
    return true;
  }

  const inlineHotkeys = getInlineHotkeys();
  const inlineKeys = Object.keys(inlineHotkeys);
  const inlineToggled = isBlockActive(editor, BlockType.CodeBlock)
    ? false
    : inlineKeys.find((hotkey) => {
        if (isKeyHotkey(hotkey, event)) {
          event.preventDefault();
          toggleMark(editor, inlineHotkeys[hotkey]);
          return true;
        }
        return false;
      });
  return !!inlineToggled;
};
