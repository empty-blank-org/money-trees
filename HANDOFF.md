# HANDOFF — money-trees

Session-state for whoever picks this up next. Verdicts and data facts live
in `NOTES.md`; this is where things stand and what's next.

**Last updated: 2026-07-08**

## Where things stand

- Brand-new standalone repo (created 2026-07-08), graduated from
  physics-of-assets experiment #12 ("tree rings"). Two commits: the seed
  (`forest/` = verbatim rings viz + data) and the first prototype batch.
- **8 working pages**: `forest/` (seed) + 7 prototypes — `grove/`, `core/`,
  `climate/`, `fire/`, `chronology/`, `game/`, `poster/` — all
  browser-verified, all on the gallery (`index.html`). **None culled yet**;
  keep/kill is the next decision. NOTES.md has the verdict table.
- The working name/framing: **"Money Trees" as a potentially standalone
  product**, not just a viz collection. The product-shaped prototypes
  (grove's shareable portfolio links, poster's print-res download, the
  game) were built to test that direction.

## Architecture

Pure data-contract consumer of the empty-data parquet lake (same pattern as
physics-of-assets). Each prototype = `index.html` (vanilla canvas, no build
step, no deps) + optional `prep.py` baking JSON into `data/` (committed, so
the app runs standalone). Lake path defaults to
`/Users/nmadd/Dropbox/code/empty-data/data`, override with `EMPTY_DATA`.
Serve with `python3 -m http.server 8081` from repo root.

`data/rings.json` (916KB, from forest/prep.py) is the shared backbone —
grove, core, game, and poster are frontend-only consumers of it;
climate/fire/chronology bake their own JSON.

## Open threads, in priority order

1. **Cull the batch** (user decision): which of the 7 earn iteration,
   which die. Build-time observations: climate and chronology produced the
   strongest *findings*; grove and poster are the strongest *product*
   candidates; core is the best *reading* tool; game is the encoding's
   honesty test.
2. **If the standalone-product direction wins**: grove sharing + poster
   are the obvious v2 investments (poster shop / print flow was a
   brainstorm idea, deliberately deferred). GitHub remote doesn't exist
   yet — repo is local-only.
3. Deferred prototype ideas from the brainstorm: master-chronology overlay
   behind each forest glyph, fire-ecology block-bootstrap null, ambient
   forest audio (port physics-of-assets' sonify).
4. `forest/index.html` still renders featured-50 by default with the same
   UI as the parent repo's rings — it hasn't been touched this session
   beyond the prep path fix. A Money-Trees-branded landing/forest redesign
   is untouched territory.

## Gotchas

- `rings.json` monthly returns (`mr`) exist **only for the 50 featured
  assets** — partial-year arcs and any sub-year angular detail degrade for
  the other 434.
- The **mid-2026 crypto crash is real** (BTC −40%, ETH −55%, troughs Jun
  2026, verified against raw prices) — open Jun-2026 scars and 2026's #2
  climate-year rank are legitimate, not artifacts.
- Survivorship: delisted/rugged assets aren't in the lake, which biases
  fire/serotiny upward and thins early-year forests. Every affected page
  carries the caveat in its explainer.
- Composite portfolio math in grove assumes annual rebalancing and
  weight-averaged vol (ignores correlation) — stated in its explainer;
  don't quote its composite vol as a real portfolio vol.
