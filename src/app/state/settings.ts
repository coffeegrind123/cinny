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
  unreadRoomsOnly: boolean;

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
  // Widths of the draggable layout columns, keyed by pane id and measured in
  // the same design pixels every other width in this app uses (`toRem`'s
  // input, i.e. 1/16rem units) so a stored width means the same thing at any
  // page zoom. A record rather than one field per pane: panes come and go, and
  // an unknown key is simply ignored while a missing one falls back to that
  // pane's default. Clamping lives in `useResizablePane`, not here, so a hand
  // -edited or stale value can never wedge a column off-screen.
  paneSizes: Record<string, number>;
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
  // Which Piped instance to embed from. '' means auto — pick the first reachable
  // one from the curated list (see utils/piped.ts). A specific origin pins it.
  pipedInstance: string;
  clientPreviewFallback: boolean;
  // Renders LaTeX sent as MSC2191 `data-mx-maths`. Off by default: it is a
  // niche need, and leaving it off means messages show the sender's plain-text
  // fallback instead of running a formula engine over their input.
  renderMaths: boolean;
  // Draws location messages as a map instead of a link. Off by default: every
  // map drawn fetches tiles from whoever serves the style, disclosing an IP and
  // a viewport, and doing that unprompted for a message someone else sent is
  // the same trade the other embed toggles below guard against.
  showMaps: boolean;
  // Microphone selection and processing, shared by voice messages and calls.
  // An empty device id means "whatever the system considers default", which is
  // what most people want and what survives plugging a headset in and out.
  // Asks the OS to exclude the window from screenshots and screen recordings.
  // Honoured on Windows and macOS; on most Linux desktops it does nothing, so
  // the settings tile says so rather than implying a guarantee.
  contentProtection: boolean;
  audioInputId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  // Telegram Bot API token, used only to import sticker packs from
  // t.me/addstickers links. Telegram serves sticker sets nowhere else — the
  // link itself carries no sticker data — and the Bot API returns 401 without
  // a token. Empty string means the import UI stays hidden.
  telegramBotToken: string;
  // Draws `app.prinny.bot.reply_markup` keyboards from bot messages as real
  // buttons. On by default — that is the feature — but it is a per-account off
  // switch because the buttons come from whoever sent the message, and someone
  // who does not want arbitrary room members rendering interactive controls in
  // their timeline should be able to say so. Off falls back to the message's
  // plain-text listing, which every bot sends anyway.
  renderBotKeyboards: boolean;
  // Confirm before opening a URL from a bot button, showing the real host.
  // On by default and there is no good reason to turn it off: the label on a
  // button says whatever its sender wants, and the host is the only part of it
  // the sender cannot lie about.
  confirmBotUrls: boolean;
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
  unreadRoomsOnly: false,

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
  // On by default (product decision, 2026-08-11). Worth stating plainly rather
  // than leaving implicit: asking for a preview of a URL inside an end-to-end
  // encrypted message sends that URL to the homeserver, which could not read it
  // out of the ciphertext otherwise. Link previews in encrypted rooms are what
  // people expect to just work, and the settings tile says what it costs, so
  // this defaults on and can be switched off there.
  encUrlPreview: true,
  showHiddenEvents: false,
  legacyUsernameColor: false,

  showNotifications: true,
  isNotificationSounds: true,

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,
  keybinds: {},
  paneSizes: {},
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
  pipedInstance: '',
  // Same reasoning: the client-side OG fallback fetches an arbitrary
  // message-supplied URL straight from the user's own machine.
  clientPreviewFallback: false,
  renderMaths: false,
  showMaps: false,
  contentProtection: false,
  audioInputId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  telegramBotToken: '',
  renderBotKeyboards: true,
  confirmBotUrls: true,
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
