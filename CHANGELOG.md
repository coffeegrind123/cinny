# Changelog

User-facing changes per commit. Most recent at the top.

## 18.05.2026

- `9c481ba` Improved mobile layout — nav pane (Home / Direct / Search / Inbox indices) now stretches to the full viewport on mobile via inline `width: 100%` override on `PageNav` so the changelog-side empty-state doesn't leave whitespace.
- `9c481ba` Improved mobile settings modal — fills viewport (`100vw` × `100dvh`), square corners, safe-area-inset padding so notch/home-bar don't obscure controls. Keybinds tab hidden on mobile (physical-keyboard only).
- `9c481ba` Fixed `body { height: 100% }` keyboard breakage — switched to `100dvh` with `100%` fallback so the on-screen keyboard pushes the layout up instead of leaving inputs hidden behind it.
- `9c481ba` Fixed gallery tap-out reopening viewer — overlay's `onDeactivate` now plants a transparent full-screen blocker for 350ms that swallows the next pointerdown/click, preventing the tap from bubbling through to the underlying message image.
- `9c481ba` Mobile image viewer: tap-to-zoom replaced with pinch-to-zoom — two-finger gesture tracks distance ratio from initial pinch and scales accordingly (bounds 0.1×–5× matching the +/- buttons). Single-tap zoom kept on desktop where double-firing isn't an issue.
- `47f158f` Followed up on draft-release fix — passed `draft: true` to all softprops/action-gh-release uploads (was defaulting to false and flipping the release to published on the first upload, defeating the whole point of staging as a draft); dropped the versioned `prinny-webapp-vX.Y.Z.zip` variant since the release tag already versions it and every other platform asset is single-named.
- `ec98378` Fixed release-pipeline window where `/latest/download/*.apk` 404'd during Android cross-compile — releases now stay drafts until every platform build (windows + linux + macos + android + webapp-zip + archive) has uploaded its artifacts, then publish atomically. Old versioned releases are deleted after publish, not before, so the previous tag stays "latest" until the new one is fully assembled.
- `2b24087` Added README download link for the web client zip — `prinny-webapp.zip` is now uploaded with a stable filename alongside the versioned one so `releases/latest/download/prinny-webapp.zip` resolves.
- `d047dd6` Added platform notification for update banner — `useUpdateCheck` fires `sendDesktopNotification` the first time each new version becomes available; deduped per-version so a dismissed banner doesn't re-notify on repeat polls. Android Tauri skipped (UpdateChecker.kt's own DownloadManager notification covers it).
- `09cc5ee` Added web client dist zip to GitHub releases — new `webapp-zip` job in prinny-client's `build.yml` attaches `prinny-webapp-vX.Y.Z.zip` (rebrand + `npm run build` output) to every release for self-hosters who'd rather download than `git pull`.
- `6932b32` Replaced welcome splash with bundled changelog viewer — empty-state screen now reads `cinny/CHANGELOG.md` baked in at build time (Vite `?raw` import) and renders the latest dated bullets, links each SHA to the cinny commit page.
- `0a803b4` Added Web Push for background notifications — service worker `push`/`notificationclick` handlers, Matrix HTTP pusher with VAPID public key from `config.json`. Falls back to foreground `window.Notification` when no gateway configured. Also flipped `usePiped` default to `false` so YouTube links resolve through youtube.com unless opted in.
- `5abc142` Fixed Slate "Cannot resolve a DOM node" crash on message edit with emoji — new `safeFocusEditor` wrapper falls back to deselect + DOM focus when the selection is stale after autocomplete close.
- `2afe5a1` Fixed Ctrl+/ keybinds modal silently closing itself — two window listeners cancelled each other in one tick; removed the duplicate so the toggle actually fires.
- `2afe5a1` Fixed soundcloak embeds spamming 502s — skip homeserver `preview_url` for direct-audio URLs since it rejects `audio/mpeg`.
- `2afe5a1` Fixed fullscreen button greyed out on YouTube iframe — `allow="fullscreen"` was overridden by the rest of the permissions policy.
- `2afe5a1` Improved composer layout — attachment button moves to left of editor, send to the right (Discord-style).
- `2afe5a1` Improved mobile gallery — title bar relocates to the bottom on mobile, both rows span full viewport width.
- `2afe5a1` Improved mobile swipe gestures — follows the finger via transform with a 180ms ease-out settle on release; right-edge forward-swipe now returns to the last-visited DM.
- `2afe5a1` Fixed double notifications on web — `sendDesktopNotification` was firing alongside an explicit `new Notification` with click handler.
- `1180ddb` Added auto-bump-cinny workflow — reactive `repository_dispatch` from cinny's publish-webapp keeps prinny-client's submodule pointer current within ~30s of every cinny push.
- `0a803b4` Added Web self-host download row to README — `git clone -b webapp-release https://github.com/coffeegrind123/cinny.git /usr/share/webapps/prinny` for self-hosters.
- `4461ea0` Fixed Android updater re-downloading APK on every launch — `tauri.properties` was missing so `versionName` defaulted to `"1.0"`; `bump-version.mjs` now writes it explicitly with both versionName + versionCode.

## 17.05.2026

- `15a60e9` Added webapp-release publish workflow — built dist auto-publishes to the `webapp-release` branch of `coffeegrind123/cinny` on every push to `desktop-notifications`. Self-hosters install with `git clone` + `git pull`, no `npm` at deploy time.
- `8a50134` Fixed standalone webapp build — version imports in `AuthFooter.tsx` and `WelcomePage.tsx` were going 5 directories up (which only resolves when cinny is nested under prinny-client). Switched to 4-up so both build contexts work.

[End of changelog. Earlier history lives in git log.]
