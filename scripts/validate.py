#!/usr/bin/env python3
"""Structural validation of a Money Trees ring artifact.

Checks the *contract* — schema, geometry and statistics — against whatever
`data/rings.json` happens to contain, so the script is equally usable on the
production forest and on an experimental one baked from a different lake.

Asset presence is a separate, opt-in concern:

    python3 scripts/validate.py                       # structure only
    python3 scripts/validate.py --expect-featured     # + every id in bake-rings FEATURED
    python3 scripts/validate.py --expect-tickers btc,eth,spy
    python3 scripts/validate.py --rings path/to/rings.json

CI keeps `--expect-featured` on so a missing production asset still fails the
build; experimental forests just omit the flag.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RINGS = ROOT / "data" / "rings.json"
BAKE = ROOT / "scripts" / "bake-rings.py"

CLASSES = {"crypto", "equity", "bonds", "commodities", "fx"}
RING_NUMERIC = ("ret", "log_growth", "vol", "max_dd")
TREE_KEYS = ("id", "cls", "name", "rings", "n_rings", "first_year", "last_year", "data_through")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

problems: list[str] = []
warnings: list[str] = []


def check(condition: object, message: str, *, soft: bool = False) -> None:
    """Record a contract violation. `soft` reports it without failing the run."""
    if not condition:
        (warnings if soft else problems).append(message)


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def featured_ids_from_bake() -> set[str]:
    """Read the FEATURED list out of bake-rings.py without importing it.

    The bake module pulls in pandas and the lake path at import time; the list
    itself is a plain literal, so parse it instead.
    """
    source = BAKE.read_text()
    match = re.search(r"^FEATURED\s*=\s*\[(.*?)\]", source, re.S | re.M)
    if not match:
        raise SystemExit("could not locate FEATURED in scripts/bake-rings.py")
    return {t.lower() for t in re.findall(r"[\"']([^\"']+)[\"']", match.group(1))}


def validate_norm(norm: object) -> None:
    check(isinstance(norm, dict), "norm block missing or not an object")
    if not isinstance(norm, dict):
        return
    for key in ("lg_p5", "lg_p95", "vol_p10", "vol_p90"):
        check(finite(norm.get(key)), f"norm.{key} missing or not finite")
    if finite(norm.get("lg_p5")) and finite(norm.get("lg_p95")):
        check(norm["lg_p5"] < norm["lg_p95"], "norm.lg_p5 must be below norm.lg_p95")
    if finite(norm.get("vol_p10")) and finite(norm.get("vol_p90")):
        check(0 <= norm["vol_p10"] < norm["vol_p90"], "norm vol percentiles out of order or negative")
    for block in ("vol_cls", "lg_cls"):
        pairs = norm.get(block)
        check(isinstance(pairs, dict) and pairs, f"norm.{block} missing or empty")
        if not isinstance(pairs, dict):
            continue
        for cls, bounds in pairs.items():
            check(cls in CLASSES, f"norm.{block}: unknown asset class {cls!r}")
            ok = isinstance(bounds, list) and len(bounds) == 2 and all(finite(b) for b in bounds)
            check(ok, f"norm.{block}[{cls}] must be a [lo, hi] pair of finite numbers")
            if ok:
                check(bounds[0] < bounds[1], f"norm.{block}[{cls}] bounds out of order")


def validate_tree(tree: dict) -> None:
    ticker = tree.get("id", "<missing>")
    # Only featured trees render, so a gap in a non-featured record is reported
    # but does not fail the run — the artifact still carries the whole universe.
    soft = not tree.get("featured")
    for key in TREE_KEYS:
        check(key in tree, f"{ticker}: missing key {key!r}")
    check(tree.get("cls") in CLASSES, f"{ticker}: invalid asset class {tree.get('cls')!r}")
    check(bool(tree.get("name")), f"{ticker}: missing display name")
    check(bool(tree.get("data_through")), f"{ticker}: missing data_through")

    rings = tree.get("rings") or []
    check(bool(rings), f"{ticker}: no rings")
    years = [ring.get("year") for ring in rings]
    check(all(isinstance(y, int) for y in years), f"{ticker}: non-integer ring year")
    if years and all(isinstance(y, int) for y in years):
        # Contiguity: a tree ring record is one band per calendar year, no gaps.
        expected = list(range(years[0], years[0] + len(years)))
        check(years == expected, f"{ticker}: ring years are not contiguous and ascending", soft=soft)
        check(tree.get("first_year") == years[0], f"{ticker}: first_year does not match first ring")
        check(tree.get("last_year") == years[-1], f"{ticker}: last_year does not match last ring")
    check(tree.get("n_rings") == len(rings), f"{ticker}: n_rings does not match the ring list")

    year_set = set(years)
    for ring in rings:
        year = ring.get("year")
        for field in RING_NUMERIC:
            check(finite(ring.get(field)), f"{ticker} {year}: {field} missing or not finite")
        if finite(ring.get("vol")):
            check(ring["vol"] >= 0, f"{ticker} {year}: negative volatility")
        if finite(ring.get("max_dd")):
            check(-1.0001 <= ring["max_dd"] <= 0, f"{ticker} {year}: max_dd outside [-1, 0]")
        if finite(ring.get("ret")):
            check(ring["ret"] > -1.0001, f"{ticker} {year}: return below -100%")
        angle = ring.get("scar_angle")
        if angle is not None:
            check(finite(angle) and 0 <= angle <= 1, f"{ticker} {year}: scar_angle outside [0, 1]")

    for scar in tree.get("scars") or []:
        year = scar.get("year")
        check(year in year_set, f"{ticker}: scar year {year} has no matching ring")
        depth = scar.get("depth")
        check(finite(depth) and -1.0001 <= depth <= 0, f"{ticker} {year}: scar depth outside [-1, 0]")
        for key in ("angle", "r_angle"):
            value = scar.get(key)
            if value is not None:
                check(finite(value) and 0 <= value <= 1, f"{ticker} {year}: scar {key} outside [0, 1]")
        for key in ("date", "peak_date", "r_date"):
            value = scar.get(key)
            if value is not None:
                check(bool(DATE.match(str(value))), f"{ticker} {year}: scar {key} is not YYYY-MM-DD")
        recovery = scar.get("r_year")
        if recovery is not None:
            check(
                isinstance(recovery, int) and recovery >= year,
                f"{ticker} {year}: scar recovery year precedes the trough",
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rings", type=Path, default=RINGS, help="ring artifact to validate")
    parser.add_argument(
        "--expect-featured",
        action="store_true",
        help="also require every id in bake-rings.py FEATURED to be present and featured",
    )
    parser.add_argument(
        "--expect-tickers",
        default="",
        help="comma-separated ids that must be present and featured",
    )
    args = parser.parse_args()

    with args.rings.open() as fh:
        data = json.load(fh)

    trees = data.get("trees", [])
    check(isinstance(trees, list) and bool(trees), "no trees in artifact")
    ids = [tree.get("id") for tree in trees]
    featured = [tree for tree in trees if tree.get("featured")]

    check(data.get("schema_version") == 1, "unsupported or missing schema_version")
    check(data.get("n_trees") == len(trees), "n_trees does not match tree records")
    check(data.get("n_featured") == len(featured), "n_featured does not match featured records")
    check(len(ids) == len(set(ids)), "duplicate tree ids")
    check(bool(data.get("data_through")), "missing top-level data_through")
    validate_norm(data.get("norm"))

    for tree in trees:
        if isinstance(tree, dict):
            validate_tree(tree)
        else:
            problems.append("tree record is not an object")

    expected = {t.strip().lower() for t in args.expect_tickers.split(",") if t.strip()}
    if args.expect_featured:
        expected |= featured_ids_from_bake()
    if expected:
        featured_ids = {tree.get("id") for tree in featured}
        missing = sorted(expected - set(ids))
        check(not missing, f"missing required trees: {missing}")
        not_featured = sorted(expected & set(ids) - featured_ids)
        check(not not_featured, f"required trees are not featured: {not_featured}")

    for warning in warnings:
        print(f"WARN {warning}", file=sys.stderr)

    if problems:
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        print(f"{len(problems)} validation problem(s)", file=sys.stderr)
        return 1

    scope = f", {len(expected)} required ids present" if expected else ""
    print(
        f"validated {len(trees)} trees, {len(featured)} featured, "
        f"{sum(len(tree.get('rings') or []) for tree in trees)} rings{scope}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
