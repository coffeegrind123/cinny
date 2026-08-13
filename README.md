# Prinny (cinny fork)

The frontend of [**Prinny Client**](https://github.com/coffeegrind123/prinny-client) — a fork of
[cinnyapp/cinny](https://github.com/cinnyapp/cinny) carrying the changes that make it feel native
inside a Tauri shell, plus a pile of features upstream does not have.

This repository is **not** upstream Cinny. If you want upstream — its releases, its Docker images,
its hosted app at [app.cinny.in](https://app.cinny.in/) — go to
[cinnyapp/cinny](https://github.com/cinnyapp/cinny). Issues with *this* fork belong on
[prinny-client](https://github.com/coffeegrind123/prinny-client/issues).

## Branches

| Branch | What it is |
|---|---|
| `main` | The source. All development happens here; it is the default branch. |
| `webapp-release` | **Generated, never edited by hand.** One full built copy of the web app per commit, published by CI on every push to `main`. Self-hosters clone it. |

There is no `dev` branch and no `desktop-notifications` branch — both were consolidated into `main`.

## Using it

You almost certainly want the desktop or mobile app, which bundles this frontend:

- **Downloads** — [prinny-client releases](https://github.com/coffeegrind123/prinny-client/releases/latest) (Windows, macOS, Linux, Android)
- **Hosted web app** — [prinny.app/app](https://prinny.app/app/)
- **Public server directory** — [prinny.app/servers](https://prinny.app/servers/)

## Self-hosting the web app

No build step required. Clone the generated branch and point a webserver at its `dist/`:

```bash
git clone -b webapp-release https://github.com/coffeegrind123/prinny.git /usr/share/webapps/prinny
cd /usr/share/webapps/prinny && git pull   # later, to update
```

That branch ships its own `README.md`, an `nginx.conf`, and a `checksums.sha256` manifest.
**Serve `<checkout>/dist`, never the checkout itself** — the checkout contains `.git`.

Configuration lives in [`config.json`](config.json): default homeservers, featured rooms/spaces,
hash-routing, and `publicServersUrl` (the merged public-homeserver directory backing the login
autocomplete and the server browser — point it at your own copy if you would rather not call out
to `prinny.app`).

### Deploying under a subdirectory

Vite bakes the public base path into every asset URL, so a subdirectory deployment needs its own
build. [`build.config.ts`](build.config.ts) reads `PRINNY_BASE`:

```bash
PRINNY_BASE=/app/ npm run build   # emits /app/assets/... instead of /assets/...
```

Leave it unset for a domain-root deployment, which is what `webapp-release` contains.

## Local development

```bash
npm ci
npm start          # dev server on http://localhost:8080
npm run build      # production build into dist/
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Node version is pinned in [`.node-version`](.node-version).

> **Note on `npm run lint`:** ESLint runs correctly, but the repository carries a pre-existing
> backlog of findings (`'React' is defined but never used`, and `import/named` against type-only
> exports such as `RectCords`). These reproduce across files untouched by recent work. Treat a
> non-zero exit as expected until that backlog is cleared.

### Running with Docker

```bash
docker build -t prinny:latest .
docker run -p 8080:8080 prinny:latest
```

## What this fork changes

The full feature list — desktop notifications, configurable keybinds, Discord-style embeds,
presence indicators, the public server directory, Android push, and the rest — is documented in the
[prinny-client README](https://github.com/coffeegrind123/prinny-client#features).

User-visible changes are recorded per commit in [`CHANGELOG.md`](CHANGELOG.md), which is also the
source for the in-app changelog viewer and for GitHub release notes.

Upstream commits are cherry-picked periodically; [`UPSTREAM_BACKPORT_LOG.md`](UPSTREAM_BACKPORT_LOG.md)
tracks which ones have been taken, skipped, or partially applied.

## Licence

AGPL-3.0-only, inherited from upstream Cinny. See [LICENSE](LICENSE).
