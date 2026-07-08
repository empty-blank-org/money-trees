#!/usr/bin/env python3
"""
Tree rings — each asset rendered as a tree cross-section, one ring per calendar
year of its life.  An asset's whole price history is readable in a single glyph;
a gallery of majors becomes a "forest" where old-growth bonds sit beside
fast-grown, scarred crypto.

DENDROCHRONOLOGY ANALOGY (and the hard gate)
--------------------------------------------
Every visual feature of a ring decodes to a REAL number computed on our real
daily price data.  Nothing is decorative:

  * ring WIDTH   = that year's growth.  width ∝ a monotone squash of the year's
                   log total return (log(1+r_year)).  Positive years grow wide,
                   negative years compress toward a thin floor, but every year
                   stays visible (a hard minimum width).  Monotone in log-return,
                   so a wider ring is unambiguously a better year.

  * ring COLOR   = one uniform color per ring, like real wood.  Hue runs a
                   diverging scale on the year's log return — red (bad year)
                   through parched tan (flat) to green (good) — normalized
                   WITHIN the asset class (class p5..p95), so "a good year for
                   its kind" is the same green on every tree and equities
                   aren't all washed-out tan next to crypto.  Realized vol
                   darkens the ring, normalized WITHIN class (class p10..p90):
                   calm years are light, violent years deep and dark, and
                   crypto isn't uniformly black.  The asset CLASS lives on
                   the bark outline + label hue (crypto amber / equity blue /
                   bonds green / commodities rust / fx teal), not the fill.

  * SCAR (radial seam) = a MAJOR drawdown episode, computed on the whole
                   history (not per-year).  Only episodes deeper than a
                   severity gate scar the tree: threshold = the asset's median
                   full-year vol, clamped to [15%, 50%] — so a 20% dip scars
                   SPY but not BTC, and any halving scars anything.  The scar
                   starts at the trough date (its ring + angular position,
                   Jan = top, clockwise) and RADIATES OUTWARD through every
                   later ring until the year price reclaimed the prior peak —
                   exactly like a real fire scar that subsequent rings grow
                   around until the bark closes over.  Depth ∝ drawdown
                   magnitude; an unrecovered drawdown stays open to the bark.
                   Because the angle is the calendar date, a market-wide event
                   (COVID = late March 2020) still carves scars at the SAME
                   angle across the forest — visible "climate years."

  * MONTHLY returns (`mr`) are still emitted per featured ring, but only to
                   drive partial-year arcs (first/last years render just the
                   months present).  The per-month tint overlay was cut: it
                   made rings read as red/green noise instead of wood, and a
                   ring should be one color.

Partial years
-------------
The first and last calendar year of an asset are almost never complete.  We
RENDER them as partial rings: the ring is drawn only across the angular arc of
months actually present (a partial-circumference band, not a full circle), and
the per-year stats are computed only over the days present.  This is honest —
a 3-month stub IPO year looks like a thin quarter-ring, not a full year.  The
ring's `partial` flag + `months` list drives the partial arc in the renderer.

Universe
--------
Every asset in data/prices/ with >= 3 calendar years that each have >= ~150
trading days (so a "full ring" really is a year of data).  All are computed;
the page caps the rendered forest at the most-relevant majors+extremes via a
`featured` flag, with a selector to swap any computed asset in.

Emits experiments/data/rings.json  (annual stats only — tiny, well under 1MB).

Run from the worktree root:  .venv/bin/python experiments/rings/prep.py
"""
import json
import os
import sys
import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = os.environ.get("EMPTY_DATA", "/Users/nmadd/Dropbox/code/empty-data/data")
PRICES = os.path.join(LAKE, "prices")
OUT = os.path.join(REPO, "data", "rings.json")

MIN_FULL_YEARS = 3          # need this many calendar years to be a "tree"
FULL_YEAR_MIN_DAYS = 150    # trading days for a year to count as "full"
PARTIAL_YEAR_MIN_DAYS = 20  # below this, drop the partial stub entirely
MIN_SCAR_HEAL_DAYS = 120    # quick V-recoveries are flesh wounds, not scars

TRADING_DAYS = 252


# ---- asset-class map (top-level rollup of data/groups.json) -----------------

def class_of(group_prefix):
    if group_prefix.startswith("crypto"):
        return "crypto"
    if group_prefix.startswith("equity"):
        return "equity"
    if group_prefix.startswith("bonds"):
        return "bonds"
    if group_prefix.startswith("commodities"):
        return "commodities"
    if group_prefix.startswith("currencies"):
        return "fx"
    return None


def load_class_map():
    with open(os.path.join(LAKE, "groups.json")) as f:
        g = json.load(f)
    tk2cls = {}
    for grp, tickers in g.items():
        c = class_of(grp)
        if c is None:
            continue
        for t in tickers:
            tk2cls.setdefault(t, c)   # first group wins (stable)
    return tk2cls


# ---- daily close ------------------------------------------------------------

def daily_close(ticker):
    df = pd.read_parquet(os.path.join(PRICES, f"{ticker}.parquet"),
                         columns=["hour", "price"])
    d = df["hour"].dt.tz_convert("UTC").dt.normalize()
    s = df.groupby(d)["price"].last()
    s.index = s.index.tz_localize(None)
    s = s[s > 0].sort_index()
    return s


# ---- per-year ring stats ----------------------------------------------------

def angle_of_date(ts):
    """Fraction of the year [0,1) for a timestamp -> ring angle.
    0 = Jan 1 (top), increasing clockwise."""
    year_start = pd.Timestamp(ts.year, 1, 1)
    year_end = pd.Timestamp(ts.year + 1, 1, 1)
    return (ts - year_start) / (year_end - year_start)


def ring_for_year(year, s_year):
    """Compute one ring's stats from a year's daily close series."""
    s_year = s_year.dropna()
    n = len(s_year)
    if n < PARTIAL_YEAR_MIN_DAYS:
        return None

    px = s_year.values
    first, last = px[0], px[-1]

    # Year total return + log growth (the WIDTH encoding).
    total_ret = last / first - 1.0
    log_growth = float(np.log(last / first))

    # Realized vol: annualized std of daily log returns (the DARKNESS encoding).
    logr = np.diff(np.log(px))
    if len(logr) > 1:
        vol = float(np.std(logr, ddof=1) * np.sqrt(TRADING_DAYS))
    else:
        vol = 0.0

    # Max drawdown within the year + the date it bottomed (the SCAR).
    runmax = np.maximum.accumulate(px)
    dd = px / runmax - 1.0
    trough_i = int(np.argmin(dd))
    max_dd = float(dd[trough_i])          # <= 0
    trough_date = s_year.index[trough_i]
    scar_angle = float(angle_of_date(trough_date))

    # Monthly returns -> 12-sector texture.  last-of-month / last-of-prev-month.
    monthly = s_year.resample("ME").last()
    # prepend the year's opening price so January has a base.
    base = pd.Series([first], index=[s_year.index[0]])
    mser = pd.concat([base, monthly])
    mret = mser.pct_change().dropna()
    # Compact 12-slot array (index 0 = Jan ... 11 = Dec); null where absent.
    mr = [None] * 12
    for ts, r in mret.items():
        mr[int(ts.month) - 1] = round(float(r), 4)

    partial = n < FULL_YEAR_MIN_DAYS

    return {
        "year": int(year),
        "ret": round(total_ret, 4),
        "log_growth": round(log_growth, 4),
        "vol": round(vol, 4),
        "max_dd": round(max_dd, 4),
        "scar_angle": round(scar_angle, 4),
        "scar_date": trough_date.strftime("%Y-%m-%d"),
        "mr": mr,
        "ndays": int(n),
        "partial": bool(partial),
    }


def scar_episodes(s, threshold):
    """Whole-history drawdown episodes deeper than `threshold`.

    An episode runs peak -> trough -> recovery (first day the prior peak is
    reclaimed).  Returns a list of dicts; recovery fields are None while the
    asset is still underwater at the end of the series.

    Besides the depth gate, an episode must stay underwater for at least
    MIN_SCAR_HEAL_DAYS past its trough (or still be open) to scar the tree —
    a deep but instantly-recovered V is a flesh wound, and drawing it leaves
    a blob in one ring with nothing radiating.
    """
    px = s.values
    idx = s.index
    episodes = []
    runmax = px[0]
    peak_i = 0
    cur_trough_i = 0
    cur_depth = 0.0
    for i in range(1, len(px)):
        if px[i] >= runmax:
            if cur_depth <= -threshold:
                episodes.append((peak_i, cur_trough_i, i, cur_depth))
            runmax = px[i]
            peak_i = i
            cur_trough_i = i
            cur_depth = 0.0
        else:
            dd = px[i] / runmax - 1.0
            if dd < cur_depth:
                cur_depth = dd
                cur_trough_i = i
    if cur_depth <= -threshold:
        episodes.append((peak_i, cur_trough_i, None, cur_depth))

    out = []
    for peak_i, trough_i, rec_i, depth in episodes:
        t_date = idx[trough_i]
        if rec_i is not None and (idx[rec_i] - t_date).days < MIN_SCAR_HEAL_DAYS:
            continue
        scar = {
            "depth": round(float(depth), 4),
            "year": int(t_date.year),
            "angle": round(float(angle_of_date(t_date)), 4),
            "date": t_date.strftime("%Y-%m-%d"),
            "peak_date": idx[peak_i].strftime("%Y-%m-%d"),
        }
        if rec_i is not None:
            r_date = idx[rec_i]
            scar["r_year"] = int(r_date.year)
            scar["r_angle"] = round(float(angle_of_date(r_date)), 4)
            scar["r_date"] = r_date.strftime("%Y-%m-%d")
        else:
            scar["r_year"] = None
        out.append(scar)
    return out


def build_tree(ticker, cls):
    try:
        s = daily_close(ticker)
    except Exception:
        return None
    if len(s) < FULL_YEAR_MIN_DAYS:
        return None

    rings = []
    for year, s_year in s.groupby(s.index.year):
        r = ring_for_year(year, s_year)
        if r is not None:
            rings.append(r)

    full_rings = [r for r in rings if not r["partial"]]
    if len(full_rings) < MIN_FULL_YEARS:
        return None

    rings.sort(key=lambda r: r["year"])

    # Whole-tree summary stats (for the enlarged single-tree panel + sorting).
    px_first = s.iloc[0]
    px_last = s.iloc[-1]
    n_days = len(s)
    years_elapsed = n_days / TRADING_DAYS
    cagr = (px_last / px_first) ** (1.0 / years_elapsed) - 1.0 if years_elapsed > 0 else 0.0

    # Whole-history max drawdown.
    pxv = s.values
    runmax = np.maximum.accumulate(pxv)
    dd_all = pxv / runmax - 1.0
    worst_dd_all = float(dd_all.min())

    # Scar severity gate: median full-year vol, clamped — a 20% dip scars a
    # bond fund but not BTC; any halving scars anything.
    med_vol = float(np.median([r["vol"] for r in full_rings]))
    scar_thr = min(max(0.15, med_vol), 0.50)
    scars = scar_episodes(s, scar_thr)
    # Drop scars whose trough fell in a dropped stub year OR in the asset's
    # first ring — a listing-year crash is an artifact of where the data
    # begins (IPO/listing hype base), and it blobs at the pith.  Clamp
    # recovery into the rendered ring span.
    y_first, y_last = rings[0]["year"], rings[-1]["year"]
    scars = [sc for sc in scars if y_first < sc["year"] <= y_last]
    for sc in scars:
        if sc["r_year"] is not None:
            sc["r_year"] = min(sc["r_year"], y_last)

    full_year_vals = [(r["year"], r["ret"], r["vol"]) for r in full_rings]
    best = max(full_year_vals, key=lambda x: x[1])
    worst = min(full_year_vals, key=lambda x: x[1])
    rets = np.array([r["ret"] for r in full_rings])
    # Ring uniformity: std of full-year log-growth (lower = steadier grower).
    lg = np.array([r["log_growth"] for r in full_rings])
    uniformity = float(np.std(lg))

    return {
        "id": ticker,
        "cls": cls,
        "rings": rings,
        "scars": scars,
        "scar_thr": round(scar_thr, 3),
        "n_rings": len(rings),
        "n_full": len(full_rings),
        "age_years": round(years_elapsed, 2),
        "cagr": round(float(cagr), 5),
        "worst_dd": round(worst_dd_all, 5),
        "best_year": {"year": best[0], "ret": round(best[1], 5)},
        "worst_year": {"year": worst[0], "ret": round(worst[1], 5)},
        "mean_vol": round(float(np.mean([r["vol"] for r in full_rings])), 5),
        "uniformity": round(uniformity, 5),
        "first_year": rings[0]["year"],
        "last_year": rings[-1]["year"],
    }


# ---- featured forest selection ---------------------------------------------
# Majors across classes + a few extremes.  Everything else is computed and
# swappable via the selector; this is just the default ~50-glyph forest.

FEATURED = [
    # crypto majors + extremes
    "btc", "eth", "sol", "xrp", "bnb", "ada", "doge", "ltc", "link", "avax",
    "shib", "pepe", "uni", "aave",
    # equity index + megacap + extremes
    "spy", "qqq", "iwm", "aapl", "msft", "nvda", "tsla", "amzn", "meta", "googl",
    "coin", "mstr", "mara", "pltr", "amd",
    # bonds (old-growth, tight pale rings)
    "tlt", "ief", "shy", "agg", "lqd", "hyg", "tip", "emb",
    # commodities
    "gld", "slv", "uso", "dbc", "ung", "dba",
    # fx
    "uup", "eurusd", "usdjpy", "gbpusd", "usdchf", "fxe", "fxy",
]


def main():
    tk2cls = load_class_map()
    have = sorted(f[:-8] for f in os.listdir(PRICES) if f.endswith(".parquet"))

    trees = []
    skipped = 0
    for t in have:
        cls = tk2cls.get(t)
        if cls is None:
            skipped += 1
            continue
        tree = build_tree(t, cls)
        if tree is None:
            skipped += 1
            continue
        trees.append(tree)

    feat_set = set(FEATURED)
    for tr in trees:
        tr["featured"] = tr["id"] in feat_set
        # Monthly texture (12-sector shading) is the optional layer and the
        # heaviest field; keep it only on the default forest so the payload
        # stays tiny.  Non-featured trees still carry the full width/vol/scar
        # encoding (all top-level), so swapping one in renders correctly —
        # it just won't have the month-sector overlay.
        if not tr["featured"]:
            for r in tr["rings"]:
                r.pop("mr", None)

    # Sort featured-first in FEATURED order, then the rest alphabetically.
    order = {t: i for i, t in enumerate(FEATURED)}
    trees.sort(key=lambda tr: (not tr["featured"], order.get(tr["id"], 1e9), tr["id"]))

    n_feat = sum(tr["featured"] for tr in trees)

    # Global normalization anchors so the renderer maps width/darkness
    # consistently across the whole forest.
    all_lg = [r["log_growth"] for tr in trees for r in tr["rings"]]
    all_vol = [r["vol"] for tr in trees for r in tr["rings"]]
    # Vol -> darkness is normalized WITHIN class: crypto pegs the global p90
    # (every ring maximally dark) while equities huddle pale at the bottom,
    # which destroys within-class variation.  Hue already carries the
    # cross-class vol story; darkness should mean "violent for its class".
    # Return -> hue AND vol -> darkness are both normalized WITHIN class.
    # Crypto's return swings dwarf equities', so on a global return scale a
    # great equity year barely tints off tan while crypto pegs deep green/red —
    # equities read washed out.  Per-class anchors make "a good year for its
    # kind" the same green on every tree.  (lg_neg = p5 within class < 0,
    # lg_pos = p95 within class > 0; diverging around 0.)
    vol_cls, lg_cls = {}, {}
    for cls in sorted({tr["cls"] for tr in trees}):
        vols = [r["vol"] for tr in trees if tr["cls"] == cls for r in tr["rings"]]
        lgs = [r["log_growth"] for tr in trees if tr["cls"] == cls for r in tr["rings"]]
        vol_cls[cls] = [round(float(np.percentile(vols, 10)), 5),
                        round(float(np.percentile(vols, 90)), 5)]
        lg_cls[cls] = [round(float(min(np.percentile(lgs, 5), -1e-3)), 5),
                       round(float(max(np.percentile(lgs, 95), 1e-3)), 5)]
    norm = {
        "lg_p5": round(float(np.percentile(all_lg, 5)), 5),
        "lg_p95": round(float(np.percentile(all_lg, 95)), 5),
        "lg_p50": round(float(np.percentile(all_lg, 50)), 5),
        "vol_p10": round(float(np.percentile(all_vol, 10)), 5),
        "vol_p90": round(float(np.percentile(all_vol, 90)), 5),
        "vol_cls": vol_cls,
        "lg_cls": lg_cls,
        "max_age": max(tr["age_years"] for tr in trees),
    }

    out = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%d %H:%M UTC"),
        "n_trees": len(trees),
        "n_featured": n_feat,
        "norm": norm,
        "trees": trees,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}")
    print(f"  trees: {len(trees)}  featured: {n_feat}  skipped: {skipped}")
    print(f"  size: {size_kb:.1f} KB")
    print(f"  norm: {norm}")
    # quick class breakdown
    from collections import Counter
    cc = Counter(tr["cls"] for tr in trees)
    print("  by class:", dict(cc))
    # sample: oldest + most-scarred featured
    feat = [tr for tr in trees if tr["featured"]]
    feat_oldest = max(feat, key=lambda t: t["age_years"])
    feat_scar = min(feat, key=lambda t: t["worst_dd"])
    print(f"  oldest featured: {feat_oldest['id']} ({feat_oldest['age_years']}y, {feat_oldest['n_rings']} rings)")
    print(f"  most-scarred featured: {feat_scar['id']} (worst_dd {feat_scar['worst_dd']})")


if __name__ == "__main__":
    main()
