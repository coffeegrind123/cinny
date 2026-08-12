import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo } from 'react';
import { Editor } from 'slate';
import { Box, config, MenuItem, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { Command, useCommands } from '../../hooks/useCommands';
import {
  AutocompleteMenu,
  AutocompleteQuery,
  createCommandElement,
  moveCursor,
  replaceWithElement,
} from '../../components/editor';
import { UseAsyncSearchOptions, useAsyncSearch } from '../../hooks/useAsyncSearch';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useKeyDown } from '../../hooks/useKeyDown';
import { clickFocusedAutocompleteItem, onTabPress } from '../../utils/keyboard';
import { useMapStyleUrl } from '../../hooks/useMapStyleUrl';

type CommandAutoCompleteHandler = (commandName: string) => void;

type CommandAutocompleteProps = {
  room: Room;
  editor: Editor;
  query: AutocompleteQuery<string>;
  requestClose: () => void;
};

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  matchOptions: {
    contain: true,
  },
};

export function CommandAutocomplete({
  room,
  editor,
  query,
  requestClose,
}: CommandAutocompleteProps) {
  const mx = useMatrixClient();
  const commands = useCommands(mx, room);
  const mapStyleUrl = useMapStyleUrl();
  const commandNames = useMemo(() => {
    const names = Object.keys(commands) as Command[];
    // Offering `/location` on a homeserver that publishes no `m.tile_server`
    // would autocomplete to a picker with no map in it. Suggesting an action
    // that cannot complete is worse than not suggesting it.
    if (mapStyleUrl) return names;
    return names.filter((name) => name !== Command.Location);
  }, [commands, mapStyleUrl]);

  const [result, search, resetSearch] = useAsyncSearch(
    commandNames,
    useCallback((commandName: string) => commandName, []),
    SEARCH_OPTIONS
  );

  const autoCompleteNames = result ? result.items : commandNames;

  useEffect(() => {
    if (query.text) search(query.text);
    else resetSearch();
  }, [query.text, search, resetSearch]);

  const handleAutocomplete: CommandAutoCompleteHandler = (commandName) => {
    const cmdEl = createCommandElement(commandName);
    replaceWithElement(editor, query.range, cmdEl);
    moveCursor(editor, true);
    requestClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (autoCompleteNames.length === 0) {
        return;
      }
      if (!clickFocusedAutocompleteItem()) handleAutocomplete(autoCompleteNames[0]);
    });
  });

  useKeyDown(window, (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' && autoCompleteNames.length > 0) {
      evt.preventDefault();
      evt.stopPropagation();
      if (!clickFocusedAutocompleteItem()) handleAutocomplete(autoCompleteNames[0]);
    }
  });

  return autoCompleteNames.length === 0 ? null : (
    <AutocompleteMenu
      headerContent={
        <Box grow="Yes" direction="Row" gap="200" justifyContent="SpaceBetween">
          <Text size="L400">Commands</Text>
        </Box>
      }
      requestClose={requestClose}
    >
      {autoCompleteNames.map((commandName, index) => (
        <MenuItem
          key={commandName}
          as="button"
          radii="300"
          data-autocomplete-index={index}
          style={{ height: 'unset' }}
          onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
            onTabPress(evt, () => handleAutocomplete(commandName))
          }
          onClick={() => handleAutocomplete(commandName)}
        >
          <Box
            style={{ padding: `${config.space.S300} 0` }}
            grow="Yes"
            direction="Column"
            gap="100"
            justifyContent="SpaceBetween"
          >
            <Text style={{ flexGrow: 1 }} size="B400" truncate>
              {`/${commandName}`}
            </Text>
            <Text truncate priority="300" size="T200">
              {commands[commandName].description}
            </Text>
          </Box>
        </MenuItem>
      ))}
    </AutocompleteMenu>
  );
}
