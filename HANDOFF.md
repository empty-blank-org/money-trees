# HANDOFF — money-trees

Session-state for whoever picks this up next. Verdicts and data facts live
in `NOTES.md`; this is where things stand and what's next.

**Last updated: 2026-07-08**

## Where things stand

- Brand-new standalone repo (created 2026-07-08), graduated from
  physics-of-assets experiment #12 ("tree rings"). Two commits: the seed
  (`forest/` = verbatim rings viz + data) and the first prototype batch.
- **17 working pages**: the original 8 plus three prototype batches and the
  `specimen/` full-page detail utility. The living-tree
  batch is `growth/`, `standing/`, and `living-grove/`; the forest-heart batch is
  `atlas/`, `clearings/`, and `terrain/`. The original batch was browser-verified;
  the detail batch is `arboretum/` and `specimen-wall/`. The original batch was
  browser-verified; all new batches pass static/runtime checks but still need a visual review.
  All are on the gallery (`index.html`). **None culled yet**;
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
5. The second prototype batch shares `shared/living.js` and
   `shared/living.css`. Keep the morphology mappings data-derived; spatial
   staging (hills, shadows) is non-encoding atmosphere only.
6. The forest-heart batch also uses the shared renderer. `atlas/` tests a direct
   replacement for the current Forest; `clearings/` tests categorical grouping;
   `terrain/` tests quantitative position. They are intentionally separate so
   the interaction grammars can be judged before being combined.
7. `shared/living.js` now also exports `drawDetailedRings()`, which ports the
   Poster experiment's deterministic volatility grain, partial-year edge geometry,
   and optional January year axis into multi-asset views. It still draws exactly
   one true band per annual data record; the internal grain lines are texture.
8. Both `arboretum/` and `specimen-wall/` link every card to the shareable
   `specimen/?id=TICKER` viewer. Canvas display size is explicitly forced to 1:1
   in all three detail views to prevent the shared canvas height rule from
   stretching circular rings into ellipses.
9. The current product spine is `arboretum/` → `specimen/`. Arboretum absorbs
   ranked browsing from Specimen Wall and adds animated reorder, ring microscope,
   and cross-date highlighting. Historical playback was intentionally removed
   from both pages because the 2010–2026 / mostly 2016–2026 sample is too short
   to make playback a valuable primary interaction.

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
