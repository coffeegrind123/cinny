import {
  DEFAULT_NOTIFICATION_CONTENT_MODE,
  NotificationContentMode,
} from '../utils/desktop-notifications';
import { atom } from 'jotai';

const STORAGE_KEY = 'settings';
export type DateFormat =
  | 'D MMM YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'YYYY-MM-DD'
  | '';
export type MessageSpacing = '0' | '100' | '200' | '300' | '400' | '500';
export enum MessageLayout {
  Modern = 0,
  Compact = 1,
  Bubble = 2,
}

export interface Settings {
  themeId?: string;
  useSystemTheme: boolean;
  lightThemeId?: string;
  darkThemeId?: string;
  monochromeMode?: boolean;
  isMarkdown: boolean;
  editorToolbar: boolean;
  twitterEmoji: boolean;
  pageZoom: number;
  hideActivity: boolean;

  minimizeToTray: boolean;

  unreadDirectsOnly: boolean;

  isPeopleDrawer: boolean;
  memberSortFilterIndex: number;
  enterForNewline: boolean;
  scrollOnSend: boolean;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
  mediaAutoLoad: boolean;
  urlPreview: boolean;
  encUrlPreview: boolean;
  showHiddenEvents: boolean;
  legacyUsernameColor: boolean;

  showNotifications: boolean;
  isNotificationSounds: boolean;

  hour24Clock: boolean;
  dateFormatString: string;

  developerTools: boolean;
  keybinds: Record<string, string>;
  readReceiptStyle: 'cinny' | 'element';
  useVxTwitter: boolean;
  useSoundcloak: boolean;
  useBlueskyEmbeds: boolean;
  // How much of a message is shown in OS notifications. Decrypted end-to-end
  // encrypted content otherwise crosses into the platform notification store,
  // where other software on the device can read it. Defaults to 'full' so
  // existing installs are unchanged; 'sender-only' and 'hidden' are opt-in.
  notificationContentMode: NotificationContentMode;
  usePiped: boolean;
  clientPreviewFallback: boolean;
}

const defaultSettings: Settings = {
  themeId: undefined,
  useSystemTheme: true,
  lightThemeId: undefined,
  darkThemeId: undefined,
  monochromeMode: false,
  isMarkdown: true,
  editorToolbar: false,
  twitterEmoji: true,
  pageZoom: 100,
  hideActivity: false,

  minimizeToTray: true,

  unreadDirectsOnly: false,

  isPeopleDrawer: true,
  memberSortFilterIndex: 0,
  enterForNewline: false,
  scrollOnSend: true,
  messageLayout: 0,
  messageSpacing: '400',
  hideMembershipEvents: false,
  hideNickAvatarEvents: true,
  mediaAutoLoad: true,
  urlPreview: true,
  // Off by default: generating a preview for a URL inside an end-to-end
  // encrypted message means handing the homeserver a URL it could not
  // otherwise read out of the ciphertext. Opt-in only.
  encUrlPreview: false,
  showHiddenEvents: false,
  legacyUsernameColor: false,

  showNotifications: true,
  isNotificationSounds: true,

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,
  keybinds: {},
  readReceiptStyle: 'cinny',
  // These third-party front-end integrations make the client fetch, unprompted,
  // from a host chosen by whoever sent the message — which discloses the
  // viewer's IP to that host and turns "did you open the room yet?" into a
  // signal the sender can observe.
  //
  // vxtwitter and Bluesky are on by default as a deliberate product decision:
  // they are the embeds users expect to just work, and the settings tiles state
  // the disclosure plainly so it can be turned off. soundcloak stays opt-in.
  useVxTwitter: true,
  useSoundcloak: false,
  useBlueskyEmbeds: true,
  notificationContentMode: DEFAULT_NOTIFICATION_CONTENT_MODE,
  usePiped: false,
  // Same reasoning: the client-side OG fallback fetches an arbitrary
  // message-supplied URL straight from the user's own machine.
  clientPreviewFallback: false,
};

export const getSettings = (): Settings => {
  const settings = localStorage.getItem(STORAGE_KEY);
  if (settings === null) return defaultSettings;
  // A malformed or non-object persisted blob used to throw here. This runs at
  // module evaluation time, so the throw escaped before any error boundary
  // existed and bricked the client until localStorage was cleared by hand.
  // Anything we can't understand falls back to the defaults instead.
  try {
    const parsed: unknown = JSON.parse(settings);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return defaultSettings;
    }
    return {
      ...defaultSettings,
      ...(parsed as Partial<Settings>),
    };
  } catch {
    return defaultSettings;
  }
};

export const setSettings = (settings: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const baseSettings = atom<Settings>(getSettings());
export const settingsAtom = atom<Settings, [Settings], undefined>(
  (get) => get(baseSettings),
  (get, set, update) => {
    set(baseSettings, update);
    setSettings(update);
  }
);
