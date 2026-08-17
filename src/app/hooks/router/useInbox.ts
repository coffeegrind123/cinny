import { useMatch } from 'react-router-dom';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  getInboxAllPath,
  getInboxInvitesPath,
  getInboxNotificationsPath,
  getInboxPath,
} from '../../pages/pathUtils';

/**
 * The path the Inbox opens on, from the `defaultInboxTab` setting.
 *
 * One resolver, because there are two ways into the Inbox — the sidebar button
 * and the `/inbox/` index route — and they disagreed. The index route was
 * changed to All while the sidebar button kept its own fallback chain, so the
 * setting appeared to do nothing depending on which one you used.
 */
export const useDefaultInboxPath = (): string => {
  const [defaultInboxTab] = useSetting(settingsAtom, 'defaultInboxTab');

  if (defaultInboxTab === 'notifications') return getInboxNotificationsPath();
  if (defaultInboxTab === 'invites') return getInboxInvitesPath();
  return getInboxAllPath();
};

export const useInboxSelected = (): boolean => {
  const match = useMatch({
    path: getInboxPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useInboxNotificationsSelected = (): boolean => {
  const match = useMatch({
    path: getInboxNotificationsPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useInboxAllSelected = (): boolean => {
  const match = useMatch({
    path: getInboxAllPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useInboxInvitesSelected = (): boolean => {
  const match = useMatch({
    path: getInboxInvitesPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};
