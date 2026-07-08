#!/usr/bin/env python3
"""
Master chronology — dendrochronology's reference tree, one per asset class.

A real dendrochronologist doesn't just look at one tree's rings; they build a
MASTER CHRONOLOGY by overlaying many trees of the same species from the same
stand and taking, ring by ring, the composite pattern the whole stand agrees
on. Individual trees are then "cross-dated" against that master — how well
does THIS tree's ring pattern track the reference?

We do the same thing per asset class. For crypto/equity/bonds/commodities/fx,
for every calendar year where the class has >= MIN_MEMBERS "alive" members
(assets with a computed ring that year), we build a synthetic MASTER RING:

  * master log-growth = median(member log_growth)     -- drives ring width
  * master vol         = median(member vol)             -- drives ring darkness
  * master ret          = expm1(master log-growth)       -- derived, so width/
                           color/tooltip ret are all consistent with the same
                           underlying number (median commutes with monotone
                           transforms almost exactly; deriving ret this way
                           makes it exact)

Two AGREEMENT scores per class-year, both computed on real member data:

  * agreement (sign score)  = fraction of members whose year sign (up/down)
                               matches the master's sign. 1.0 = every member
                               moved the same direction as the class; low
                               values = a genuinely split year.
  * mad_log_ret (dispersion)= median absolute deviation of member log-returns
                               around the master log-return. Stricter than the
                               sign score: two classes can agree on sign every
                               year and still differ wildly in how far members
                               scatter from the master magnitude.

Per class we also emit:
  * mean_agreement          = mean of the sign-agreement score across years —
                               the "chronology tightness" headline. Higher =
                               the class's members move together more
                               consistently.
  * years_broke_agreement   = years that broke from this class's own normal
                               pattern, by EITHER measure: sign-agreement more
                               than 1 class-stdev below the class's own mean
                               (a genuinely split year), OR mad_log_ret more
                               than 1 class-stdev above the class's own mean
                               (a year everyone agreed on direction but
                               disagreed wildly on magnitude — e.g. 2022 bonds,
                               where every bond fell (sign-agreement ~1.0) but
                               long-duration TLT fell far harder than short
                               paper, so dispersion still spikes). Each broken
                               year is tagged with which measure tripped it.
  * most_divergent           = the single (asset, year) pair with the largest
                               |member log_growth - master log_growth| within
                               that class — the biggest lone-wolf ring.

Reads data/rings.json (already baked by forest/prep.py from the price lake) —
no lake access needed, this is a pure re-aggregation of existing per-asset
annual stats.

Emits chronology/../data/chronology.json (tiny — a few years x 5 classes).

Run from repo root:  python3 chronology/prep.py
"""
import json
import math
import os
import statistics
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RINGS = os.path.join(REPO, "data", "rings.json")
OUT = os.path.join(REPO, "data", "chronology.json")

MIN_MEMBERS = 8
CLASS_ORDER = ["crypto", "equity", "bonds", "commodities", "fx"]


def r(x, n=5):
    return round(x, n) if x is not None else None


def main():
    with open(RINGS) as f:
        data = json.load(f)
    trees = data["trees"]

    # cls -> year -> [(asset_id, ring_dict), ...]
    by_class_year = defaultdict(lambda: defaultdict(list))
    for t in trees:
        cls = t["cls"]
        for ring in t["rings"]:
            by_class_year[cls][ring["year"]].append((t["id"], ring))

    classes_out = {}
    for cls in CLASS_ORDER:
        year_map = by_class_year.get(cls, {})
        years = sorted(year_map.keys())
        master_rings = []
        deviations = []  # (dev, asset_id, year, member_lg, master_lg, member_ret, master_ret)

        for yr in years:
            members = year_map[yr]
            if len(members) < MIN_MEMBERS:
                continue
            lgs = [rg["log_growth"] for _, rg in members]
            vols = [rg["vol"] for _, rg in members]
            master_lg = statistics.median(lgs)
            master_vol = statistics.median(vols)
            master_ret = math.expm1(master_lg)
            agree = sum(1 for lg in lgs if (lg >= 0) == (master_lg >= 0)) / len(lgs)
            mad = statistics.median([abs(lg - master_lg) for lg in lgs])

            master_rings.append({
                "year": yr,
                "n": len(members),
                "log_growth": r(master_lg),
                "ret": r(master_ret),
                "vol": r(master_vol),
                "agreement": r(agree, 4),
                "mad_log_ret": r(mad, 5),
            })
            for aid, rg in members:
                dev = abs(rg["log_growth"] - master_lg)
                deviations.append((dev, aid, yr, rg["log_growth"], master_lg, rg["ret"], master_ret))

        if not master_rings:
            continue

        agreements = [m["agreement"] for m in master_rings]
        mads = [m["mad_log_ret"] for m in master_rings]
        mean_agreement = sum(agreements) / len(agreements)
        mean_mad = sum(mads) / len(mads)
        # "broke agreement" = unusually off this class's own norm, relative to
        # ITS OWN baseline (not an absolute threshold — a naturally scattered
        # class like crypto and a naturally lockstep class like bonds have very
        # different normal ranges). Two ways a year can break:
        #   - sign-agreement > 1 stdev BELOW the class mean -> a split year
        #   - mad_log_ret    > 1 stdev ABOVE the class mean -> everyone agreed
        #     on direction but scattered unusually hard in magnitude
        if len(agreements) >= 3:
            astd = statistics.pstdev(agreements)
            mstd = statistics.pstdev(mads)
        else:
            astd = mstd = 0.0
        Z_CUT = 1.2  # stdevs off the class's own baseline to count as "broke"
        broke = []
        for m in master_rings:
            z_sign = (mean_agreement - m["agreement"]) / astd if astd > 0 else 0.0
            z_mad = (m["mad_log_ret"] - mean_mad) / mstd if mstd > 0 else 0.0
            reasons = []
            if z_sign > Z_CUT:
                reasons.append("sign")
            if z_mad > Z_CUT:
                reasons.append("dispersion")
            if reasons:
                broke.append({"year": m["year"], "reasons": reasons,
                               "agreement": m["agreement"], "mad_log_ret": m["mad_log_ret"],
                               "severity": r(max(z_sign, z_mad), 3)})
        broke.sort(key=lambda b: b["year"])
        worst = min(master_rings, key=lambda m: m["agreement"])

        deviations.sort(key=lambda d: -d[0])
        top = deviations[0]

        classes_out[cls] = {
            "master_rings": master_rings,
            "mean_agreement": r(mean_agreement, 4),
            "agreement_stdev": r(astd, 4),
            "mean_mad_log_ret": r(mean_mad, 5),
            "years_broke_agreement": broke,
            "worst_agreement_year": {"year": worst["year"], "agreement": worst["agreement"]},
            "most_divergent": {
                "asset": top[1],
                "year": top[2],
                "member_log_growth": r(top[3]),
                "master_log_growth": r(top[4]),
                "member_ret": r(top[5]),
                "master_ret": r(top[6]),
                "deviation": r(top[0]),
            },
        }

    out = {
        "generated": data["generated"],
        "min_members": MIN_MEMBERS,
        "class_order": [c for c in CLASS_ORDER if c in classes_out],
        "classes": classes_out,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    sz = os.path.getsize(OUT)
    print(f"wrote {OUT} ({sz:,} bytes)")

    ranking = sorted(classes_out.items(), key=lambda kv: -kv[1]["mean_agreement"])
    print("\nchronology tightness (mean sign-agreement, high -> low):")
    for cls, v in ranking:
        broke_years = [b["year"] for b in v["years_broke_agreement"]]
        print(f"  {cls:12s} mean_agreement={v['mean_agreement']:.3f}  "
              f"broke={broke_years}  "
              f"most_divergent={v['most_divergent']['asset']}/{v['most_divergent']['year']} "
              f"(dev={v['most_divergent']['deviation']:.3f})")


if __name__ == "__main__":
    main()
