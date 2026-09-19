# Money Tree Forest encoding contract

The cross-section is a compact financial record, not decorative generative art. Every true annual band corresponds to one calendar-year record in `data/rings.json`.

## Annual bands

- **Width — annual growth.** Band thickness is a monotone, log-compressed mapping of annual log total return, normalized within asset class on the same anchors color uses, so a bond's best year is as wide as a crypto asset's best year. Better years are always wider. A floor keeps negative years visible.
- **Color — return direction and magnitude.** Both color treatments use separated sign ramps so near-zero years cannot obscure direction. The default wood treatment assigns every negative year to heartwood and every positive year to sapwood. The optional market treatment assigns every negative year to red and every positive year to green. Within each sign, a gentle ease-in magnitude curve keeps ordinary returns near a mild shoulder color and reserves the strongest endpoint for genuinely exceptional years; only a truly flat year uses the middle tan/ochre. Both modes normalize magnitude within asset class so a good bond year remains legible beside crypto.
- **Darkness — realized volatility.** Annualized daily log-return volatility darkens each band, also normalized within asset class. The wood treatment deliberately bounds this darkening so a volatile positive year cannot become visually confusable with a negative year.
- **Boundary irregularity — volatility texture.** Every visible concentric boundary remains one calendar year. Its subtle waviness increases with that year's class-normalized realized volatility, reinforcing the darkness channel without introducing false rings. At Tree page scale only, a few restrained radial fibers add the same volatility texture without running parallel to the annual boundaries.
- **Incomplete calendar years.** First and last years still render as complete circular bands. Their statistics use only the days actually observed, and inspection text labels them as partial. The data window should not make a tree look as though a wedge of wood is missing.

## Disc size

- **Radius — length of record (Forest only).** On the collection wall a tree's disc radius is `Rmax · min(1, (years / 100) ^ 0.35)`: an elder is visibly an elder and a short record is visibly a sapling. The 100-year reference is FIXED, never normalized to the oldest tree currently on screen, so adding an older tree later cannot silently resize the whole collection. The 0.35 exponent compresses the range enough that a 15-year record still reads at roughly half radius with legible bands. Tree page ignores this — a single tree is sized to the viewport, because there is nothing on the page to compare it against.

Asset class is encoded on the label only, not the bark or the band fill: crypto amber, equity blue, bonds green, commodities orange, and FX magenta. The bark is one dark natural rind on every tree, so the outer edge never reads as a colored halo; a tree is identified by its full name with the ticker beneath.

## Scars

A scar is a whole-history drawdown episode, not simply the worst dip within an annual band. It qualifies when its depth exceeds a gate set in the asset's own units — a fall of 1.25 median-annual-volatilities, in log space, floored at 10% — and remains underwater for at least 120 days after the trough or is still open. That is roughly a 12% fall for a currency fund, 20% for the S&P 500, 57% for Bitcoin. Episodes are measured from the all-time high; a second crash from an interim high inside a still-open episode (Bitcoin in March 2020, the US market in 1937–38) is a **nested** scar, measured from that interim high and healed when it is reclaimed.

- The wound begins in the band containing the trough.
- Its general angle is anchored to the trough's calendar date: January starts at the top and time moves clockwise.
- Its width increases with drawdown depth. Deterministic meander and asymmetric edges keep it organic without inventing a new financial variable; its visible weight is size-aware so it remains delicate on a full tree and legible on a card.
- It extends through later rings until the prior peak is recovered. Recovered wounds taper to a point at both the trough and recovery ends; unrecovered wounds taper at the trough and remain open through the bark.

This makes synchronized market events appear at similar angles across the forest. The scar copy always names the peak the depth is measured from, and marks nested scars as such.

The bake also publishes `climate_years`: for each calendar year with at least 30 living trees, the share of them whose scar troughed that year and the mean resultant length of those troughs' calendar angles; the top six by breadth × concentration lead the cross-date menu.

## Product interactions

The Forest treats structural family as the primary browsing taxonomy, then lets the collection be arranged by compound annual growth, mean volatility, number of visible years, worst drawdown, or positive-year share. Cross-date mode dims every other year and rings the selected one in gold on every visible tree, so it stays findable on a long record where one year is a hairline. Trees whose record does not reach that year simply show no highlight. A shared visual key ("How to read", built from `shared/reading-key.js`) explains width, color, darkness/grain, scars, and annual bands; it sits beside the color toggle and legend on both the Forest and the Tree page, so the controls that change how rings are drawn and the key that explains them are always together.

Tree page uses the identical renderer and data contract at a larger scale, preserves the originating collection context for navigation, and lets readers show or hide calendar-year labels. Its poster export renders the current tree, palette, and label preference to a 2400×3000 PNG with summary statistics and the same encoding key; it does not screenshot or rasterize the surrounding interface. The tree canvas zooms in place (scroll, pinch, double-click, the corner buttons, or `+` `-` `0` while focused): the wood is re-rendered at the zoomed resolution once a gesture settles, never CSS-scaled into blur, and year labels appear past about 1.6×. A full-screen immersive view (`?view=full`) does the same at viewport scale; hairlines and scar edges stay pinned to screen width while the wood scales. In full view, **Screenshot** (`S`) downloads what is on screen at device resolution with a caption strip (tree, span, zoom, the selected ring if any, and the site), for a crop that travels. The pith is painted as wood — the first ring's tone darkened, with a darker centre dot — rather than left as background.

## Whole-tree statistics

Every number the interface shows for a whole tree is computed once, in the bake, and read by the UI; nothing is re-derived from the rings in the browser.

- **Annualized growth (`cagr`)** compounds first close to last close over **calendar** time (`age_years`, elapsed days ÷ 365.25). Bar counts are never used as a clock: crypto trades 365 days a year, market-hours instruments about 252.
- **Annual return (`ret`)** runs from the prior year's last close to this year's last close, so the New Year's move belongs to the new ring. The first ring uses its own opening print.
- **Realized volatility (`vol`)** is the annualized standard deviation of daily log returns, scaled by the class's own bars per year (365 crypto, 252 otherwise). `mean_vol` and `positive` (share of up years) average over full rings only.
- **Worst drawdown (`worst_dd`)** is the deepest peak-to-trough fall over the whole history, the same number the collection sorts on.
- **A full ring** holds at least 60% of the asset's own trading days in that year; anything shorter is marked partial and excluded from the averages above (but still drawn).
- **Normalization anchors** (`norm`) are percentiles over the **featured** trees only, so the trees on the wall are never re-colored by trees that do not render.
- **Return basis (`basis`)** is `total` for the Ken French indexes, `adjusted` for the Twelve Data series (dividend- and split-adjusted closes, thinner adjustment before 2013) and `spot` for crypto. It is shown on every tree.

## Published precision

The published artifact carries derived statistics, never the underlying daily closes, and its returns are deliberately coarse so it cannot be inverted back into them:

- **Annual returns (`ret`) and monthly returns (`mr`) are rounded to a whole percent.** An exact annual return plus a single known price recovers the vendor's year-end adjusted close, and exact monthly returns recover the whole month-end ladder; a whole-percent grid does not. This is a licensing requirement of the equity data vendor, applied uniformly to every asset rather than per source.
- **`log_growth` is derived from the rounded return**, so the width and color encodings are exactly consistent with the number the interface reports.
- **Realized volatility, maximum drawdown, and CAGR keep their full precision.** They are path statistics over hundreds of observations and do not reconstruct a price series.

The visual cost is sub-pixel: band widths shift imperceptibly, and bands whose true return fell inside ±0.5% render as an exactly flat year — about 1.4% of all bands, but 7.8% of bond bands and 3.5% of FX bands, whose annual moves are small. Accumulated-growth multiples are therefore shown to two significant figures and derived from the full-precision `cagr`, not by compounding the rounded rings.

## Data limits

- Coverage varies substantially by asset. The century market and industry series begin in 1926, individual equities begin no earlier than 1970 (the first daily bar the equity vendor carries), currency funds generally begin in 2006–2007, Bitcoin begins in 2010, and younger crypto assets begin at their own market inception. This uneven coverage is why historical playback is not a primary product interaction.
- The universe is survivor-biased: delisted and failed assets absent from the lake cannot contribute rings or scars.
- Monthly returns are emitted only for the 100 featured assets. Production does not use them to remove ring geometry; they remain available to archived research experiments.
- Equity and fund returns use the closing-price series available in the lake and should not be assumed to include dividend reinvestment for every instrument.
- First and current calendar years can be partial. Inspection and the accessible annual ledger mark these records explicitly.
- Class-relative normalization supports comparison of each asset with its peers, but color darkness should not be read as an absolute cross-class volatility scale.

The canonical implementation lives in `scripts/bake-rings.py` and `shared/tree-renderer.js`. Encoding changes should update both code and this document in the same commit.
