# Dependency Security Audit Report

**Date:** 2026-08-11 (revised — §1 and §9 now record the advisories as *cleared*;
previous revisions: 2026-08-10, and 2026-05-15 which described a manifest three
major upgrade rounds out of date)
**Project:** cinny (Matrix client fork — coffeegrind123/cinny, branch `main`)
**Manifest:** 60 `dependencies`, 38 `devDependencies`
**Resolved tree:** 950 packages (241 prod, 640 dev, 133 optional)
**Method:** `npm audit`, `npm outdated`, `npm view <pkg> versions`, plus
`grep` over `src/` for each declared dependency.

How to reproduce every number below:

```bash
npm ci
npm audit --json
npm outdated --json
```

---

## 0. What changed since the last revision

The 2026-05-15 report is obsolete in most of its specifics. Corrections:

| Claim in old report | Reality now |
|---|---|
| `dateformat` is 6 years stale, replace it | **Gone** — no longer in the manifest |
| `tauri-plugin-mobile-push-api` is a dependency | **Gone** — not in the manifest |
| react 18 / typescript 4.9 / vite 5 / eslint 8 / prettier 2 | react **19.2.6**, typescript **5.9.3**, vite **8.0.13**, eslint **9.39.0**, prettier **3.8.3** |
| Lockfile/pin mismatches for sanitize-html, matrix-widget-api, element-call | **Resolved** — lockfile matches the manifest |
| `emojibase-data` 15.3.2 vs emojibase 16.x peer warnings | **Resolved** — both on 17.0.0 |
| `badwords-list` prerelease "unresolved" | **Resolved** — see §4; the pin is correct and intentional |

---

## 1. Open advisories — **cleared 2026-08-11**

`npm audit` now reports **0 advisories**, down from **22 (10 high, 5 moderate,
7 low)**.

### Runtime (shipped to browsers) — fixed

| Package | Was | Now | Severity | Advisory |
|---|---|---|---|---|
| **pdfjs-dist** | 5.7.284 | **6.2.108** | high | Arbitrary JavaScript execution when opening a malicious PDF |
| **react-router-dom** / react-router | 7.15.1 | **7.18.2** | high | Open redirect via backslash in `<Link>`/`useNavigate` (CVE-2025-68470 bypass); RSCErrorHandler missing protocol validation (XSS) |
| **ua-parser-js** | 2.0.9 | **2.0.10** | moderate | ReDoS in `withClientHints()` via unbounded `Sec-CH-UA-Model` parsing |
| **lodash** (via `slate-dom`/`slate-react`) | 4.17.21 | **4.18.1** (override) | high | Prototype pollution in `_.unset`/`_.omit`; code injection via `_.template`. The only vulnerable package that actually reached the browser bundle — `slate` uses just `debounce` and `throttle`, so the bump is inert for us. |

All of these parse attacker-controlled input: a PDF attachment from any room, a
URL from any message, a UA string, editor state.

**pdfjs-dist 5 → 6 is a major bump and needed two code changes** —
`getDocument()` lost its bare-string overload (`{ url }` now), and v6 moved
JBIG2 / JPEG 2000 / colour-management decoding into WebAssembly modules the
worker fetches from `wasmUrl` at runtime. Those assets are not in the bundle by
default; without them scanned PDFs (JBIG2 is *the* scanner codec) render blank
with no error. `vite.config.js` now copies them to `pdfjs/wasm/` and
`pdfjs/iccs/`, and `src/app/plugins/pdfjs-dist.ts` points `wasmUrl`/`iccUrl` at
them. `quickjs-eval.*` — the sandbox for JavaScript embedded in a PDF — is
deliberately *not* copied.

Verified in headless Chrome against the built output: worker loads, both sample
PDFs render with non-blank pixel counts, all three `.wasm` assets and the ICC
profile return 200, console clean. The app also boots and routes (login ↔
register) on react-router 7.18.2.

### Build/dev only — fixed

| Package | Was | Now | Severity |
|---|---|---|---|
| **vite** | 8.0.13 | **8.2.1** | high |
| **@babel/core** | ≤7.29.0 | **^7.29.6** (override) | low — arbitrary file read via `sourceMappingURL` |
| **esbuild** | 0.28.0 | **^0.28.2** (override) | low — dev-server file read on Windows |
| **brace-expansion** | 1.1.14 / 2.1.0 / 5.0.6 | **^5.0.9** (override) | high — exponential-time expansion DoS |
| **js-yaml** | 4.1.1 | **^4.3.1** (override) | high — quadratic CPU via merge keys / `!!omap` |
| **fast-uri** | 3.1.2 | **^3.1.5** (override) | high — host confusion |
| **tmp** | 0.0.33 | **^0.2.7** (override) | high — path traversal / symlink write |
| **uuid** | 10.0.0 | **^11.1.1** (override) | moderate |
| postcss, nanoid | transitive | cleared by the `vite` bump | high |

`overrides` in `package.json` is doing the work for the transitive set. npm's
own suggestion for the last five was to **downgrade `@vanilla-extract/vite-plugin`
from 5.2.2 to 3.9.4** — two majors back — because that plugin pins the
vulnerable `@babel/core` and `esbuild`. Overriding the two root causes directly
clears the same advisories without regressing the CSS build.

Verified after every override: `tsc --noEmit` clean, `vite build` exit 0, no
source maps in `dist`, no inline script in `index.html`, app boots.

### Why this list existed at all — and why the 2026-08-10 fix did not work

The 2026-08-10 revision recorded this as fixed: "Renovate owns npm; routine
bumps stay gated by the dependency dashboard, but `vulnerabilityAlerts` is
`dependencyDashboardApproval: false`, so security PRs open by themselves."

**None of that was in effect.** Checked against the GitHub API on 2026-08-11
rather than against the config file:

| Check | Result |
|---|---|
| `GET /repos/coffeegrind123/cinny/vulnerability-alerts` | **404** — Dependabot alerts off |
| `GET /repos/coffeegrind123/cinny/automated-security-fixes` | `{"enabled": false}` |
| Renovate PRs / branches on either repo | none |
| `has_issues` on either repo | **false** |

Renovate is not installed. And even if it were, Issues are disabled on both
repositories — so the dependency dashboard that `:dependencyDashboardApproval`
gates every routine npm update behind **cannot be created**, and the
`vulnerabilityAlerts` block that was supposed to bypass it is part of the same
inert config. Nothing was watching npm at all. That is the actual reason a
high-severity pdf.js advisory sat unpatched, and it would have happened again.

A config file is not a control until something reads it. Verify the bot exists
and is running before recording a supply-chain gap as closed.

Fixed 2026-08-11:

- **Dependabot alerts and automated security fixes enabled** on
  `coffeegrind123/cinny` and `coffeegrind123/prinny-client` (a repository
  setting, not a file — `PUT .../vulnerability-alerts` and
  `.../automated-security-fixes`, both now confirming enabled).
- **Dependabot owns npm**, plus github-actions and docker here, and npm,
  github-actions and cargo in prinny-client. It needs no app install and no
  Issues.
- **Renovate's npm manager is disabled** in both `renovate.json` files, so
  installing the app later cannot produce two bots on one manifest. Each
  disabled block carries the swap instructions.
- prinny-client also gained a **cargo** ecosystem — `cargo audit` is a CI gate
  there and found real advisories (rustls-webpki certificate path validation,
  quinn-proto remote memory exhaustion), so a bump nobody proposes is a red
  build nobody can fix.

---

## 2. Trusted — major org / massive adoption

| Package | Maintainer | Why trusted |
|---|---|---|
| **react** / **react-dom** 19.2.6 | Meta | Ubiquitous |
| **@tanstack/react-query** / **-devtools** / **react-virtual** | TanStack | Industry standard |
| **@tauri-apps/api** + plugins (notification, os, process, updater) | Tauri | Official v2 plugins |
| **react-router-dom** 7.15.1 | Remix/Shopify | Standard routing — **has an open advisory, see §1** |
| **jotai**, **immer** | Poimandres / M. Weststrate | 0-dep state management |
| **slate** / **-dom** / **-history** / **-react** | ianstormtaylor | Rich-text engine |
| **i18next** family | i18next team | Standard i18n |
| **matrix-js-sdk** 41.7.0 | Matrix.org | Official SDK; 42.1.0 available |
| **matrix-widget-api** | Matrix.org | Official widget API (Element Call) |
| **@element-hq/element-call-embedded** | Element | Vendored call UI — see §5 |
| **pdfjs-dist** | Mozilla | **Open advisory, see §1** |
| **sanitize-html** 2.17.6 | apostrophecms | The security boundary for message rendering — current |
| **prismjs**, **dayjs**, **chroma-js**, **classnames**, **linkifyjs**/**linkify-react** | various | Small, widely used |
| **react-aria** | Adobe | Accessibility primitives |
| **@atlaskit/pragmatic-drag-and-drop** (+ auto-scroll, hitbox) | Atlassian | DnD engine |
| **hls.js** | video-dev | HLS playback |

---

## 3. Keep — complex enough not to rewrite

`@vanilla-extract/css` · `@vanilla-extract/recipes` · `@vanilla-extract/vite-plugin`
· `folds` (Cinny's own UI library) · `focus-trap-react` · `html-react-parser` ·
`html-dom-parser` · `domhandler` · `emojibase` / `emojibase-data` ·
`browser-encrypt-attachment` (Matrix E2EE attachments) · `blurhash` ·
`ua-parser-js` (advisory above) · `pdfjs-dist` · `prismjs`.

---

## 4. badwords-list `2.0.1-4` — resolved, keep the pin

The previous report flagged this as an unresolved prerelease pin. It is not a
problem, and there is no stable release to move to:

```console
$ npm view badwords-list versions --json
["1.0.0","2.0.1-0","2.0.1-2","2.0.1-3","2.0.1-4"]
$ npm view badwords-list dist-tags
{ latest: '2.0.1-4' }
```

- `2.0.1-4` **is** the `latest` dist-tag. Despite the SemVer prerelease suffix
  it is the maintainer's current release (published 2024-08-18).
- The only non-prerelease version is `1.0.0`, published **2014-07-31**. It is
  CommonJS (`"main": "./lib/index"`), ships no type declarations, and has no
  `@types/badwords-list` on npm. `src/app/plugins/bad-words.ts` does
  `import * as badWords from 'badwords-list'`; under `"strict": true` that would
  fail `npm run typecheck` with TS7016, and the package would need an ambient
  declaration to compile. Moving *back* eleven years to an untyped CJS build is
  a downgrade in every dimension including security.

**Decision: keep `badwords-list@2.0.1-4` pinned exactly.** Renovate will not
propose prerelease-to-prerelease drift, and there is nothing newer. Revisit only
if the upstream project cuts a real `2.0.1`/`2.1.0`. The standing alternative —
vendoring the word list, which is static data — remains open (§6) and would drop
the dependency entirely.

---

## 5. Vendored third-party HTML: Element Call

`@element-hq/element-call-embedded` is copied verbatim into
`dist/public/element-call/` by `vite.config.js`. Its `index.html` contains
**two inline `<script>` blocks**, which are covered in the shipped CSP by
SHA-256 source expressions rather than `'unsafe-inline'`.

**Bumping this package changes those inline scripts and will silently break
calls** until the hashes are regenerated in all five serving configs
(`docker-nginx.conf`, `contrib/nginx/cinny.domain.tld.conf`,
`contrib/caddy/caddyfile`, `netlify.toml`,
`.github/webapp-release-template/nginx.conf`). The regeneration snippet is in
the comment block at the top of `docker-nginx.conf`. Treat this as part of the
upgrade checklist for that package.

---

## 6. Declared but not imported from `src/`

A plain grep over `src/` finds no reference to:

| Package | Verdict |
|---|---|
| `@vanilla-extract/vite-plugin` | **Used** — by `vite.config.js`, not `src/`. It is a devDependency in the wrong list (it sits in `dependencies`); harmless but misleading |
| `slate-dom` | **Used indirectly** — peer of `slate-react`; keeping the explicit pin keeps the four slate packages on one version |
| `react-range` | **Candidate for removal** — no importer found. Verify, then drop |

---

## 7. Inline / drop candidates (unchanged, still open)

| Package | Size | Note |
|---|---|---|
| `await-to-js` | 3 lines | Trivially inlined |
| `millify` | ~155 lines | Number formatting |
| `react-blurhash` | ~77 lines | Canvas wrapper over `blurhash` |
| `react-error-boundary` | ~100 lines | Thin React boundary |
| `badwords-list` | static data | See §4 |
| `is-hotkey` | ~30 lines | Used heavily in the editor; keep unless it goes stale |
| `file-saver` | shim | `URL.createObjectURL` + anchor click covers modern browsers |

`react-google-recaptcha` was previously marked "check if still used" — it **is**
used, by `src/app/components/uia-stages/ReCaptchaStage.tsx`, for the
`m.login.recaptcha` UIA stage. It loads `https://www.google.com/recaptcha/api.js`
at runtime, which is why the shipped CSP allowlists
`https://www.google.com/recaptcha/`, `https://www.gstatic.com/recaptcha/` and
`https://recaptcha.net/recaptcha/` in `script-src`. Removing the package means
removing those three sources too.

---

## 8. Version drift

`npm outdated` lists **54** packages behind latest. Nothing there is a
correctness emergency beyond §1, but note the majors that will need work:

| Package | Pinned | Latest | Nature |
|---|---|---|---|
| pdfjs-dist | 5.7.284 | 6.2.108 | Major — **and the security fix** |
| matrix-js-sdk | 41.7.0 | 42.1.0 | Major |
| @element-hq/element-call-embedded | 0.20.1 | 0.23.0 | Minor, but see §5 |
| eslint / @eslint/js | 9.39.0 | 10.x | Major, dev-only |
| @atlaskit/pragmatic-drag-and-drop* | 1.8.1 / 2.1.5 / 1.1.0 | 2.0.2 / 3.0.0 / 2.0.0 | Major, dev churn |
| @fontsource/inter | 4.5.14 | 5.3.0 | Major |
| html-dom-parser | 7.1.0 | 8.0.1 | Major — parses untrusted HTML, prioritise |
| domhandler | 5.0.3 | 6.0.1 | Major — same parsing path |

**Pin style:** every dependency is pinned exactly (no `^`/`~`), which is the
right call for a client that ships prebuilt bundles — but it only works if the
bots are allowed to move the pins. See §1.

---

## 9. Immediate actions

1. ~~`npm install pdfjs-dist@6.2.108`~~ — **done 2026-08-11.** Major bump; see
   §1 for the two code changes it required and the runtime verification.
2. ~~`npm install react-router-dom@7.18.2`~~ — **done.**
3. ~~`npm install ua-parser-js@2.0.10`~~ — **done.**
4. ~~`npm install vite@8.2.1`~~ — **done.** The transitive set did *not* clear
   itself from parent bumps alone; it needed the `overrides` block in
   `package.json` (§1). Renovate lockfile maintenance may drop those overrides
   back out of date — re-check `npm audit` after any lockfile-only PR, and
   remove an override once its parent has moved past the pin on its own.
5. **Still open:** confirm Renovate is actually installed on the repository. The
   ungated `vulnerabilityAlerts` config in `.github/renovate.json` does nothing
   if the app is not enabled — in which case switch npm to Dependabot (uncomment
   the npm ecosystem there and disable Renovate's npm manager, never both at
   once). This is the control that stops the list in §1 rebuilding itself.
6. Leave `badwords-list@2.0.1-4` alone (§4).
7. `@vanilla-extract/vite-plugin` has a standing advisory chain with no forward
   fix — the only version npm considers clean is 3.9.4, two majors back. It is
   clear today only because the two root causes (`@babel/core`, `esbuild`) are
   overridden. Re-check when vanilla-extract publishes a release that unpins
   them.
