import React, {
  KeyboardEventHandler,
  MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
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
import FocusTrap from 'focus-trap-react';

import { stopPropagation } from '../../utils/keyboard';

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
  const serverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (serverInputRef.current && serverInputRef.current.value !== server) {
      serverInputRef.current.value = server;
    }
  }, [server]);

  const handleConnect = () => {
    const inputServer = serverInputRef.current?.value.trim();
    if (inputServer) onServerChange(inputServer);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      setServerMenuAnchor(undefined);
    }
    if (evt.key === 'Enter') {
      evt.preventDefault();
      handleConnect();
    }
  };

  const handleServerSelect: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const selectedServer = evt.currentTarget.getAttribute('data-server');
    if (selectedServer) {
      onServerChange(selectedServer);
    }
    setServerMenuAnchor(undefined);
  };

  const handleOpenServerMenu: MouseEventHandler<HTMLElement> = (evt) => {
    const target = evt.currentTarget.parentElement ?? evt.currentTarget;
    setServerMenuAnchor(target.getBoundingClientRect());
  };

  const showDropdown = serverList.length > 0 && !(serverList.length === 1 && !allowCustomServer);

  return (
    <Box grow="Yes" gap="0" alignItems="Stretch">
      <Input
        ref={serverInputRef}
        style={{
          flexGrow: 1,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          paddingRight: config.space.S200,
        }}
        variant={allowCustomServer ? 'Background' : 'Surface'}
        outlined
        defaultValue={server}
        onKeyDown={handleKeyDown}
        size="500"
        readOnly={!allowCustomServer}
        onClick={allowCustomServer ? undefined : handleOpenServerMenu}
        after={
          showDropdown && (
            <PopOut
              anchor={serverMenuAnchor}
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
          )
        }
      />
      {allowCustomServer && (
        <Button
          style={{
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            flexShrink: 0,
          }}
          size="500"
          variant="Primary"
          fill="Solid"
          outlined
          radii="300"
          onClick={handleConnect}
          before={<Icon size="100" src={Icons.ArrowRight} />}
        >
          <Text size="B300">Connect</Text>
        </Button>
      )}
    </Box>
  );
}
