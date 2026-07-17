# HANDOFF — Money Trees

Last updated: 2026-07-17

## Current product

The Detailed Arboretum is now the main app at `/`. It provides question-shaped rank lenses, animated reordering, class/search/density filters, URL-persisted state, band inspection, and cross-date comparison. Every card opens the shareable Full Specimen route at `/specimen/?id=TICKER`.

Historical playback was intentionally left out: the 2010–2026, mostly post-2016 sample is more valuable for direct comparison than animation.

## Architecture

- `index.html` is the small production shell.
- `app/arboretum.*` and `app/specimen.*` own product behavior and page-specific styles.
- `shared/tree-renderer.js` and `shared/tokens.css` are the only shared production presentation layer.
- `data/rings.json` is the sole production data artifact; `scripts/bake-rings.py` creates it.
- `labs/` is a standalone catalog. Every experiment is frozen and self-contained. Production imports nothing from it.
- `docs/ENCODING.md` is the visual grammar and caveat contract.

Serve the repository with `python3 -m http.server 8081`. No build step is required.

## Product direction

The current spine is deliberately narrow: discover and compare in the Arboretum, then inspect one complete specimen. The lab retains the alternate forests, poster, portfolio, research, and game explorations for future promotion without keeping them in the product navigation.

## Known limits

- Monthly-return detail exists only for the 50 featured assets.
- The source universe is survivor-biased.
- The open mid-2026 crypto scars are present in the underlying data, not rendering artifacts.
- Portfolio Grove's composite volatility is a weight-average approximation that ignores correlation.

Detailed experiment findings and historical verdicts remain in `NOTES.md`.
