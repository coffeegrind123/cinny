# Cinny Upstream Backport Log

Tracks upstream `cinnyapp/cinny` commits cherry-picked into our fork (`coffeegrind123/cinny`, branch `desktop-notifications`).

**Fork base:** `6a05ff5` (v4.11.1-era)
**Last sync:** 2026-05-17 (formal merge of `upstream/dev` @ `e89b8f7` via `-X ours`)
**Start from:** `e89b8f7` — next time, fetch upstream and check commits AFTER this one

> **2026-05-17:** Did an explicit `git merge upstream/dev -X ours` to bring
> upstream commit SHAs into our history (every patch was already applied
> via cherry-pick — see the table below — but GitHub still counted us as
> 43 commits behind by SHA). Non-conflicting non-code changes from upstream
> were accepted (CI workflow tweaks, lint config noise); conflicting files
> retained our cherry-pick versions.

Status: `[x]` backported · `[-]` skipped (CI/deps/docs noise) · `[~]` partial/adapted · `[ ]` pending

---

## Upstream commits (oldest → newest, since fork base)

### 2026-05-15 sync session

| SHA | Status | Description | Notes |
|-----|--------|-------------|-------|
| `7570a84` | `[x]` | Show image viewer when clicking url preview thumbnail (#2309) | Conflicts in UrlPreviewCard.tsx — merged with our custom embeds |
| `3d35490` | `[x]` | fix: hover state on url preview image, keyboard friendly (#2777) | Conflicts in UrlPreviewCard.tsx — added `onEnterOrSpace` + `tabIndex` to our custom image element |
| `0721b29` | `[-]` | chore: batch slate related deps (#2775) | CI noise |
| `8a78c96` | `[x]` | feat: allow using filenames in codeblocks (#2455) | Clean |
| `8f1add6` | `[x]` | fix: prevent codeblock filename drop on edit (#2780) | Clean |
| `b0954ee` | `[-]` | fix: Mention CLA in CONTRIBUTING.md (#2804) | Docs only |
| `132a76d` | `[-]` | chore: add semantic release (#2759) | CI noise |
| `65c87df` | `[-]` | chore: add git author to the sem release (#2815) | CI noise |
| `9c7b635` | `[-]` | chore: add new issue triage discussion template (#2825) | CI noise |
| `bcaf43a` | `[-]` | chore: fix link in issue triage template (#2826) | CI noise |
| `19f28b4` | `[-]` | chore: use private vulnerability disclosure (#2827) | CI noise |
| `4e559e5` | `[-]` | chore: group related package update together (#2833) | CI noise |
| `0c30ece` | `[x]` | fix: remove typo in no rooms UI (#2834) | Clean |
| `1c8f203` | `[-]` | chore: add 'Stickers and Emojis' as featured space (#2842) | Docs noise |
| `b6adac6` | `[-]` | chore: add notice about SDK replacement (#2778) | Docs noise |
| `b4299f8` | `[x]` | feat: add YYYY-MM-DD (ISO 8601) date format to presets (#2712) | Clean |
| `acae043` | `[-]` | chore: make error more useful and understandable (#2859) | Wording change |
| `1b5e58a` | `[-]` | chore: add matrixrooms.info to directory list (#2844) | Docs noise |
| `1068bba` | `[-]` | chore(deps): bump docker/login-action 3.7.0→4.1.0 (#2879) | CI dep |
| `0812131` | `[-]` | chore(deps): bump docker/build-push-action 6.19.2→7.1.0 (#2895) | CI dep |
| `74745ed` | `[-]` | chore(deps): bump nginx 1.29.5→1.29.8 (#2894) | CI dep |
| `3d79293` | `[-]` | chore(deps): bump softprops/action-gh-release 2.3.3→3.0.0 (#2892) | CI dep |
| `fb76e3e` | `[-]` | chore(deps): bump actions/upload-artifact 7.0.0→7.0.1 (#2893) | CI dep |
| `a33e8db` | `[-]` | chore(deps): bump dawidd6/action-download-artifact 16→20 (#2880) | CI dep |
| `b107109` | `[-]` | chore: remove package group definitions from renovate config (#2898) | CI noise |
| `0986849` | `[x]` | fix: do not attempt to join call on doubleclick if missing permissions (#2798) | Conflicts in RoomNavItem.tsx (imports) — kept presence imports + added StateEvent |
| `d186d31` | `[-]` | chore(deps): bump actions/setup-node 6.3.0→6.4.0 (#2906) | CI dep |
| `341fedd` | `[x]` | fix: edit lists crashing and list rendering issue in Firefox (#2920) | Clean |
| `735bc15` | `[x]` | fix: empty heading crash on edit msg (#2929) | Clean |
| `2864a5e` | `[-]` | chore(deps): bump dawidd6/action-download-artifact 20→21 (#2925) | CI dep |
| `64468df` | `[x]` | Merge commit from fork (security) | Clean |
| `02d1001` | `[x]` | feat: allow codeblock plaintext inside codeblock and nested lists markdown (#2930) | Clean |
| `e5e0b96` | `[x]` | feat: Add option to start video call in DM (#2745) | Conflicts in Room.tsx (imports) — kept MobileSwipeBack + added call imports |
| `21bbf4b` | `[x]` | fix: support audio with ogg filetype (#2924) | Clean |
| `0b99d85` | `[-]` | docs: Update featured communities in Explore (#2936) | Docs only |
| `909aa43` | `[x]` | fix: notification cause crash on android (#2938) | Clean |
| `bef2672` | `[x]` | fix: support for stable mutual rooms endpoint (#2939) | Clean |
| `bad1fb6` | `[x]` | fix(deps): update sanitize-html to v2.17.4 (#2937) | Conflicts in package-lock.json — kept our tauri-plugin entries |
| `8132767` | `[-]` | chore: Update GITHUB_TOKEN to CLA_PAT in prod workflow (#2940) | CI noise (and reverted) |
| `f7f4a41` | `[-]` | Revert "chore: Update GITHUB_TOKEN to CLA_PAT" (#2941) | CI noise |
| `c05a6be` | `[-]` | chore(release): 4.12.0 [skip ci] | Release tag bump |
| `9bc1e7e` | `[-]` | fix: null edit for another release (#2942) | Empty after resolution (already covered) |
| `e89b8f7` | `[-]` | chore(release): 4.12.1 [skip ci] | Release tag bump — **START HERE next sync** |

---

## Summary

- **Backported:** 16 commits (4 features + 9 bugfixes + 1 security merge + 1 dep bump + 1 UI)
- **Skipped:** 27 commits (18 CI/deps + 5 release chore + 2 docs + 2 other noise)
- **Conflicts resolved:** UrlPreviewCard.tsx (×2), RoomNavItem.tsx, Room.tsx, package-lock.json

## Process (reference for future syncs)

```bash
# 1. Fetch upstream
git fetch upstream --tags

# 2. Check what's new since last sync (start from the "START HERE" marker above)
git log --oneline e89b8f7..upstream/dev --reverse --no-merges

# 3. Filter out noise (chore, CI deps, docs)
# 4. Cherry-pick meaningful commits oldest-first
# 5. Resolve conflicts — preserve our custom features (embeds, presence, mobile-push, etc.)

# 6. Update this file with status of every new commit
# 7. Push: git push origin desktop-notifications
```
