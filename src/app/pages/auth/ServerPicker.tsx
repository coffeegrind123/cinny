import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
} from 'folds';
import { FocusTrap } from 'focus-trap-react';

import { useDebounce } from '../../hooks/useDebounce';
import { stopPropagation } from '../../utils/keyboard';
import { usePublicServers } from '../../hooks/usePublicServers';
import { useClientConfig } from '../../hooks/useClientConfig';
import { ServerBrowser } from '../../components/ServerBrowser';

// Suggestions shown under the input while typing. The directory holds ~1150
// servers; a dropdown listing all of them is not a picker, it is a wall.
const MAX_SUGGESTIONS = 8;

/**
 * Homeserver input with inline completion.
 *
 * Typing "tchn" fills the field with "tchncs.de" and selects the "cs.de" the
 * user did not type, exactly as a browser address bar does. Carrying on typing
 * overwrites the selection, so the completion never fights the user — and
 * Backspace/Delete suppress it, otherwise deleting a character would instantly
 * re-add it and the field could not be cleared.
 */
export function ServerPicker({
  server,
  serverList,
  allowCustomServer,
  onServerChange,
}: {
  server: string;
  serverList: string[];
  allowCustomServer?: boolean;
  onServerChange: (server: string) => void;
}) {
  const [serverMenuAnchor, setServerMenuAnchor] = useState<RectCords>();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const serverInputRef = useRef<HTMLInputElement>(null);
  // Set on the keydown that precedes an input event, so the change handler can
  // tell a deletion from an insertion before it decides to complete.
  const deletingRef = useRef(false);

  const { publicServersUrl } = useClientConfig();
  const { data } = usePublicServers(publicServersUrl);

  useEffect(() => {
    // sync input with it outside server changes
    if (serverInputRef.current && serverInputRef.current.value !== server) {
      serverInputRef.current.value = server;
    }
  }, [server]);

  const debounceServerSelect = useDebounce(onServerChange, { wait: 700 });

  // Config list first — those are the operator's own picks — then the live
  // directory, best-known first.
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (name: string) => {
      const n = name.trim().toLowerCase();
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    };
    serverList.forEach(add);
    if (data) {
      data.servers.forEach((s) => {
        if (s.registration.open) add(s.name);
      });
    }
    return out;
  }, [serverList, data]);

  const suggestions = useMemo(() => {
    const q = typed.trim().toLowerCase();
    if (!q) return serverList.slice(0, MAX_SUGGESTIONS);
    // Prefix matches are what the inline completion is based on, so show them
    // first; substring matches follow for the "I know it has 'chat' in it" case.
    const prefix: string[] = [];
    const contains: string[] = [];
    for (const name of candidates) {
      if (name.startsWith(q)) prefix.push(name);
      else if (name.includes(q)) contains.push(name);
      if (prefix.length >= MAX_SUGGESTIONS) break;
    }
    return [...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [typed, candidates, serverList]);

  const bestCompletion = useCallback(
    (value: string): string | undefined => {
      const q = value.trim().toLowerCase();
      if (q.length < 2) return undefined;
      return candidates.find((name) => name.startsWith(q) && name !== q);
    },
    [candidates],
  );

  const handleKeyDownCapture: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    deletingRef.current = evt.key === 'Backspace' || evt.key === 'Delete';
  };

  const handleServerChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const input = evt.target;
    const raw = input.value;
    setTyped(raw);
    setActiveIndex(-1);
    setSuggestOpen(raw.trim().length > 0);

    const inputServer = raw.trim();
    if (!inputServer) return;

    // Inline completion: only when adding text at the very end of the field.
    // Completing mid-edit (or while deleting) would fight the caret.
    const atEnd = input.selectionStart === raw.length && input.selectionEnd === raw.length;
    if (!deletingRef.current && atEnd) {
      const completion = bestCompletion(inputServer);
      if (completion) {
        input.value = completion;
        input.setSelectionRange(inputServer.length, completion.length);
        // Discovery runs against what the user actually typed, not the
        // speculative completion — otherwise a stray keystroke would send us
        // off connecting to someone else's server.
        debounceServerSelect(inputServer);
        return;
      }
    }
    debounceServerSelect(inputServer);
  };

  const commit = (value: string) => {
    const next = value.trim();
    if (!next) return;
    if (serverInputRef.current) serverInputRef.current.value = next;
    setTyped(next);
    setSuggestOpen(false);
    setActiveIndex(-1);
    onServerChange(next);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      if (suggestions.length > 0) {
        setSuggestOpen(true);
        setActiveIndex((i) => (i + 1) % suggestions.length);
      }
      return;
    }
    if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      if (suggestions.length > 0) {
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      }
      return;
    }
    if (evt.key === 'Escape' && suggestOpen) {
      evt.preventDefault();
      setSuggestOpen(false);
      return;
    }
    // Accept the greyed-out completion without submitting.
    if ((evt.key === 'Tab' || evt.key === 'ArrowRight') && evt.currentTarget.selectionStart !== evt.currentTarget.selectionEnd) {
      const { value } = evt.currentTarget;
      if (evt.key === 'Tab') evt.preventDefault();
      evt.currentTarget.setSelectionRange(value.length, value.length);
      setTyped(value);
      return;
    }
    if (evt.key === 'Enter') {
      evt.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : evt.currentTarget.value;
      commit(picked);
    }
  };

  const handleServerSelect: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const selectedServer = evt.currentTarget.getAttribute('data-server');
    if (selectedServer) commit(selectedServer);
    setServerMenuAnchor(undefined);
  };

  const handleOpenServerMenu: MouseEventHandler<HTMLElement> = (evt) => {
    const target = evt.currentTarget.parentElement ?? evt.currentTarget;
    setServerMenuAnchor(target.getBoundingClientRect());
  };

  const showSuggestions = allowCustomServer && suggestOpen && suggestions.length > 0;

  return (
    <>
      {browserOpen && (
        <ServerBrowser requestClose={() => setBrowserOpen(false)} onSelect={commit} />
      )}
      <PopOut
        anchor={showSuggestions ? serverMenuAnchor ?? undefined : undefined}
        position="Bottom"
        align="Start"
        offset={4}
        content={
          showSuggestions ? (
            <Menu style={{ minWidth: 'var(--popout-anchor-width, 16rem)' }}>
              <div style={{ padding: config.space.S100 }}>
                {suggestions.map((name, index) => (
                  <MenuItem
                    key={name}
                    radii="300"
                    size="300"
                    variant={index === activeIndex ? 'Primary' : 'Surface'}
                    aria-pressed={name === server}
                    data-server={name}
                    onClick={handleServerSelect}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <Text size="T300" truncate>
                      {name}
                    </Text>
                  </MenuItem>
                ))}
              </div>
            </Menu>
          ) : null
        }
      >
        <Input
          ref={serverInputRef}
          style={{ paddingRight: config.space.S200 }}
          variant={allowCustomServer ? 'Background' : 'Surface'}
          outlined
          defaultValue={server}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={handleServerChange}
          onKeyDownCapture={handleKeyDownCapture}
          onKeyDown={handleKeyDown}
          onFocus={(evt) => {
            setServerMenuAnchor(evt.currentTarget.getBoundingClientRect());
          }}
          onBlur={() => {
            // Delayed so a click on a suggestion lands before the menu closes.
            setTimeout(() => setSuggestOpen(false), 150);
          }}
          size="500"
          readOnly={!allowCustomServer}
          onClick={allowCustomServer ? undefined : handleOpenServerMenu}
          after={
            <>
              {allowCustomServer && (
                <IconButton
                  onClick={() => setBrowserOpen(true)}
                  variant="Background"
                  size="300"
                  radii="300"
                  title="Browse all public servers"
                  aria-label="Browse all public servers"
                >
                  <Icon src={Icons.Search} />
                </IconButton>
              )}
              {serverList.length === 0 ||
              (serverList.length === 1 && !allowCustomServer) ? undefined : (
                <PopOut
                  anchor={serverMenuAnchor && !showSuggestions ? serverMenuAnchor : undefined}
                  position="Bottom"
                  align="End"
                  offset={4}
                  content={
                    <FocusTrap
                      focusTrapOptions={{
                        initialFocus: false,
                        onDeactivate: () => setServerMenuAnchor(undefined),
                        clickOutsideDeactivates: true,
                        isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                        isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                        escapeDeactivates: stopPropagation,
                      }}
                    >
                      <Menu>
                        <Header size="300" style={{ padding: `0 ${config.space.S200}` }}>
                          <Text size="L400">Homeserver List</Text>
                        </Header>
                        <div style={{ padding: config.space.S100, paddingTop: 0 }}>
                          {serverList?.map((serverName) => (
                            <MenuItem
                              key={serverName}
                              radii="300"
                              aria-pressed={serverName === server}
                              data-server={serverName}
                              onClick={handleServerSelect}
                            >
                              <Text>{serverName}</Text>
                            </MenuItem>
                          ))}
                        </div>
                      </Menu>
                    </FocusTrap>
                  }
                >
                  <IconButton
                    onClick={handleOpenServerMenu}
                    variant={allowCustomServer ? 'Background' : 'Surface'}
                    size="300"
                    aria-pressed={!!serverMenuAnchor}
                    radii="300"
                  >
                    <Icon src={Icons.ChevronBottom} />
                  </IconButton>
                </PopOut>
              )}
            </>
          }
        />
      </PopOut>
    </>
  );
}
