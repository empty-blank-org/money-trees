# Money Trees

Money Trees turns an asset's price history into a tree cross-section: one band per calendar year, with growth, volatility, and major drawdowns encoded into the wood. The curated Arboretum currently contains 86 specimens; selecting one opens its complete record at `/specimen/?id=TICKER`, where it can be inspected by mouse, touch, or keyboard and exported as a high-resolution poster PNG.

The hard gate is that every visual feature must decode to a real quantity computed from real data. Ring width is annual log growth, color is annual return, darkness is realized volatility, and scars are qualifying drawdown episodes. Natural wood is the default return encoding; an optional market mode provides the familiar red/green analytical view. See [`docs/ENCODING.md`](docs/ENCODING.md) for the complete contract and caveats.

## Structure

```text
index.html                 production Arboretum shell
app/                       Arboretum and Full Specimen UI modules
specimen/                  shareable full-record route
shared/                    production renderer and design tokens
data/rings.json            canonical committed production artifact
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

Cloudflare Pages runs `./build.sh` and publishes `dist/`. The build copies the production app and canonical data while excluding the development-only lab archive and stripping lab links from public pages. `dist/` is generated and ignored by Git. The canonical origin defaults to `https://moneytrees.fun`; preview deployments can override it with the Pages build variable `SITE_URL`.

The GitHub Actions workflow at `.github/workflows/refresh-rings.yml` runs daily and on demand. It synchronizes the price lake from R2, re-bakes and validates `data/rings.json`, and commits the deterministic artifact only when source data changes; that push triggers the public deployment. The workflow requires the documented R2 repository secrets. A separate validation workflow checks every push and pull request.

## Re-bake production data

```bash
python3 -m pip install --requirement requirements-bake.txt
python3 scripts/bake-rings.py
```

The script reads the sibling `../empty-data/data` lake by default (dev). Override it with `EMPTY_DATA`. In CI, `.github/workflows/refresh-rings.yml` instead syncs the lake slice from the `empty-data-lake` R2 bucket and **gates on `health.json.generated_at`** (fails if the snapshot is >3 days old) before rebaking — the standard empty-data consumer contract (see empty-data's `context/technical-architecture.md` § *Consumer contract v1*). Price parquet files contain `hour`, `price`, and `volume`; asset classes roll up from `groups.json`. Display names come from lake fundamentals metadata when available, with a stable cross-asset map for curated instruments.

## Validate before publishing

```bash
./scripts/check.sh
```

This verifies the data schema and invariants, compiles Python, checks JavaScript syntax, builds the public artifact, confirms the methodology and social assets are present, and ensures no lab routes leak into production. CI additionally runs Playwright smoke tests against the built site; run those locally with `npm ci && npm run test:browser` after installing Playwright’s Chromium runtime.

Lab prep scripts are deliberately local to their experiments and write only to that experiment's `data/` directory.
