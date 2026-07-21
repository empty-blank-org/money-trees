# Money Trees

Money Trees turns an asset's price history into a tree cross-section: one band per calendar year, with growth, volatility, and major drawdowns encoded into the wood. The main product is the Detailed Arboretum at `/`; selecting a tree opens its complete record at `/specimen/?id=TICKER`, where it can also be exported as a high-resolution poster PNG.

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
```

Production never imports from `labs/`. Lab experiments own frozen copies of every asset and dataset they need, so they remain runnable while the main app evolves.

## Run locally

```bash
python3 -m http.server 8081
```

Open <http://localhost:8081> for the app or <http://localhost:8081/labs/> for the archive. There is no build step and no frontend dependency install.

## Build and deployment

Cloudflare Pages runs `./build.sh` and publishes `dist/`. The build copies the production app and canonical data while excluding the development-only lab archive and stripping lab links from public pages. `dist/` is generated and ignored by Git.

The GitHub Actions workflow at `.github/workflows/refresh-rings.yml` runs daily and on demand. It synchronizes the price lake from R2, re-bakes `data/rings.json`, and commits the artifact only when its contents change; that push triggers the public deployment. The workflow requires the documented R2 repository secrets.

## Re-bake production data

```bash
.venv/bin/python scripts/bake-rings.py
```

The script reads the empty-data lake from `/Users/nmadd/Dropbox/code/empty-data/data` by default. Override it with `EMPTY_DATA`. Price parquet files contain `hour`, `price`, and `volume`; asset classes roll up from `groups.json`.

Lab prep scripts are deliberately local to their experiments and write only to that experiment's `data/` directory.
