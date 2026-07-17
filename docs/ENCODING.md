# Money Trees encoding contract

The cross-section is a compact financial record, not decorative generative art. Every true annual band corresponds to one calendar-year record in `data/rings.json`.

## Annual bands

- **Width — annual growth.** Band thickness is a monotone, log-compressed mapping of annual log total return. Better years are always wider. A floor keeps negative years visible.
- **Hue — direction and magnitude.** Annual log return maps from loss red through flat tan to gain green. The scale is normalized within asset class so a good bond year remains legible beside crypto.
- **Darkness — realized volatility.** Annualized daily log-return volatility darkens each band, also normalized within asset class.
- **Internal grain — volatility texture.** Four deterministic contours sit inside each annual band. Their displacement amplitude derives from that year's class-normalized volatility. They add resolution without pretending to be additional years.
- **Partial arcs — incomplete calendar years.** First and last years render only the months actually observed. Monthly coverage is available for featured assets; other assets degrade to a full annual band.

Asset class is encoded on the bark and label, not the band fill: crypto amber, equity blue, bonds green, commodities orange, and FX magenta.

## Scars

A scar is a whole-history drawdown episode, not simply the worst dip within an annual band. It qualifies when its depth exceeds the asset's median full-year realized-volatility threshold, clamped to 15–50%, and remains underwater for at least 120 days after the trough or is still open.

- The scar begins in the band containing the trough.
- Its angle is the trough's calendar date: January starts at the top and time moves clockwise.
- Its line weight increases with drawdown depth.
- It extends through later rings until the prior peak is recovered; unrecovered scars stay open to the bark.

This makes synchronized market events appear at similar angles across different trees.

## Product interactions

The Arboretum's ranked lenses use computed tree summaries: compound annual growth, mean volatility, number of visible years, worst drawdown, positive-year share, and unrecovered scars. Cross-date mode highlights the same calendar year across every visible tree. Full Specimen uses the identical renderer and data contract at a larger scale.

## Data limits

- The current lake covers roughly 2010–2026, with much of the cross-asset universe beginning around 2016. This is why historical playback is not a primary product interaction.
- The universe is survivor-biased: delisted and failed assets absent from the lake cannot contribute rings or scars.
- Monthly returns used for honest partial-year arcs are emitted only for the 50 featured assets.
- Class-relative normalization supports comparison of each asset with its peers, but color darkness should not be read as an absolute cross-class volatility scale.

The canonical implementation lives in `scripts/bake-rings.py` and `shared/tree-renderer.js`. Encoding changes should update both code and this document in the same commit.
