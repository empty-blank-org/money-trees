# Money Trees

Money Trees turns an asset's price history into a tree cross-section: one band per calendar year, with growth, volatility, and major drawdowns encoded into the wood. The main product is the Detailed Arboretum at `/`; selecting a tree opens its complete record at `/specimen/?id=TICKER`.

The hard gate is that every visual feature must decode to a real quantity computed from real data. Ring width is annual log growth, color is annual return, darkness is realized volatility, and scars are qualifying drawdown episodes. See [`docs/ENCODING.md`](docs/ENCODING.md) for the complete contract and caveats.

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

## Re-bake production data

```bash
.venv/bin/python scripts/bake-rings.py
```

The script reads the empty-data lake from `/Users/nmadd/Dropbox/code/empty-data/data` by default. Override it with `EMPTY_DATA`. Price parquet files contain `hour`, `price`, and `volume`; asset classes roll up from `groups.json`.

Lab prep scripts are deliberately local to their experiments and write only to that experiment's `data/` directory.
