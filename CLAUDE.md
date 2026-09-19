# Money Tree Forest — project notes for Claude

Static site: 100 financial assets drawn as tree rings. README.md has the layout and
the commands; docs/ENCODING.md is the data→visual contract. This file holds what the
code does not say.

## Copy: plain and precise

All user-facing text (headlines, subtitles, meta tags, field notes, keys, 404, methodology)
is written plainly. Say what the thing is; never dress it up.

- Say **ring**, not band. Say **drawdown**, not wound, crash, or cut. Say **recovered** /
  **has not recovered**, not healed or open to the bark.
- Nothing is "carved", "living", "breathing", or "whispering". The wood texture is styling;
  copy must not claim it means anything.
- Lead with the number and the fact: "100 financial assets visualized as tree rings",
  "Its worst year was 2022 at −31.0%".
- Kept on purpose, because the site is built around them: the family names (Old growth,
  Quiet compounders, Storm growers, Scarred survivors), the word **scar**, and "bark" only
  when it names the drawn edge in the encoding key.
- The owner will call out flowery language. When in doubt, cut the adjective.

## Numbers the UI shows

One definition per statistic, computed in the bake (`scripts/bake-rings.py`), read by the
UI; never re-derive a whole-tree number in the browser. See docs/ENCODING.md
§ "Whole-tree statistics". Accumulated growth is shown to two significant figures.

## Data

- `scripts/sync-lake.sh` pulls the lake slice from R2 into `./lake/` (gitignored); the
  bake reads `./lake` by default. CI runs the same script. The sibling `empty-data`
  checkout is NOT current — the nightly runs in the cloud.
- The public universe is defined upstream in `empty-data/pipeline/config.py`
  (`TWELVEDATA_ASSETS`); adding a tree means adding it there first (its `manage-assets`
  skill), then to `FEATURED` here. A featured id missing from the lake fails the bake on
  purpose.
- `data/rings.json` keeps every computed tree for the labs; `build.sh` publishes only the
  featured ones and pre-renders `/tree/<id>/` for each.

## Repo hygiene

- Never create symlinks inside the repo or a worktree (`.gitignore` ignores `lake` and
  `node_modules` as files too, after a committed symlink once overwrote both directories).
- Worktrees get their own `npm ci` and set `EMPTY_DATA` to the main checkout's `lake/`.
- No links to `labs/` from any page; `scripts/check.sh` fails the build if one appears.
- Bump the `?v=` cache-busting version on the three HTML entry points when CSS/JS changes.
