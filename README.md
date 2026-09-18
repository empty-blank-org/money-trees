# Money Tree Forest

Money Tree Forest (moneytreeforest.com) turns an asset's price history into a tree cross-section: one band per calendar year, with growth, volatility, and major drawdowns encoded into the wood. The curated Arboretum currently contains 97 specimens; selecting one opens its complete record at `/specimen/?id=TICKER`, where it can be inspected by mouse, touch, or keyboard and exported as a high-resolution poster PNG.

The hard gate is that every visual feature must decode to a real quantity computed from real data. Ring width is annual log growth, color is annual return, darkness is realized volatility, and scars are qualifying drawdown episodes. Natural wood is the default return encoding; an optional market mode provides the familiar red/green analytical view. See [`docs/ENCODING.md`](docs/ENCODING.md) for the complete contract and caveats.

## Structure

```text
index.html                 production Arboretum shell
app/                       Arboretum and Full Specimen UI modules
specimen/                  shareable full-record route
shared/                    production renderer and design tokens
data/rings.json            canonical committed production artifact
scripts/sync-lake.sh       pull the lake slice from R2 into lake/ (dev and CI)
scripts/bake-rings.py      canonical price-lake → rings bake
labs/                      experiment catalog and frozen studies
  experiments/<slug>/      self-contained HTML, assets, data, optional prep
docs/ENCODING.md           visual/data grammar
docs/PUBLICATION.md        manual licensing and launch gates
methodology/               public methodology, provenance, and limitations
assets/                    favicon and social sharing artwork
scripts/validate.py        production artifact invariants
scripts/check.sh           local/CI validation entrypoint
```

Production never imports from `labs/`. Lab experiments own frozen copies of every asset and dataset they need, so they remain runnable while the main app evolves.

## Run locally

```bash
python3 -m http.server 8081
```

Open <http://localhost:8081> for the app or <http://localhost:8081/labs/> for the archive. There is no build step and no frontend dependency install.

## Build and deployment

Cloudflare Pages runs `./build.sh` and publishes `dist/`. The build copies the production app and canonical data while excluding the development-only lab archive; the pages carry no lab links (the archive is reached by URL at `/labs/` on the dev server). `dist/` is generated and ignored by Git. The canonical origin defaults to `https://moneytreeforest.com`; preview deployments can override it with the Pages build variable `SITE_URL`.

The GitHub Actions workflow at `.github/workflows/refresh-rings.yml` runs daily and on demand. It synchronizes the price lake from R2, re-bakes and validates `data/rings.json`, and commits the deterministic artifact only when source data changes; that push triggers the public deployment. The workflow requires the documented R2 repository secrets. A separate validation workflow checks every push and pull request.

## Re-bake production data

```bash
python3 -m pip install --requirement requirements-bake.txt
scripts/sync-lake.sh          # pull the lake slice from R2 into ./lake (gitignored)
python3 scripts/bake-rings.py # reads ./lake by default
```

`scripts/sync-lake.sh` is the single definition of what Money Trees downloads from the `empty-data-lake` R2 bucket; the refresh workflow runs the same script. Locally it uses the `[r2]` profile in `~/.aws` and reads `R2_ACCOUNT_ID` from the sibling `empty-data` checkout's `.env`; in CI those come from the repo secrets. The bake resolves its lake in this order: `EMPTY_DATA` if set, then `./lake`, then a sibling `empty-data` checkout's `data/` directory.

The bake reads the empty-data lake's **two price namespaces**. Everything the site draws except crypto comes from `$EMPTY_DATA/prices_public/` — Twelve Data equities/ETFs/bonds/commodities/FX (daily history begins 1970-01-02) plus the Kenneth R. French Data Library century series (daily market factor + 12 Industry Portfolios, 1926→), compounded upstream into total-return indexes. That namespace is licensed for public display; its per-asset class and display names come from `$EMPTY_DATA/prices_public.json`. Crypto comes from the **crypto slice only** of the private `$EMPTY_DATA/prices/` (CoinGecko, the one series that does not exist in the public namespace); the rest of that namespace is Tiingo-sourced and may not be publicly displayed, so the bake never reads it and `LAKE_HISTORY_FLOOR` (1970-01-01) stays on that read path as belt-and-suspenders.

Published returns are quantized to a whole percent (`RET_QUANT`) so the artifact cannot be inverted back to a vendor's adjusted closes; see [`docs/ENCODING.md`](docs/ENCODING.md) § *Published precision*.

In CI, `.github/workflows/refresh-rings.yml` syncs the lake slice from R2 with the script above and **gates on `health.json.generated_at`** (fails if the snapshot is >3 days old) before rebaking — the standard empty-data consumer contract (see empty-data's `context/technical-architecture.md` § *Consumer contract v1*). Price parquet files contain `hour`, `price`, and `volume` in both namespaces; asset classes and display names come from `prices_public.json`, falling back to `groups.json`'s group prefixes and a stable cross-asset name map for crypto.

## Validate before publishing

```bash
./scripts/check.sh
```

This verifies the data schema and invariants, compiles Python, checks JavaScript syntax, builds the public artifact, confirms the methodology and social assets are present, and ensures no lab routes leak into production. CI additionally runs Playwright smoke tests against the built site; run those locally with `npm ci && npm run test:browser` after installing Playwright’s Chromium runtime.

Lab prep scripts are deliberately local to their experiments and write only to that experiment's `data/` directory.
