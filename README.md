# Prinny webapp (built artifacts)

This branch contains the **built** Cinny webapp used by Prinny — pre-compiled, ready to serve. The source lives on the [`desktop-notifications`](https://github.com/coffeegrind123/cinny/tree/desktop-notifications) branch and is auto-built into this branch on every push by [`.github/workflows/publish-webapp.yml`](https://github.com/coffeegrind123/cinny/blob/desktop-notifications/.github/workflows/publish-webapp.yml).

Each commit on this branch is one full build. To install or update, you only need `git`.

## Install

```bash
git clone -b webapp-release https://github.com/coffeegrind123/cinny.git /usr/share/webapps/prinny
```

## Update

```bash
cd /usr/share/webapps/prinny
git pull
```

History is linear (one commit per build) so `git pull` always fast-forwards — no rebases or resets needed.

## Serve

Cinny is a single-page app: every route except a handful of static files must rewrite to `/index.html`. An nginx snippet ready to drop in is included as [`nginx.conf`](./nginx.conf) — adapt the `server_name` and TLS bits to your setup, then:

```bash
ln -s /usr/share/webapps/prinny/nginx.conf /etc/nginx/sites-enabled/prinny.conf
nginx -t && systemctl reload nginx
```

If you're not on nginx, just replicate the rewrites:
- `/config.json`, `/manifest.json`, `/sw.js`, `/pdf.worker.min.js` → serve as-is
- `/public/*`, `/assets/*` → serve as-is
- everything else → `/index.html` (let React Router take it)

## Configure

`config.json` at the root holds the homeserver list and explore directory. Either edit it in place after `git pull` (your edits survive future pulls only if there are no upstream changes to `config.json` — otherwise you get a merge conflict, which is loud and recoverable) or override with `git update-index --skip-worktree config.json` to ignore future updates to it.
