import { Icon, Icons, MenuItem, Text } from 'folds';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom, Settings } from '../../../state/settings';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { markAsRead } from '../../../utils/notifications';

type UnreadOnlyMenuItemProps = {
  /** Which of the two unread filters this item drives. */
  setting: Extract<keyof Settings, 'unreadRoomsOnly' | 'unreadDirectsOnly'>;
  children: string;
};

/**
 * The unread filter, as a menu item. It reads as one control per list because
 * a merged Home shows two of them, and "Show unread only" twice over would say
 * nothing about which list each one meant.
 */
export function UnreadOnlyMenuItem({ setting, children }: UnreadOnlyMenuItemProps) {
  const [unreadOnly, setUnreadOnly] = useSetting(settingsAtom, setting);

  return (
    <MenuItem
      onClick={() => setUnreadOnly((v) => !v)}
      size="300"
      after={unreadOnly ? <Icon size="100" src={Icons.Check} /> : undefined}
      radii="300"
    >
      <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
        {children}
      </Text>
    </MenuItem>
  );
}

type MarkAsReadMenuItemProps = {
  rooms: string[];
  requestClose: () => void;
};

/** Marks every room the surrounding nav lists as read. */
export function MarkAsReadMenuItem({ rooms, requestClose }: MarkAsReadMenuItemProps) {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomsUnread(rooms, roomToUnreadAtom);

  const handleMarkAsRead = () => {
    if (!unread) return;
    rooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  return (
    <MenuItem
      onClick={handleMarkAsRead}
      size="300"
      after={<Icon size="100" src={Icons.CheckTwice} />}
      radii="300"
      aria-disabled={!unread}
    >
      <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
        Mark as Read
      </Text>
    </MenuItem>
  );
}
