# Dependency Security Audit Report

**Date:** 2026-05-15
**Project:** cinny (Matrix client fork — coffeegrind123/cinny, branch `desktop-notifications`)
**Total dependencies:** 59 in `dependencies`, 30 in `devDependencies`
**node_modules:** 55MB, 506 packages

---

## 1. TRUSTED — Major org / massive adoption (32 packages)

| Package | Maintainer | Why trusted |
|---|---|---|
| **react** / **react-dom** | Meta | 127M+ DL, 1 dep |
| **@tanstack/react-query** / **devtools** / **virtual** | TanStack | Industry-standard data fetching |
| **@tauri-apps/plugin-notification** / **process** / **updater** | Tauri | Official Tauri v2 plugins |
| **react-router-dom** | Remix/Shopify | Industry-standard routing, 6.30.3 |
| **jotai** | Poimandres | 0 deps, lean state management |
| **immer** | Michel Weststrate | 0 deps, immutable state |
| **slate** / **slate-react** / **slate-dom** / **slate-history** | ianstormtaylor | Industry-standard rich text |
| **i18next** / **react-i18next** / **i18next-browser-languagedetector** / **i18next-http-backend** | i18next team | Industry-standard i18n |
| **matrix-js-sdk** | Matrix.org | Official SDK, 14 deps (heaviest) |
| **matrix-widget-api** | Matrix.org | Official widget API |
| **pdfjs-dist** | Mozilla | Official PDF.js, 0 deps |
| **prismjs** | PrismJS team | Syntax highlighting, 0 deps |
| **dayjs** | iamkun | Date library, 0 deps, massive adoption |
| **chroma-js** | gregorskii | Color manipulation, 0 deps |
| **linkifyjs** / **linkify-react** | nfrasser | Link detection, 0 deps |
| **sanitize-html** | apostrophecms | HTML sanitizer, 6 deps |
| **classnames** | JedWatson | 0 deps, tiny utility |
| **react-aria** | Adobe | Accessibility library, heavy but trusted |
| **@atlaskit/pragmatic-drag-and-drop** / **auto-scroll** / **hitbox** | Atlassian | DnD engine, 2-3 deps each |

---

## 2. KEEP — Complex enough not to rewrite (14 packages)

| Package | Deps | Rationale |
|---|---|---|
| **@vanilla-extract/css** | 11 | CSS-in-JS engine, zero-runtime. Complex build pipeline |
| **@vanilla-extract/recipes** | 0 | Sprinkles-style variant API |
| **@vanilla-extract/vite-plugin** | 4 | Vite integration |
| **folds** | 0 | Cinny's own UI component library. If rewritten, massive scope |
| **focus-trap-react** | 2 | Focus trapping with proper tab-cycle, nested trap support |
| **html-react-parser** | 4 | HTML→React conversion with proper DOM handling |
| **html-dom-parser** | 0 | Underlying DOM parser for html-react-parser |
| **domhandler** | 0 | htmlparser2 DOM handler |
| **emojibase** / **emojibase-data** | 0 | Unicode emoji database, auto-generated |
| **browser-encrypt-attachment** | 0 | Matrix E2EE attachment encryption |
| **ua-parser-js** | 0 | User-agent parsing, well-maintained |
| **blurhash** | 0 | Complex encoding/decoding algorithm |
| **tauri-plugin-mobile-push-api** | ? | Our own dependency (UnifiedPush for Android) |

---

## 3. INVESTIGATE — May be replaceable (13 packages)

| Package | Concern | Recommendation |
|---|---|---|
| **dateformat** | Last published 2020-03-18 (6+ years stale), 0 deps | Replace with dayjs (already in deps) — line-for-line format mapping |
| **millify** | Number formatting, 155 lines, 1 dep | Inline the formatting logic |
| **react-blurhash** | Thin Canvas wrapper around blurhash, 0 deps | 77 lines — inline into a local component |
| **react-colorful** | Color picker, 0 deps | Lightweight. Could vendor if maintenance lapses |
| **react-error-boundary** | 1 dep, thin React error boundary | 100 lines — inline as local component |
| **react-google-recaptcha** | 2 deps, thin wrapper | Check if recaptcha is still used. Remove if not |
| **react-range** | Slider component, 0 deps | Decent adoption. Keep unless maintenance lapses |
| **badwords-list** | Simple word list, prerelease version `2.0.1-4` | Inline the word list (static data) |
| **is-hotkey** | Tiny key-combo checker, 0 deps, ianstormtaylor | ~30 lines — inline if desired |
| **await-to-js** | 3 lines: `export function to(p) { return p.then(d => [null,d]).catch(e => [e]) }` | Inline — it's literally 3 lines |
| **@fontsource/inter** | Just the Inter font files, 0 deps | Self-host the font files |
| **file-saver** | File download shim, 0 deps | Web APIs now cover this. `URL.createObjectURL` + anchor click |
| **emojibase-data** | 15.3.2, 0 deps but 46 peer warns from emojibase 16.x | Bump emojibase to match data version |

---

## 4. ALERT — Version/pin mismatches (4 packages)

These have pinned versions in package.json that don't match `node_modules`:

| Package | Pinned | Actual | Status |
|---|---|---|---|
| **sanitize-html** | ^2.17.4 | 2.12.1 | **Run `npm install`** — cherry-picked the bump but lockfile is stale |
| **@types/sanitize-html** | ^2.16.1 | 2.9.0 | Behind — bump in package.json, lockfile stale |
| **matrix-widget-api** | ^1.16.1 | 1.13.0 | Behind — bump in package.json, lockfile stale |
| **@element-hq/element-call-embedded** | ^0.19.1 | 0.16.3 | Behind — bump in package.json, lockfile stale |

---

## 5. DEV DEPENDENCIES — No runtime risk (30 packages)

All `@types/*` packages + eslint/plugins + prettier + typescript + vite. No runtime supply chain risk.

**Staleness concerns in dev deps:**

| Package | Current | Notes |
|---|---|---|
| **typescript** | 4.9.4 | 2+ years old. TS 5.x stable for 2 years, TS 6.x released |
| **eslint** | 8.29.0 | eslint 9.x is flat config only (breaking). Stay on 8.x unless migrating |
| **@typescript-eslint/* ** | 5.46.1 | Matches TS 4.9. Bump with TS upgrade |
| **prettier** | 2.8.1 | Prettier 3.x available (breaking: trailingComma default change) |
| **vite** | 5.4.19 | Vite 6.x available. 5.4.x is LTS, fine to stay |
| **@vitejs/plugin-react** | 4.2.0 | Vite 6 needs plugin v5 |

---

## 6. TOP SUPPLY CHAIN RISKS (Priority order)

| # | Risk | Package | Action |
|---|---|---|---|
| 1 | 6+ years stale | dateformat | Replace with dayjs |
| 2 | Lockfile/pin mismatch | sanitize-html, matrix-widget-api, element-call | `npm install` to sync |
| 3 | Prerelease version | badwords-list (2.0.1-4) | Inline the word list |
| 4 | Functionally trivial | await-to-js (3 lines) | Inline |
| 5 | Medium dep tree (14) | matrix-js-sdk | Monitor — official Matrix.org package, hard to replace |
| 6 | Medium dep tree (11) | @vanilla-extract/css | Monitor — critical to build pipeline |
| 7 | Heavy ESLint tree (39 deps) | eslint | Dev-only. Acceptable |
| 8 | End-of-life dep | react 18, react-dom 18 | React 19 stable since Dec 2024. Upgrade path non-trivial (folds compat) |

---

## 7. VERSION PIN ANALYSIS

**Pin style:** Most packages use exact pins (`x.y.z`, no `^`/`~`). A few use caret (`^`).

### Caret-pinned packages (will auto-resolve on fresh install)

| Package | Pin | Notes |
|---|---|---|
| @tauri-apps/plugin-updater | ^2.10.1 | Will float within 2.x |
| @types/* | ^x.y.z | All dev, all float within major |

### Behind — exact pins (need manual bumps)

| Package | Pinned | Latest | Gap |
|---|---|---|---|
| react / react-dom | 18.2.0 | 19.2.0 | Major (breaking) |
| typescript | 4.9.4 | 5.9.3 / 6.0.2 | 2 major versions |
| dayjs | 1.11.10 | 1.11.13 | 3 patches |
| immer | 9.0.16 | 10.1.1 | Major (breaking) |
| jotai | 2.6.0 | 2.15.1 | 9 minor |
| slate* | 0.123.0 | 0.123.0 (latest) | Current |
| react-router-dom | 6.30.3 | 7.6.0 | Major (breaking, Remix merge) |
| prismjs | 1.30.0 | 1.30.0 | Current (last published 2024-12) |
| ua-parser-js | 1.0.35 | 2.0.6 | Major (breaking) |
| dateformat | 5.0.3 | 5.0.3 | **STALE — last published March 2020** |

---

## 8. ELIMINATION STATUS

| Package | Status | Notes |
|---|---|---|
| await-to-js | TODO | 3 lines — inline as `src/app/utils/await-to.ts` |
| dateformat | TODO | Replace with dayjs equivalents |
| badwords-list | TODO | Inline word list |
| millify | TODO | Inline ~150 lines |
| react-blurhash | TODO | Inline 77-line component |
| react-error-boundary | TODO | Inline ~100 lines |
| @fontsource/inter | KEEP | npm is fine for fonts; bundler tree-shakes unused weights |
| file-saver | KEEP | Edge case coverage (IE, Safari) still useful |
| is-hotkey | KEEP | Used heavily in editor, well-tested |
| react-colorful | KEEP | Lightweight, well-maintained, 0 deps |
| react-range | KEEP | Decent adoption, 0 deps |
| react-google-recaptcha | EVALUATE | Check if still used in production |
| sanitize-html | KEEP | Critical security boundary — DO NOT inline |
| matrix-js-sdk | KEEP | Official SDK — cannot replace |
| folds | KEEP | Cinny's own UI lib — too large to inline |
| @vanilla-extract/* | KEEP | Build pipeline — zero-runtime CSS |
| react-aria | KEEP | Accessibility — too complex to inline |
| slate* | KEEP | Rich text — too complex to inline |
| pdfjs-dist | KEEP | PDF rendering — too complex to inline |
| prismjs | KEEP | Syntax highlighting — too complex to inline |
| linkifyjs/* | KEEP | Link detection regex is non-trivial |
| blurhash | KEEP | Algorithm is non-trivial, 0 deps |
| emojibase/* | KEEP | Auto-generated Unicode data |
| @atlaskit/pragmatic-drag-and-drop* | KEEP | Complex DnD engine |
| browser-encrypt-attachment | KEEP | Matrix E2EE — critical, complex crypto |

---

## 9. IMMEDIATE ACTIONS

1. **`cd cinny && npm install`** — sync lockfile with package.json (sanitize-html 2.12.1→2.17.4, matrix-widget-api 1.13→1.16, element-call-embedded 0.16→0.19)
2. **Inline `await-to-js`** — create `src/app/utils/await-to.ts`, replace 3 imports
3. **Replace `dateformat`** with `dayjs` — audit 4 call sites, build a ~20-line mapping
4. **Inline `badwords-list`** — extract word array, drop the prerelease dependency
