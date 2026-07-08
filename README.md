# money-trees

Every asset is a tree. One ring per calendar year — width is that year's growth,
color and darkness its violence, scars its major drawdowns. A market history you
can read like a dendrochronologist reads a core sample.

Graduated from [physics-of-assets](https://github.com/empty-block/physics-of-assets)
(experiment #12, "tree rings") into its own project. Same architecture: a pure
**data-contract consumer** of the empty-data parquet lake. Each visualization is a
`prep.py` that bakes a JSON artifact into `data/`, plus an `index.html` that renders
it (vanilla canvas, no build step, no deps).

## The gate

Every visual feature must decode to a **real quantity computed on real data**.
Styling an analogy doesn't count. Ring width = log total return, scar depth =
drawdown magnitude, scar angle = calendar trough date. Nothing decorative.

## Structure

```
index.html          gallery / entry point
data/               baked JSON artifacts (committed — the app runs standalone)
shared/             shared config (spans.json — canonical event windows)
forest/             the seed viz: the full forest (from physics-of-assets rings)
<proto>/            one prototype per directory: index.html + prep.py
```

## Running

```
python3 -m http.server 8081
```

then open <http://localhost:8081>.

## Re-baking

`prep.py` scripts read the empty-data lake. Default path is
`/Users/nmadd/Dropbox/code/empty-data/data`; override with the `EMPTY_DATA`
env var. Price parquets: one file per ticker, columns `hour` (daily UTC
timestamp), `price`, `volume`. Asset classes roll up from `groups.json`
(crypto / equity / bonds / commodities / fx).
