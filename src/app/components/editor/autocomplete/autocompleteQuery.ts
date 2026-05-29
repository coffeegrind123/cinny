import { BaseRange, Editor } from 'slate';

export enum AutocompletePrefix {
  RoomMention = '#',
  UserMention = '@',
  Emoticon = ':',
  Command = '/',
}
export const AUTOCOMPLETE_PREFIXES: readonly AutocompletePrefix[] = [
  AutocompletePrefix.RoomMention,
  AutocompletePrefix.UserMention,
  AutocompletePrefix.Emoticon,
  AutocompletePrefix.Command,
];

export type AutocompleteQuery<TPrefix extends string> = {
  range: BaseRange;
  prefix: TPrefix;
  text: string;
};

export const getAutocompletePrefix = <TPrefix extends string>(
  editor: Editor,
  queryRange: BaseRange,
  validPrefixes: readonly TPrefix[]
): TPrefix | undefined => {
  const world = Editor.string(editor, queryRange);
  return validPrefixes.find((p) => world.startsWith(p));
};

export const getAutocompleteQueryText = (
  editor: Editor,
  queryRange: BaseRange,
  prefix: string
): string => Editor.string(editor, queryRange).slice(prefix.length);

// Emoji shortcodes only ever contain word characters plus `+`/`-`
// (e.g. `+1`, `-1`, `e-mail`, `crossed_fingers`). Punctuation like the `)`
// in a typed-out smiley `:)` must NOT trigger the emoji autocomplete — doing
// so silently auto-inserts an unrelated emoji on Enter instead of sending the
// literal text. Anchored to the start so a trailing stray char rejects the
// whole query.
const EMOTICON_QUERY_RE = /^[a-zA-Z0-9_+-]*$/;

export const getAutocompleteQuery = <TPrefix extends string>(
  editor: Editor,
  queryRange: BaseRange,
  validPrefixes: readonly TPrefix[]
): AutocompleteQuery<TPrefix> | undefined => {
  const prefix = getAutocompletePrefix(editor, queryRange, validPrefixes);
  if (!prefix) return undefined;
  const text = getAutocompleteQueryText(editor, queryRange, prefix);
  if (prefix === AutocompletePrefix.Emoticon && !EMOTICON_QUERY_RE.test(text)) {
    return undefined;
  }
  return {
    range: queryRange,
    prefix,
    text,
  };
};
