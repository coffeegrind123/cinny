import { useEffect, useRef } from 'react';
import { isTauri } from '../utils/desktop-notifications';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

export function useSystemTray() {
  const [minimizeToTray] = useSetting(settingsAtom, 'minimizeToTray');
  const minimizeToTrayRef = useRef(minimizeToTray);
  minimizeToTrayRef.current = minimizeToTray;
  const createdRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || createdRef.current) return;
    createdRef.current = true;

    (async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu } = await import('@tauri-apps/api/menu');
      const { defaultWindowIcon } = await import('@tauri-apps/api/app');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      const window = getCurrentWindow();

      const menu = await Menu.new({
        items: [
          {
            id: 'show',
            text: 'Show',
            action: async () => {
              await window.show();
              await window.setFocus();
            },
          },
          {
            id: 'quit',
            text: 'Quit',
            action: async () => {
              const { exit } = await import('@tauri-apps/plugin-process');
              await exit(0);
            },
          },
        ],
      });

      await TrayIcon.new({
        icon: await defaultWindowIcon(),
        menu,
        menuOnLeftClick: false,
        tooltip: 'Prinny Client',
        action: (event: any) => {
          if (event.type === 'Click' && event.button === 'Left') {
            window.show();
            window.setFocus();
          }
        },
      });

      // Intercept close — hide to tray when setting is on
      window.onCloseRequested(async (event: any) => {
        if (minimizeToTrayRef.current) {
          await window.hide();
          event.preventDefault();
        }
      });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
