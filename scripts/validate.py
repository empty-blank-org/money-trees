#!/usr/bin/env python3
"""Production artifact and source-contract checks for Money Trees."""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RINGS = ROOT / "data" / "rings.json"
REQUIRED_FEATURED = {
    "btc", "eth", "aapl", "spy", "ko", "xmr", "lunc", "asml", "mbb", "cper",
}
CLASSES = {"crypto", "equity", "bonds", "commodities", "fx"}


def fail(message: str) -> None:
    raise AssertionError(message)


def main() -> None:
    with RINGS.open() as fh:
        data = json.load(fh)

    trees = data.get("trees", [])
    ids = [tree.get("id") for tree in trees]
    featured = [tree for tree in trees if tree.get("featured")]

    if data.get("schema_version") != 1:
        fail("unsupported or missing schema_version")
    if data.get("n_trees") != len(trees):
        fail("n_trees does not match tree records")
    if data.get("n_featured") != len(featured):
        fail("n_featured does not match featured records")
    if len(ids) != len(set(ids)):
        fail("duplicate tree ids")
    if not REQUIRED_FEATURED.issubset(ids):
        fail(f"missing required trees: {sorted(REQUIRED_FEATURED - set(ids))}")
    if not REQUIRED_FEATURED.issubset({tree["id"] for tree in featured}):
        fail("required trees are not featured")
    if not data.get("data_through"):
        fail("missing top-level data_through")

    for tree in trees:
        ticker = tree.get("id", "<missing>")
        if tree.get("cls") not in CLASSES:
            fail(f"{ticker}: invalid asset class")
        if not tree.get("name"):
            fail(f"{ticker}: missing display name")
        rings = tree.get("rings", [])
        years = [ring.get("year") for ring in rings]
        if years != sorted(years) or len(years) != len(set(years)):
            fail(f"{ticker}: ring years are not ordered and unique")
        if tree.get("n_rings") != len(rings):
            fail(f"{ticker}: n_rings mismatch")
        if years and (tree.get("first_year") != years[0] or tree.get("last_year") != years[-1]):
            fail(f"{ticker}: first/last year mismatch")
        if not tree.get("data_through"):
            fail(f"{ticker}: missing data_through")
        for ring in rings:
            for field in ("ret", "log_growth", "vol", "max_dd"):
                value = ring.get(field)
                if not isinstance(value, (int, float)) or not math.isfinite(value):
                    fail(f"{ticker} {ring.get('year')}: invalid {field}")

    print(
        f"validated {len(trees)} trees, {len(featured)} featured, "
        f"{sum(len(tree['rings']) for tree in trees)} rings"
    )


if __name__ == "__main__":
    main()
