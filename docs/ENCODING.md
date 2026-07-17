# Money Trees encoding contract

The cross-section is a compact financial record, not decorative generative art. Every true annual band corresponds to one calendar-year record in `data/rings.json`.

## Annual bands

- **Width — annual growth.** Band thickness is a monotone, log-compressed mapping of annual log total return. Better years are always wider. A floor keeps negative years visible.
- **Hue — direction and magnitude.** Annual log return maps from loss red through flat tan to gain green. The scale is normalized within asset class so a good bond year remains legible beside crypto.
- **Darkness — realized volatility.** Annualized daily log-return volatility darkens each band, also normalized within asset class.
- **Boundary irregularity — volatility texture.** Every visible concentric boundary remains one calendar year. Its subtle waviness increases with that year's class-normalized realized volatility, reinforcing the darkness channel without introducing false rings. At Full Specimen scale only, a few restrained radial fibers add the same volatility texture without running parallel to the annual boundaries.
- **Incomplete calendar years.** First and last years still render as complete circular bands. Their statistics use only the days actually observed, and inspection text labels them as partial. The data window should not make a tree look as though a wedge of wood is missing.

Asset class is encoded on the bark and label, not the band fill: crypto amber, equity blue, bonds green, commodities orange, and FX magenta.

## Scars

A scar is a whole-history drawdown episode, not simply the worst dip within an annual band. It qualifies when its depth exceeds the asset's median full-year realized-volatility threshold, clamped to 15–50%, and remains underwater for at least 120 days after the trough or is still open.

- The wound begins in the band containing the trough.
- Its general angle is anchored to the trough's calendar date: January starts at the top and time moves clockwise.
- Its irregular width increases with drawdown depth. Deterministic meander and asymmetric edges keep it organic without inventing a new financial variable.
- It extends through later rings until the prior peak is recovered, tapering into a callus at the actual recovery ring. Unrecovered wounds remain open through the bark.

This makes synchronized market events appear at similar angles across different trees.

## Product interactions

The Arboretum's ranked lenses use computed tree summaries: compound annual growth, mean volatility, number of visible years, worst drawdown, positive-year share, and unrecovered scars. Cross-date mode highlights the same calendar year across every visible tree. Full Specimen uses the identical renderer and data contract at a larger scale.

## Data limits

- The current lake covers roughly 2010–2026, with much of the cross-asset universe beginning around 2016. This is why historical playback is not a primary product interaction.
- The universe is survivor-biased: delisted and failed assets absent from the lake cannot contribute rings or scars.
- Monthly returns are emitted only for the 50 featured assets. Production does not use them to remove ring geometry; they remain available to archived research experiments.
- Class-relative normalization supports comparison of each asset with its peers, but color darkness should not be read as an absolute cross-class volatility scale.

The canonical implementation lives in `scripts/bake-rings.py` and `shared/tree-renderer.js`. Encoding changes should update both code and this document in the same commit.
