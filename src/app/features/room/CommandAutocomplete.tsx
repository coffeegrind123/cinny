import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo } from 'react';
import { Editor } from 'slate';
import { Badge, Box, config, MenuItem, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { Command, useCommands } from '../../hooks/useCommands';
import { useBotCommands, type BotCommandEntry } from '../../hooks/useBotCommands';
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

/**
 * One row in the menu.
 *
 * Built-ins and bot commands share a list rather than sitting in separate
 * sections: a user typing `/st` wants everything that starts that way, and
 * splitting the list means the thing they want can be below the fold of a
 * section they were not looking at. The bot badge carries the distinction.
 */
type Suggestion = {
  /** Name shown to the user, without the slash. */
  name: string;
  /** What gets inserted — may carry `@bot` addressing. */
  insertName: string;
  description: string;
  args?: string;
  /** Absent for this client's own commands. */
  botName?: string;
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

  const builtInNames = useMemo(() => {
    const names = Object.keys(commands) as Command[];
    // Offering `/location` on a homeserver that publishes no `m.tile_server`
    // would autocomplete to a picker with no map in it. Suggesting an action
    // that cannot complete is worse than not suggesting it.
    if (mapStyleUrl) return names;
    return names.filter((name) => name !== Command.Location);
  }, [commands, mapStyleUrl]);

  const botCommands = useBotCommands(room, builtInNames);

  const suggestions = useMemo<Suggestion[]>(() => {
    const builtIn: Suggestion[] = builtInNames.map((name) => ({
      name,
      insertName: name,
      description: commands[name].description,
    }));

    const fromBots: Suggestion[] = botCommands.map((entry: BotCommandEntry) => {
      const suggestion: Suggestion = {
        name: entry.name,
        insertName: entry.insertName,
        description: entry.description,
        botName: entry.botName,
      };
      if (entry.args) suggestion.args = entry.args;
      return suggestion;
    });

    return [...builtIn, ...fromBots];
  }, [builtInNames, commands, botCommands]);

  const [result, search, resetSearch] = useAsyncSearch(
    suggestions,
    useCallback((suggestion: Suggestion) => suggestion.name, []),
    SEARCH_OPTIONS,
  );

  const autoCompleteItems = result ? result.items : suggestions;

  useEffect(() => {
    if (query.text) search(query.text);
    else resetSearch();
  }, [query.text, search, resetSearch]);

  const handleAutocomplete: CommandAutoCompleteHandler = (insertName) => {
    const cmdEl = createCommandElement(insertName);
    replaceWithElement(editor, query.range, cmdEl);
    moveCursor(editor, true);
    requestClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (autoCompleteItems.length === 0) {
        return;
      }
      if (!clickFocusedAutocompleteItem()) handleAutocomplete(autoCompleteItems[0].insertName);
    });
  });

  useKeyDown(window, (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' && autoCompleteItems.length > 0) {
      evt.preventDefault();
      evt.stopPropagation();
      if (!clickFocusedAutocompleteItem()) handleAutocomplete(autoCompleteItems[0].insertName);
    }
  });

  return autoCompleteItems.length === 0 ? null : (
    <AutocompleteMenu
      headerContent={
        <Box grow="Yes" direction="Row" gap="200" justifyContent="SpaceBetween">
          <Text size="L400">Commands</Text>
        </Box>
      }
      requestClose={requestClose}
    >
      {autoCompleteItems.map((suggestion, index) => (
        <MenuItem
          key={`${suggestion.botName ?? ''}/${suggestion.insertName}`}
          as="button"
          radii="300"
          data-autocomplete-index={index}
          style={{ height: 'unset' }}
          onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
            onTabPress(evt, () => handleAutocomplete(suggestion.insertName))
          }
          onClick={() => handleAutocomplete(suggestion.insertName)}
        >
          <Box
            style={{ padding: `${config.space.S300} 0` }}
            grow="Yes"
            direction="Column"
            gap="100"
            justifyContent="SpaceBetween"
          >
            <Box direction="Row" gap="200" alignItems="Center">
              <Text style={{ flexGrow: 1 }} size="B400" truncate>
                {suggestion.args ? `/${suggestion.name} ${suggestion.args}` : `/${suggestion.name}`}
              </Text>
              {suggestion.botName && (
                <Badge as="span" size="400" variant="Secondary" fill="Soft" radii="Pill">
                  <Text as="span" size="L400" truncate>
                    {suggestion.botName}
                  </Text>
                </Badge>
              )}
            </Box>
            <Text truncate priority="300" size="T200">
              {suggestion.description}
            </Text>
          </Box>
        </MenuItem>
      ))}
    </AutocompleteMenu>
  );
}
