#!/usr/bin/env python3
"""
Climate years — do the forest's scars line up at the same calendar angle in
the same year?  A single tree's scar is just a bad year for one asset.  When
many trees across many classes scar at once AND their trough dates cluster at
the same angle (the same week of the same year), that's a market-wide event —
a "climate year" for the whole forest, not weather for one tree.

SCORE DEFINITION
-----------------
Built entirely from forest/prep.py's already-computed scars (data/rings.json;
scar = a whole-history drawdown episode deeper than the asset's own severity
gate, trough-anchored at its calendar angle, Jan 1 = 0, clockwise). No new
gate, no parquet re-read — this prototype is a re-aggregation of the seed
viz's own scar list by the scar's TROUGH YEAR.

For every calendar year Y, over the scars whose trough fell in Y:

  n_scars   = count of scars troughing in Y
  n_alive   = count of trees with any ring in Y (first_year <= Y <= last_year)
  breadth   = n_scars / n_alive
              -> what fraction of the living forest got a fresh scar this year.
                 Can exceed 1 if some tree scarred twice in one year (rare).

  R (mean resultant length) = circular concentration of the scar angles.
              Treat each scar's angle in [0,1) as a unit vector at
              theta = angle * 2*pi on the unit circle; R = |mean of unit
              vectors|, in [0,1].  R -> 1 means every scar troughed in the
              same narrow calendar window (a single synchronized shock);
              R -> 0 means scars scattered evenly across the year (unrelated
              bad-year clustering, not a single dated event).  n_scars=0 ->
              R undefined, set to 0.  n_scars=1 -> R=1 trivially (a lone
              vector has full "concentration" with itself).

  score     = breadth * R
              -> "how much of the forest scarred, AND how tightly their
                 wounds line up on the calendar."  A year can have high
                 breadth but low score (many scars, but spread across the
                 year -> not one event, see 2022 below); or high R but low
                 score (one perfectly-dated scar in a tiny corner of the
                 forest -> not a forest-wide event).

Same three numbers (n_scars, n_alive, breadth, R, score) are also broken out
per asset class, so a "crypto winter" that barely touches bonds is visible as
a high crypto sub-score next to a near-zero bonds sub-score in the same year.

HARD GATE
---------
Every number here is read straight off data/rings.json's `scars` field
(computed by forest/prep.py from real daily closes) or trivially derived
(counts, circular mean/R). No score is hand-tuned or invented to make a
famous year look right — if 2008-style events aren't in the 2010-2026 lake,
or a "famous" year's scars are spread thin, the score says so.

CAVEATS (surfaced in the page's explainer panel, not just here)
-----------------------------------------------------------------
  * Survivor-biased universe: only assets that exist as parquet files today,
    with >= 3 full calendar years, are trees at all. A dead 2018 ICO that
    delisted before accumulating history never got a tree, so it can't
    contribute a scar to any year -- 2018's crypto breadth is a floor, not
    the true rate.
  * The scar gate itself (forest/prep.py): a drawdown only becomes a scar if
    it clears the asset's OWN median-vol-derived threshold (15%..50%) AND
    stays underwater >= 120 days past the trough. Fast V-shaped dips (even
    deep ones) never enter this dataset, so "breadth" undercounts raw
    volatility -- it counts SCARS, not dips.
  * The lake here only spans 2010-2026, so pre-2010 climate years (2000,
    2008) are structurally invisible -- absence isn't evidence they were
    calm.
  * n_alive grows over the window (crypto barely existed pre-2016), so early
    years' breadth is computed over a small, unrepresentative sub-forest.

Emits data/climate.json (rounded floats; well under 1MB -- this is 826 scars
worth of re-aggregation, not new time series).

Run from repo root: python3 climate/prep.py
"""
import json
import math
import os
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RINGS = os.path.join(REPO, "data", "rings.json")
SPANS = os.path.join(REPO, "shared", "spans.json")
OUT = os.path.join(REPO, "data", "climate.json")

CLASSES = ["crypto", "equity", "bonds", "commodities", "fx"]


def circular_stats(angles):
    """Mean resultant length R in [0,1] + mean angle in [0,1) for a list of
    scar angles (fraction-of-year, Jan 1 = 0). Empty -> (0.0, None)."""
    if not angles:
        return 0.0, None
    xs = [math.cos(a * 2 * math.pi) for a in angles]
    ys = [math.sin(a * 2 * math.pi) for a in angles]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    R = math.hypot(mx, my)
    mean_angle = (math.atan2(my, mx) / (2 * math.pi)) % 1.0
    return R, mean_angle


def year_bucket(scars_with_meta, alive_by_year, alive_by_year_cls):
    """Group scars by trough year; compute breadth/R/score per year and per
    class within year. scars_with_meta: list of (scar_dict, tree_meta)."""
    by_year = defaultdict(list)
    for sc, meta in scars_with_meta:
        by_year[sc["year"]].append((sc, meta))

    years_out = []
    all_years = sorted(set(list(by_year.keys()) + list(alive_by_year.keys())))
    for y in all_years:
        entries = by_year.get(y, [])
        n_alive = alive_by_year.get(y, 0)
        if n_alive == 0:
            continue
        angles = [sc["angle"] for sc, _ in entries]
        R, mean_angle = circular_stats(angles)
        breadth = len(entries) / n_alive if n_alive else 0.0
        score = breadth * R

        by_class = {}
        for cls in CLASSES:
            cls_entries = [(sc, m) for sc, m in entries if m["cls"] == cls]
            cls_alive = alive_by_year_cls.get((y, cls), 0)
            if cls_alive == 0:
                continue
            cls_angles = [sc["angle"] for sc, _ in cls_entries]
            cR, cmean = circular_stats(cls_angles)
            cbreadth = len(cls_entries) / cls_alive if cls_alive else 0.0
            by_class[cls] = {
                "n_scars": len(cls_entries),
                "n_alive": cls_alive,
                "breadth": round(cbreadth, 4),
                "R": round(cR, 4),
                "mean_angle": round(cmean, 4) if cmean is not None else None,
                "score": round(cbreadth * cR, 4),
            }

        scars_out = []
        for sc, meta in sorted(entries, key=lambda e: e[0]["angle"]):
            scars_out.append({
                "id": meta["id"],
                "cls": meta["cls"],
                "angle": sc["angle"],
                "depth": sc["depth"],
                "date": sc["date"],
                "age_years": meta["age_years"],
                "n_rings": meta["n_rings"],
                "n_scars_total": meta["n_scars_total"],
                "recovered": sc["r_year"] is not None,
            })

        years_out.append({
            "year": y,
            "n_scars": len(entries),
            "n_alive": n_alive,
            "breadth": round(breadth, 4),
            "R": round(R, 4),
            "mean_angle": round(mean_angle, 4) if mean_angle is not None else None,
            "score": round(score, 4),
            "classes": by_class,
            "scars": scars_out,
        })
    return years_out


def load_events():
    if not os.path.exists(SPANS):
        return {}
    with open(SPANS) as f:
        spans = json.load(f)
    events_by_year = defaultdict(list)
    import datetime
    for ev in spans.get("events", []):
        end_year = int(ev["end"][:4])
        events_by_year[end_year].append(ev["name"])
    return {y: names for y, names in events_by_year.items()}


def main():
    with open(RINGS) as f:
        rings = json.load(f)
    trees = rings["trees"]

    # Per-tree lightweight metadata for scar entries + alive-year lookups.
    scars_with_meta = []
    alive_by_year = defaultdict(int)     # year -> n trees alive
    alive_by_year_cls = defaultdict(int)  # (year, cls) -> n trees alive

    for t in trees:
        meta = {
            "id": t["id"],
            "cls": t["cls"],
            "age_years": t["age_years"],
            "n_rings": t["n_rings"],
            "n_scars_total": len(t["scars"]),
        }
        for y in range(t["first_year"], t["last_year"] + 1):
            alive_by_year[y] += 1
            alive_by_year_cls[(y, t["cls"])] += 1
        for sc in t["scars"]:
            scars_with_meta.append((sc, meta))

    years_out = year_bucket(scars_with_meta, alive_by_year, alive_by_year_cls)
    years_out.sort(key=lambda r: r["year"])

    # Early years (2010-13) have a handful of trees, mostly BTC + a couple of
    # majors. A single scar there can post a perfect R=1 purely because
    # there's nothing else in the forest to disagree with the angle -- real
    # concentration, but on a sample too small to call a "forest climate".
    # Flag rather than hide (the hard gate: show it honestly), and keep the
    # ranked-headline list restricted to years with a real forest to score.
    MIN_ALIVE_FOR_RANK = 30
    for r in years_out:
        r["low_sample"] = r["n_alive"] < MIN_ALIVE_FOR_RANK

    def top_view(rows):
        return [{"year": r["year"], "score": r["score"], "breadth": r["breadth"],
                 "R": r["R"], "n_scars": r["n_scars"], "n_alive": r["n_alive"],
                 "low_sample": r["low_sample"]} for r in rows]

    top_years_all = top_view(sorted(years_out, key=lambda r: r["score"], reverse=True)[:10])
    ranked = [r for r in years_out if not r["low_sample"]]
    top_years_ranked = top_view(sorted(ranked, key=lambda r: r["score"], reverse=True)[:10])

    events_by_year = load_events()

    out = {
        "generated": rings.get("generated"),
        "n_trees_total": len(trees),
        "classes": CLASSES,
        "min_alive_for_rank": MIN_ALIVE_FOR_RANK,
        "years": years_out,
        "top_years_all": top_years_all,
        "top_years_ranked": top_years_ranked,
        "events_by_year": events_by_year,
        "notes": {
            "score": "breadth (n_scars / n_trees_alive) x R (mean resultant "
                      "length of scar trough angles, circular concentration "
                      "0..1)",
            "gate": "scars are forest/prep.py's whole-history drawdown "
                    "episodes: depth beyond the asset's own vol-derived "
                    "threshold (15%..50%), underwater >=120 days past "
                    "trough. Not every dip is a scar.",
            "low_sample": f"years with fewer than {MIN_ALIVE_FOR_RANK} trees "
                           "alive are flagged low_sample=true -- a lone scar "
                           "there can fake a perfect R with nothing to "
                           "disagree with it. Excluded from the ranked "
                           "headline list, still shown (honestly, dim) on "
                           "the timeline.",
        },
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}  ({size_kb:.1f} KB)")
    print(f"years: {len(years_out)}")
    print("top climate years (ranked, n_alive >= 30):")
    for r in top_years_ranked[:8]:
        print(f"  {r['year']}  score={r['score']:.3f}  breadth={r['breadth']:.3f}"
              f"  R={r['R']:.3f}  n_scars={r['n_scars']}/{r['n_alive']}")
    y2020 = next((r for r in years_out if r["year"] == 2020), None)
    y2022 = next((r for r in years_out if r["year"] == 2022), None)
    if y2020 and y2022:
        print(f"2020 R={y2020['R']:.3f}  vs  2022 R={y2022['R']:.3f}")


if __name__ == "__main__":
    main()
