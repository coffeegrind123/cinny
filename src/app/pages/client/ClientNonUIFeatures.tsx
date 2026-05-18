import { useAtomValue } from 'jotai';
import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatrixEventEvent, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { roomToUnreadAtom, unreadEqual, unreadInfoToUnread } from '../../state/room/roomToUnread';
import LogoSVG from '../../../../public/res/svg/cinny.svg';
import LogoUnreadSVG from '../../../../public/res/svg/cinny-unread.svg';
import LogoHighlightSVG from '../../../../public/res/svg/cinny-highlight.svg';
import NotificationSound from '../../../../public/sound/notification.ogg';
import InviteSound from '../../../../public/sound/invite.ogg';
import { setFavicon } from '../../utils/dom';
import {
  isNotificationPermissionGrantedSync,
  sendDesktopNotification,
  onNotificationAction,
  isTauri,
  primeDesktopNotificationPermission,
} from '../../utils/desktop-notifications';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { usePreviousValue } from '../../hooks/usePreviousValue';
import { useSystemTray } from '../../hooks/useSystemTray';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getInboxInvitesPath, getInboxNotificationsPath, getHomeRoomPath } from '../pathUtils';
import {
  getMemberDisplayName,
  getNotificationType,
  getUnreadInfo,
  isNotificationEvent,
} from '../../utils/room';
import { NotificationType, UnreadInfo } from '../../../types/matrix/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useInboxNotificationsSelected } from '../../hooks/router/useInbox';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { GlobalKeybinds } from '../../components/global-keybinds/GlobalKeybinds';

function SystemEmojiFeature() {
  const [twitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');

  if (twitterEmoji) {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji');
  } else {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji_DISABLED');
  }

  return null;
}

function PageZoomFeature() {
  const [pageZoom] = useSetting(settingsAtom, 'pageZoom');

  if (pageZoom === 100) {
    document.documentElement.style.removeProperty('font-size');
  } else {
    document.documentElement.style.setProperty('font-size', `calc(1em * ${pageZoom / 100})`);
  }

  return null;
}

function SystemTray() {
  useSystemTray();
  return null;
}

function FaviconUpdater() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    let notification = false;
    let highlight = false;
    roomToUnread.forEach((unread) => {
      if (unread.total > 0) {
        notification = true;
      }
      if (unread.highlight > 0) {
        highlight = true;
      }
    });

    if (notification) {
      setFavicon(highlight ? LogoHighlightSVG : LogoUnreadSVG);
    } else {
      setFavicon(LogoSVG);
    }
  }, [roomToUnread]);

  return null;
}

function TaskbarBadgeUpdater() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    if (!isTauri()) return;

    let totalUnread = 0;
    roomToUnread.forEach((unread) => {
      totalUnread += unread.total;
    });

    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_badge_count', { count: totalUnread }).catch(() => {});
    });
  }, [roomToUnread]);

  return null;
}

function InviteNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invites = useAtomValue(allInvitesAtom);
  const perviousInviteLen = usePreviousValue(invites.length, 0);
  const mx = useMatrixClient();

  const navigate = useNavigate();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');

  const notify = useCallback(
    (count: number) => {
      if (isTauri()) {
        sendDesktopNotification('Invitation', {
          icon: LogoSVG,
          body: `You have ${count} new invitation request.`,
        });
      }

      // Flash taskbar on Windows
      if (isTauri()) {
        getCurrentWindow().requestUserAttention(UserAttentionType.Informational).catch(() => {});
      }

      // Browser fallback with click handler
      if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window) && 'Notification' in window) {
        const noti = new window.Notification('Invitation', {
          icon: LogoSVG,
          badge: LogoSVG,
          body: `You have ${count} new invitation request.`,
          silent: true,
        });
        noti.onclick = () => {
          if (!window.closed) navigate(getInboxInvitesPath());
          noti.close();
        };
      }
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (invites.length > perviousInviteLen && mx.getSyncState() === 'SYNCING') {
      if (showNotifications && isNotificationPermissionGrantedSync()) {
        notify(invites.length - perviousInviteLen);
      }

      if (notificationSound) {
        playSound();
      }
    }
  }, [mx, invites, perviousInviteLen, showNotifications, notificationSound, notify, playSound]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={InviteSound} type="audio/ogg" />
    </audio>
  );
}

function MessageNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<Notification>();
  const unreadCacheRef = useRef<Map<string, UnreadInfo>>(new Map());
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');

  const navigate = useNavigate();
  const notificationSelected = useInboxNotificationsSelected();
  const selectedRoomId = useSelectedRoom();

  const notify = useCallback(
    ({
      senderName,
      roomAvatar,
      notificationBody,
      roomId,
      eventId,
    }: {
      senderName: string;
      roomAvatar?: string;
      notificationBody: string;
      roomId: string;
      eventId: string;
    }) => {
      // Authenticated media (Matrix 1.11+ / MSC3916) requires a Bearer
      // token. The Rust icon cacher fetches the bytes server-side, so
      // forward the access token when the room avatar URL points at the
      // authenticated download endpoint.
      const accessToken = mx.getAccessToken();
      const iconAuthHeader =
        useAuthentication && accessToken ? `Bearer ${accessToken}` : undefined;

      // sendDesktopNotification's own browser fallback fires a *second*
      // toast with no click handler, which doubles up notifications on
      // web. Only call it in Tauri; the explicit browser fallback below
      // owns the web path and adds the navigate-on-click behaviour.
      if (isTauri()) {
        sendDesktopNotification(senderName, {
          icon: roomAvatar,
          iconAuthHeader,
          body: notificationBody,
          roomId,
          eventId,
        });
      }

      // Browser fallback with click handler
      if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window) && 'Notification' in window) {
        notifRef.current?.close();
        const noti = new window.Notification(senderName, {
          icon: roomAvatar,
          badge: roomAvatar,
          body: notificationBody,
          silent: true,
        });
        noti.onclick = () => {
          if (!window.closed) navigate(getInboxNotificationsPath());
          noti.close();
          notifRef.current = undefined;
        };
        notifRef.current = noti;
      }
    },
    [navigate, mx, useAuthentication]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    const sendNotif = (mEvent: any, room: any) => {
      if (!showNotifications || !isNotificationPermissionGrantedSync()) return;
      const sender = mEvent.getSender();
      const eventId = mEvent.getId();
      if (!sender || !eventId || sender === mx.getUserId()) return;

      const unreadInfo = getUnreadInfo(room);
      const cachedUnreadInfo = unreadCacheRef.current.get(room.roomId);
      unreadCacheRef.current.set(room.roomId, unreadInfo);
      if (unreadInfo.total === 0) return;
      if (
        cachedUnreadInfo &&
        unreadEqual(unreadInfoToUnread(cachedUnreadInfo), unreadInfoToUnread(unreadInfo))
      ) {
        return;
      }

      const senderMember = room.getMember(sender);
      const avatarMxc = senderMember?.getMxcAvatarUrl()
        ?? room.getAvatarFallbackMember()?.getMxcAvatarUrl()
        ?? room.getMxcAvatarUrl();
      const username = getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender;
      const content = (mEvent as any).content ?? mEvent.getContent();
      const msgtype: string | undefined = content?.msgtype;
      let rawBody: string = typeof content?.body === 'string' ? content.body : '';
      if (!rawBody && content?.['m.new_content']?.body) {
        rawBody = content['m.new_content'].body;
      }

      // Title is sender name (like Discord), body is just the message
      let notificationBody: string;
      if (!rawBody && !msgtype) {
        notificationBody = 'New message';
      } else if (msgtype === 'm.image') {
        notificationBody = rawBody ? `📷 ${rawBody}` : 'Sent an image';
      } else if (msgtype === 'm.video') {
        notificationBody = rawBody ? `🎬 ${rawBody}` : 'Sent a video';
      } else if (msgtype === 'm.audio') {
        notificationBody = rawBody ? `🎵 ${rawBody}` : 'Sent an audio clip';
      } else if (msgtype === 'm.file') {
        notificationBody = rawBody ? `📎 ${rawBody}` : 'Sent a file';
      } else {
        notificationBody = rawBody || 'New message';
      }

      notify({
        senderName: username,
        roomAvatar: avatarMxc
          ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
          : undefined,
        notificationBody,
        roomId: room.roomId,
        eventId,
      });

      // Flash taskbar on Windows
      if (isTauri()) {
        getCurrentWindow().requestUserAttention(UserAttentionType.Informational).catch(() => {});
      }
    };

    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (mx.getSyncState() !== 'SYNCING') return;
      if (document.hasFocus() && (selectedRoomId === room?.roomId || notificationSelected)) return;
      if (
        !room ||
        !data.liveEvent ||
        room.isSpaceRoom() ||
        !isNotificationEvent(mEvent) ||
        getNotificationType(mx, room.roomId) === NotificationType.Mute
      ) {
        return;
      }
      if (mEvent.getSender() === mx.getUserId()) return;

      // For encrypted messages, the Timeline event fires before decryption
      // completes. Wait for the Decrypted event to get the real content.
      if ((mEvent as any).isEncrypted?.()) {
        const onDecrypted = () => {
          mEvent.off?.(MatrixEventEvent.Decrypted, onDecrypted);
          sendNotif(mEvent, room);
          if (notificationSound) playSound();
        };
        mEvent.on?.(MatrixEventEvent.Decrypted, onDecrypted);
        return;
      }

      sendNotif(mEvent, room);
      if (notificationSound) playSound();
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [
    mx,
    notificationSound,
    notificationSelected,
    showNotifications,
    playSound,
    notify,
    selectedRoomId,
    useAuthentication,
  ]);

  // Prime the Tauri-desktop notification permission cache. The plugin's
  // init-iife.js short-circuits Windows to `denied` without ever asking
  // Rust, so the Settings UI surfaces the Enable button on every fresh
  // launch even though Rust's permission_state is hardcoded to Granted.
  useEffect(() => {
    primeDesktopNotificationPermission();
  }, []);

  // Handle notification clicks: bring window to foreground and navigate to room
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onNotificationAction(({ roomId, eventId }) => {
      if (roomId) {
        navigate(getHomeRoomPath(roomId, eventId));
      }
      getCurrentWindow().setFocus().catch(() => {});
      getCurrentWindow().show().catch(() => {});
      getCurrentWindow().unminimize().catch(() => {});
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [navigate]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={NotificationSound} type="audio/ogg" />
    </audio>
  );
}

type ClientNonUIFeaturesProps = {
  children: ReactNode;
};

export function ClientNonUIFeatures({ children }: ClientNonUIFeaturesProps) {
  return (
    <>
      <SystemEmojiFeature />
      <PageZoomFeature />
      <FaviconUpdater />
      <TaskbarBadgeUpdater />
      <SystemTray />
      <InviteNotifications />
      <MessageNotifications />
      <GlobalKeybinds />
      {children}
    </>
  );
}
