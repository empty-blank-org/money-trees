#!/usr/bin/env python3
"""
Fire ecology — crashes as forest fires.  Some trees are serotinous: their
cones are sealed with resin and need the heat of a fire to open and release
seed, so the species' biggest growth pulse comes in the seasons immediately
AFTER a burn, not despite it.  This prototype asks the same question of
assets: do the drawdown episodes that scar a tree (money-trees' shared
scar gate, see forest/prep.py) precede that asset's best growth, or is a
burn just a burn?

THREE COMPUTATIONS
-------------------
1. BURN YEARS.  Reuse forest/prep.py's scar gate verbatim: a whole-history
   drawdown episode scars an asset only if it is deeper than that asset's
   median full-year realized vol, clamped to [15%, 50%].  The calendar
   year containing each qualifying episode's trough is a "burn year."

2. SEROTINY SCORE.  For every burn year with a following full calendar
   year in the data, take that following year's log total return.  Score
   = mean(those post-burn log returns) - median(log return of ALL the
   asset's full years).  Positive = the asset puts on its widest ring
   right after a fire.  Needs >= 2 usable burn observations to score at
   all (record n_burns); a single burn proves nothing.

3. REGROWTH CURVES.  For four named market-wide fires in shared/spans.json
   (COVID 2020, Terra/Luna 2022, yen-carry 2024, tariffs 2025): find each
   asset's own local price trough inside the event window, then track its
   cumulative return from that trough forward at monthly resolution out to
   24 months.  Median across assets, grouped by class.  A month is only
   reported if enough assets in the class actually have that much
   afterward-data (n >= MIN_N) — no faking survivorship-adjusted futures.

UNIVERSE
--------
Every asset in data/prices/ with >= 5 qualifying calendar years (>= 150
trading days each, same "full year" gate as forest/prep.py).  Fewer years
than that and there isn't enough calendar to identify even one burn/regrowth
pair honestly.

CAVEATS (surfaced on the page, not just here)
----------------------------------------------
  * Survivorship: dead trees (delisted, rugged, wound to zero) aren't in
    the lake, so we only ever see the story of assets that regrew. Any
    serotiny signal is upper-biased by construction.
  * Mean reversion confound: "biggest gain the year after the worst year"
    is close to a truism for any asset with heavy-tailed annual returns —
    a crash year's boundary tends to be timed near a subsequent bounce
    just by how volatility clusters. The page checks this directly by
    plotting serotiny against each asset's own annualized vol.

Emits data/fire.json (compact, well under 1MB).
Run from this experiment directory: python3 prep.py
"""
import json
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
LAKE = os.path.abspath(os.environ.get("EMPTY_DATA", os.path.join(HERE, "..", "..", "..", "..", "empty-data", "data")))
PRICES = os.path.join(LAKE, "prices")
SPANS = os.path.join(HERE, "shared", "spans.json")
OUT = os.path.join(HERE, "data", "fire.json")

FULL_YEAR_MIN_DAYS = 150   # same "a full ring" gate as forest/prep.py
MIN_QUALIFYING_YEARS = 5   # universe entry: >= this many full calendar years
MIN_SCAR_HEAL_DAYS = 120   # quick V-recoveries are flesh wounds, not fires
MIN_BURNS_TO_SCORE = 2     # need at least 2 burn observations to trust a score
TRADING_DAYS = 252

REGROWTH_EVENTS = ["covid2020", "terraluna2022", "yencarry2024", "tariffs2025"]
REGROWTH_MONTHS = 24
MIN_N_FOR_MONTH = 3        # class median needs at least this many assets


# ---- asset-class map (same rollup as forest/prep.py) -------------------

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
            tk2cls.setdefault(t, c)
    return tk2cls


def daily_close(ticker):
    df = pd.read_parquet(os.path.join(PRICES, f"{ticker}.parquet"),
                          columns=["hour", "price"])
    d = df["hour"].dt.tz_convert("UTC").dt.normalize()
    s = df.groupby(d)["price"].last()
    s.index = s.index.tz_localize(None)
    s = s[s > 0].sort_index()
    return s


# ---- scar gate (verbatim logic from forest/prep.py) ---------------------

def scar_episodes(s, threshold):
    """Whole-history drawdown episodes deeper than `threshold`, held
    underwater at least MIN_SCAR_HEAL_DAYS past the trough (or still open)."""
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
        out.append({"year": int(t_date.year), "date": t_date.strftime("%Y-%m-%d"),
                     "depth": round(float(depth), 4)})
    return out


# ---- per-asset build -----------------------------------------------------

def full_year_stats(s):
    """Per calendar year: log growth + realized vol, for years with
    >= FULL_YEAR_MIN_DAYS observed trading days."""
    out = {}
    for year, s_year in s.groupby(s.index.year):
        px = s_year.dropna().values
        n = len(px)
        if n < FULL_YEAR_MIN_DAYS:
            continue
        log_growth = float(np.log(px[-1] / px[0]))
        logr = np.diff(np.log(px))
        vol = float(np.std(logr, ddof=1) * np.sqrt(TRADING_DAYS)) if len(logr) > 1 else 0.0
        out[int(year)] = {"log_growth": log_growth, "vol": vol}
    return out


def build_asset(ticker, cls):
    try:
        s = daily_close(ticker)
    except Exception:
        return None
    if len(s) < FULL_YEAR_MIN_DAYS:
        return None

    fy = full_year_stats(s)
    if len(fy) < MIN_QUALIFYING_YEARS:
        return None

    years_sorted = sorted(fy)
    log_growths = np.array([fy[y]["log_growth"] for y in years_sorted])
    vols = np.array([fy[y]["vol"] for y in years_sorted])
    median_all = float(np.median(log_growths))
    ann_vol = float(np.mean(vols))

    # Scar threshold: median full-year vol, clamped [15%, 50%].
    scar_thr = min(max(0.15, float(np.median(vols))), 0.50)
    scars = scar_episodes(s, scar_thr)
    # Drop a scar rooted in the asset's first calendar year of data — a
    # listing-year crash is an artifact of where the series begins, same
    # rule forest/prep.py applies.
    first_year = int(s.index[0].year)
    scars = [sc for sc in scars if sc["year"] > first_year]
    burn_years = sorted({sc["year"] for sc in scars})

    post_burn_rets = []
    for by in burn_years:
        ny = by + 1
        if ny in fy:
            post_burn_rets.append(fy[ny]["log_growth"])

    n_burns = len(post_burn_rets)
    serotiny = None
    if n_burns >= MIN_BURNS_TO_SCORE:
        serotiny = float(np.mean(post_burn_rets) - median_all)

    return {
        "id": ticker,
        "cls": cls,
        "n_years": len(fy),
        "n_scars": len(scars),
        "n_burns": n_burns,
        "serotiny": round(serotiny, 5) if serotiny is not None else None,
        "ann_vol": round(ann_vol, 5),
        "median_ret": round(median_all, 5),
        "first_year": first_year,
        "last_year": int(s.index[-1].year),
        "_series": s,   # kept in-memory only, stripped before JSON dump
    }


# ---- regrowth curves ------------------------------------------------------

def load_events():
    with open(SPANS) as f:
        spans = json.load(f)
    by_key = {e["key"]: e for e in spans["events"]}
    return [by_key[k] for k in REGROWTH_EVENTS if k in by_key]


def asset_regrowth_path(s, ev_start, ev_end, months=REGROWTH_MONTHS):
    """Local trough within [start,end], then cumulative return from that
    trough at monthly offsets 0..months.  Returns dict month->ret or None
    if the asset doesn't have enough coverage in the window."""
    window = s[(s.index >= ev_start) & (s.index <= ev_end)]
    if len(window) < 3:
        return None
    trough_date = window.idxmin()
    trough_px = float(window.loc[trough_date])

    path = {}
    idx = s.index
    for k in range(0, months + 1):
        target = trough_date + pd.DateOffset(months=k)
        pos = idx.searchsorted(target)
        if pos >= len(idx):
            continue
        found_date = idx[pos]
        if (found_date - target).days > 10:   # tolerance: no data near target
            continue
        path[k] = float(s.iloc[pos]) / trough_px - 1.0
    return path


def build_regrowth(assets, events):
    out = []
    for ev in events:
        ev_start = pd.Timestamp(ev["start"])
        ev_end = pd.Timestamp(ev["end"])
        by_cls = {}
        for a in assets:
            path = asset_regrowth_path(a["_series"], ev_start, ev_end)
            if path is None:
                continue
            by_cls.setdefault(a["cls"], []).append(path)

        classes_out = {}
        for cls, paths in by_cls.items():
            months, medians, ns = [], [], []
            for k in range(0, REGROWTH_MONTHS + 1):
                vals = [p[k] for p in paths if k in p]
                if len(vals) >= MIN_N_FOR_MONTH:
                    months.append(k)
                    medians.append(round(float(np.median(vals)), 4))
                    ns.append(len(vals))
            if months:
                classes_out[cls] = {"months": months, "median": medians, "n": ns}
        out.append({"key": ev["key"], "name": ev["name"],
                     "start": ev["start"], "end": ev["end"],
                     "classes": classes_out})
    return out


def main():
    tk2cls = load_class_map()
    have = sorted(f[:-8] for f in os.listdir(PRICES) if f.endswith(".parquet"))

    assets = []
    skipped = 0
    for t in have:
        cls = tk2cls.get(t)
        if cls is None:
            skipped += 1
            continue
        a = build_asset(t, cls)
        if a is None:
            skipped += 1
            continue
        assets.append(a)

    events = load_events()
    regrowth = build_regrowth(assets, events)

    scored = [a for a in assets if a["serotiny"] is not None]

    # Strip the in-memory series before emitting JSON.
    assets_out = []
    for a in assets:
        a = dict(a)
        a.pop("_series", None)
        assets_out.append(a)

    out = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%d %H:%M UTC"),
        "n_assets": len(assets_out),
        "n_scored": len(scored),
        "min_qualifying_years": MIN_QUALIFYING_YEARS,
        "min_burns_to_score": MIN_BURNS_TO_SCORE,
        "assets": assets_out,
        "events": regrowth,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}")
    print(f"  assets: {len(assets_out)}  scored: {len(scored)}  skipped: {skipped}")
    print(f"  size: {size_kb:.1f} KB")
    if scored:
        top = sorted(scored, key=lambda a: -a["serotiny"])[:5]
        bot = sorted(scored, key=lambda a: a["serotiny"])[:5]
        print("  top serotiny:", [(a["id"], a["serotiny"], a["n_burns"]) for a in top])
        print("  bottom serotiny:", [(a["id"], a["serotiny"], a["n_burns"]) for a in bot])
        sv = np.array([a["serotiny"] for a in scored])
        vv = np.array([a["ann_vol"] for a in scored])
        corr = float(np.corrcoef(sv, vv)[0, 1])
        print(f"  corr(serotiny, ann_vol) over scored assets: {corr:.3f}")
    for ev in regrowth:
        print(f"  {ev['key']}: classes={list(ev['classes'].keys())}")


if __name__ == "__main__":
    main()
