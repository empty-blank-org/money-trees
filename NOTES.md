# Money Trees — Experiment Notes

Standalone project graduated from physics-of-assets experiment #12 (tree rings).
One prototype per subdirectory; `index.html` at this level is the gallery. Same
hard gate as the parent repo: **every visual feature must decode to a real
quantity computed on real data** — styling an analogy doesn't count.

## Verdicts (keep / kill / graduate)

First batch built 2026-07-08 in parallel (Sonnet subagents), all browser-verified.
Un-culled — verdicts pending review.

| # | Prototype | Status | Notes |
|---|-----------|--------|-------|
| 0 | The Forest (`forest/`) | seed, keep | The original rings viz, verbatim from physics-of-assets. 484 trees, prep repointed at the lake via `EMPTY_DATA` env var. |
| 1 | Your Grove (`grove/`) | built, verified | Portfolio → personal forest + composite portfolio tree. Yearly-rebalanced weighted returns, weights renormalized over holdings alive each year; glyph area ∝ weight; composite scar angle = weighted circular mean of member trough dates. Shareable via URL hash (round-trip tested). Vol of composite = weighted member vol (approximation, stated). |
| 2 | Core Samples (`core/`) | built, verified | Rings as flat lab strips, shared calendar axis. Live climate-column overlay (≥60% of shown strips negative): 2018 lights up 7/7 for the default majors, 2022 5/7. Scar notch at fractional-year date + underwater band to recovery. |
| 3 | Climate Years (`climate/`) | built, verified | Circular stats on scar trough angles: score = breadth × R (mean resultant length). **2020 is the top climate year (breadth 37%, R 0.923 — scars in a ~3-week window); 2022 has MORE breadth (40%) but 2.3× less concentration (R 0.405, spread over autumn).** 2026 ranks #2 (breadth 42%, R 0.715) on the real mid-2026 crypto crash. Low-sample years (<30 trees) excluded honestly. |
| 4 | Fire Ecology (`fire/`) | built, verified | Serotiny = mean post-burn-year log return − median year log return (≥2 burns). Top: LUNC +2.82, FET, DOGE, RIOT; bottom: CRO −1.41. **Vol confound checked: r = 0.31 — mild, not the story.** Class regrowth curves per named crash (crypto +30x 24mo post-COVID, signed-log axis). Survivorship caveat prominent. |
| 5 | Master Chronology (`chronology/`) | built, verified | Class-median reference trees + sign-agreement and dispersion scores. Tightness: bonds 84.1% > crypto 83.4% > equity 72.0% > fx 69.0% > commodities 66.8%. Subtlety: bonds 2022 has PERFECT sign-agreement yet breaks on dispersion — TLT's duration made it fall much harder than short paper. Breaks flagged vs each class's own baseline. |
| 6 | Name That Tree (`game/`) | built, verified | 49 featured majors ≥5 rings; neutral bark hides the class-hue giveaway; same-class distractors. Two modes (name it / class only), streaks, computed fact line on reveal. The game's difficulty is the test of the encoding's information content. |
| 7 | Poster (`poster/`) | built, verified | 4096×5120 offscreen render, PNG download verified. Grain jitter ∝ real class-normalized vol (deterministic seed, no random decoration); computed title block; collision-avoiding scar callouts; honest partial-year notch arcs (featured tickers only — `mr` limitation). Dark + warm-paper themes. |
| 8 | The Forest Grows (`growth/`) | built, needs visual review | Animated year scrubber/playback across the 50 featured ring glyphs. Trees enter when their data begins; radius grows as their available rings accumulate; named climate events are annotated. |
| 9 | Standing Forest (`standing/`) | built, needs visual review | A 2D forest whose height, trunk width, crown reach/density, branch irregularity, and trunk cuts derive from age, accumulated ring growth, CAGR, positive-year share, volatility, and drawdowns. Click-to-inspect and cut-open cross-section. |
| 10 | Living Grove (`living-grove/`) | built, needs visual review | User-entered weighted portfolio as standing trees. Allocation is encoded separately as plot width on a shared baseline; includes presets, historical scrubber, URL-hash sharing, and generated portfolio field note. |
| 11 | Forest Atlas (`atlas/`) | built, needs visual review | Candidate central page with 3/5/7 trees per row, historical playback, six meaningful sorts, large specimen inspection, and event-aware headline copy. Keeps all 50 featured assets available. |
| 12 | Forest Clearings (`clearings/`) | built, needs visual review | Groups the featured forest into labeled sections by asset class, first visible era, volatility temperament, or whether the asset carries a qualifying 2022 scar. Supports historical scrubbing and within-group sorting. |
| 13 | Market Terrain (`terrain/`) | built, needs visual review | Ring glyphs placed on honest x/y axes. Presets compare growth × volatility, age × worst drawdown, and positive-year share × growth; includes class filtering and glyph-size controls. |
| 14 | Detailed Arboretum (`arboretum/`) | built, needs visual review | Primary discovery candidate. Seven question-shaped ranked lenses with visible rank/metric, FLIP reordering animation, class/search/density filters, URL-persisted state, ring microscope, and cross-date mode for comparing one calendar ring across the collection. Playback removed: the available history is better inspected directly than animated. |
| 15 | Specimen Wall (`specimen-wall/`) | built, needs visual review | Maximum-detail comparison: four ranked assets per page, two across, with grain, January year axes, partial-year edges, scars, and directly adjacent summary statistics. Six ranking modes and class filters. |
| 16 | Full Specimen (`specimen/`) | built, needs visual review | Shareable full-page viewer opened from Arboretum or Specimen Wall via `?id=TICKER`. Enforces a square responsive canvas; includes ring microscope, previous/next and ticker navigation, complete stats, scar ledger, keyboard shortcuts, and origin-aware back link. Playback removed in favor of direct annual-band inspection. |

## Data facts worth keeping

- The **mid-2026 crypto crash is real** (BTC −40%, ETH −55%, SOL −59%, troughs Jun 2026, verified against raw lake prices). Trees carry still-open Jun-2026 scars; 2026 is the #2 climate year.
- `rings.json` monthly returns (`mr`) exist only for the 50 `featured` assets — anything needing sub-year angular detail (poster notches, partial arcs) degrades gracefully for the other 434.
- Composite/portfolio math caveats live in grove's explainer: annual rebalancing assumed, composite vol is weight-averaged (ignores correlation).

## Follow-up ideas (from the brainstorm, not yet built)

- Cross-dating score per year → already shipped in climate; master-chronology overlay per glyph still open.
- Fire ecology v2: block-bootstrap null for serotiny; delisted-asset lake would kill the survivorship caveat.
- Poster shop: print/checkout flow if the poster prototype earns keep.
- The forest hums: port sonify (physics repo P7) onto the forest as ambient audio.
