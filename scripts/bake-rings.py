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

  * ring COLOR   = one uniform color per ring, like real wood. The production
                   renderer defaults to separated heartwood/sapwood ramps for
                   negative/positive years and offers separated red/green ramps
                   in an optional market palette. Only a truly flat year uses
                   the middle tan/ochre. Magnitude is normalized WITHIN asset class
                   (class p5..p95), so "a good year for its kind" remains
                   legible beside crypto. Realized vol darkens the ring within
                   class (class p10..p90); wood-mode darkening is bounded so it
                   cannot erase the sign distinction. The asset CLASS lives on
                   the label hue only (crypto amber / equity blue / bonds green /
                   commodities rust / fx magenta); the bark is one natural rind.

  * SCAR (radial seam) = a MAJOR drawdown episode, computed on the whole
                   history (not per-year).  Only episodes deeper than a
                   severity gate scar the tree: a fall of SCAR_SIGMA median
                   annual vols in log space, floored at SCAR_MIN_DEPTH — so a
                   12% fall scars a currency fund, 20% scars SPY, ~57% scars
                   BTC.  Episodes run from the all-time high, plus NESTED
                   episodes: a second crash from an interim high inside a
                   still-open one (see scar_episodes).  The scar starts at the
                   trough date (its ring + angular position, Jan = top,
                   clockwise) and RADIATES OUTWARD through every later ring
                   until the year price reclaimed the peak it fell from —
                   exactly like a real fire scar that subsequent rings grow
                   around until the bark closes over.  Depth ∝ drawdown
                   magnitude; an unrecovered drawdown stays open to the bark.
                   Because the angle is the calendar date, a market-wide event
                   (COVID = late March 2020) carves scars at the SAME angle
                   across the forest — visible "climate years."

  * MONTHLY returns (`mr`) are still emitted per featured ring for research
                   and archived experiments. The production tree always draws
                   a complete circular band; partial-year status is surfaced
                   in inspection text, not by removing a wedge of wood.

Partial years
-------------
The first and last calendar year of an asset are almost never complete. Their
statistics are computed only over the days actually present and the `partial`
flag remains in the artifact. The production renderer still draws a complete
circular band: real tree rings do not lose a half- or quarter-circle because a
measurement window ended mid-year. Inspection text identifies partial years.

Universe
--------
Every publishable asset in the empty-data lake — all of data/prices_public/
(Twelve Data equities/ETFs, Kenneth R. French century series) plus the CRYPTO
slice of data/prices/ (CoinGecko) — with >= 3 full calendar years, where a full
year holds >= 60% of the asset's own bars (≈150 market-hours, ≈219 crypto).  All are computed;
the page caps the rendered forest at the most-relevant majors+extremes via a
`featured` flag, with a selector to swap any computed asset in.

Published precision
-------------------
Annual returns (`ret`) and monthly returns (`mr`) are rounded to a whole percent
before they are written, and `log_growth` is derived from the rounded return.
Exact returns would let anyone invert the artifact back to the vendor's adjusted
closes; a whole-percent grid does not, and the visual encodings move sub-pixel.

Emits data/rings.json (the production app's canonical annual-ring artifact).

Run from the repository root:  .venv/bin/python scripts/bake-rings.py
"""
import json
import os
import sys
import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def locate_lake():
    """EMPTY_DATA if set; else ./lake (what scripts/sync-lake.sh pulls from R2);
    else the sibling empty-data checkout's data/ (a dev clone of the lake repo)."""
    if os.environ.get("EMPTY_DATA"):
        return os.path.abspath(os.environ["EMPTY_DATA"])
    candidates = [
        os.path.join(REPO, "lake"),
        os.path.join(REPO, "..", "empty-blank", "empty-data", "data"),
        os.path.join(REPO, "..", "empty-data", "data"),
    ]
    for c in candidates:
        if os.path.isfile(os.path.join(c, "prices_public.json")):
            return os.path.abspath(c)
    sys.exit("bake: no lake found — run scripts/sync-lake.sh (pulls the R2 slice "
             "into ./lake) or set EMPTY_DATA to a lake data/ directory")


LAKE = locate_lake()
OUT = os.path.join(REPO, "data", "rings.json")

# Licensing floor for the PRIVATE lake (data/prices/).
#
# Only crypto is read from there (CoinGecko, publishable), so in practice this
# floor never bites — it is belt-and-suspenders: if a non-crypto id ever slipped
# back into the private-lake read path, its pre-1970 Tiingo rows still could not
# reach the published artifact.  The public lake (data/prices_public/) needs no
# floor: Twelve Data simply has no bar before 1970-01-02, and the Kenneth R.
# French series are freely redistributable back to 1926.
LAKE_HISTORY_FLOOR = "1970-01-01"

# Published-precision quantization (Twelve Data ToS).
#
# Derived data we publish must not be reverse-engineerable back to the vendor's
# underlying closes.  An exact annual return plus one known price recovers the
# other year-end adjusted close; exact monthly returns recover the whole
# month-end close ladder.  So every published return — ring `ret` and each
# monthly `mr` — is rounded to a WHOLE PERCENT, which leaves the visual encoding
# untouched (sub-pixel width changes) while destroying the closes.  Applied to
# every asset uniformly, not just the Twelve Data ones.
#
# vol / max_dd / cagr are path statistics over hundreds of days and are not
# invertible to a price series; they keep their current precision.
RET_QUANT = 0.01


def quantize_ret(x):
    """Round a return fraction to a whole percent (multiple of RET_QUANT)."""
    return round(round(float(x) / RET_QUANT) * RET_QUANT, 4)

MIN_FULL_YEARS = 3          # need this many calendar years to be a "tree"
FULL_YEAR_FRACTION = 0.6    # share of an asset's own bars-per-year for a "full" ring
PARTIAL_YEAR_MIN_DAYS = 20  # below this, drop the partial stub entirely
MIN_SCAR_HEAL_DAYS = 120    # quick V-recoveries are flesh wounds, not scars
SCAR_SIGMA = 1.25           # scar gate: a fall of this many median-annual-vols (log space)
SCAR_MIN_DEPTH = 0.10       # ...but never shallower than this

# Bars per calendar year, by class. Crypto trades every day; everything else
# keeps market hours. This drives vol annualization and the full-year gate.
# The clock for CAGR and age is CALENDAR time, never a bar count (a bar count
# made Bitcoin 23 years old and cut its CAGR by 54 points).
PERIODS_PER_YEAR = {"crypto": 365}
DEFAULT_PERIODS_PER_YEAR = 252
DAYS_PER_YEAR = 365.25


def periods_per_year(cls):
    return PERIODS_PER_YEAR.get(cls, DEFAULT_PERIODS_PER_YEAR)


def full_year_min_days(cls):
    return int(round(FULL_YEAR_FRACTION * periods_per_year(cls)))

# Canonical display names for the public collection. Equity metadata is also
# pulled from the lake when available (see load_asset_names); these entries
# cover instruments whose names live in source-specific pipeline config.
DISPLAY_NAMES = {
    "btc": "Bitcoin", "eth": "Ethereum", "sol": "Solana", "xrp": "XRP",
    "bnb": "BNB", "ada": "Cardano", "doge": "Dogecoin", "ltc": "Litecoin",
    "link": "Chainlink", "avax": "Avalanche", "shib": "Shiba Inu",
    "pepe": "Pepe", "uni": "Uniswap", "aave": "Aave",
    "xlm": "Stellar", "xmr": "Monero", "zec": "Zcash",
    "etc": "Ethereum Classic", "eos": "EOS", "trx": "TRON",
    "bch": "Bitcoin Cash", "lunc": "Terra Classic", "mana": "Decentraland",
    "mkr": "Maker", "atom": "Cosmos", "stx": "Stacks",
    "fil": "Filecoin", "axs": "Axie Infinity", "dot": "Polkadot",
    "near": "NEAR Protocol", "inj": "Injective", "ton": "Toncoin",
    "render": "Render", "op": "Optimism",
    "spy": "SPDR S&P 500 ETF Trust", "qqq": "Invesco QQQ Trust",
    "iwm": "iShares Russell 2000 ETF", "aapl": "Apple", "msft": "Microsoft",
    "nvda": "Nvidia", "tsla": "Tesla", "amzn": "Amazon", "meta": "Meta Platforms",
    "googl": "Alphabet", "coin": "Coinbase", "mstr": "Strategy",
    "mara": "MARA Holdings", "pltr": "Palantir", "amd": "Advanced Micro Devices",
    "ko": "Coca-Cola", "ge": "General Electric", "dis": "Disney",
    "xom": "Exxon Mobil", "wmt": "Walmart", "jpm": "JPMorgan Chase",
    "o": "Realty Income", "intc": "Intel", "asml": "ASML",
    "brk.b": "Berkshire Hathaway", "nflx": "Netflix",
    "ewj": "iShares MSCI Japan ETF", "eem": "iShares MSCI Emerging Markets ETF",
    "tlt": "iShares 20+ Year Treasury Bond ETF", "ief": "iShares 7–10 Year Treasury Bond ETF",
    "shy": "iShares 1–3 Year Treasury Bond ETF", "agg": "iShares Core U.S. Aggregate Bond ETF",
    "lqd": "iShares Investment Grade Corporate Bond ETF", "hyg": "iShares High Yield Corporate Bond ETF",
    "tip": "iShares TIPS Bond ETF", "emb": "JPMorgan USD Emerging Markets Bond ETF",
    "mbb": "iShares MBS ETF",
    "gld": "SPDR Gold Shares", "slv": "iShares Silver Trust", "uso": "United States Oil Fund",
    "dbc": "Invesco DB Commodity Index Tracking Fund", "ung": "United States Natural Gas Fund",
    "dba": "Invesco DB Agriculture Fund", "cper": "United States Copper Index Fund",
    "pplt": "abrdn Physical Platinum Shares ETF",
    "uup": "Invesco DB U.S. Dollar Index Bullish Fund",
    "fxa": "Invesco CurrencyShares Australian Dollar Trust",
    "fxb": "Invesco CurrencyShares British Pound Trust",
    "fxc": "Invesco CurrencyShares Canadian Dollar Trust",
    "fxf": "Invesco CurrencyShares Swiss Franc Trust",
    "eurusd": "Euro / U.S. Dollar", "usdjpy": "U.S. Dollar / Japanese Yen",
    "gbpusd": "British Pound / U.S. Dollar", "usdchf": "U.S. Dollar / Swiss Franc",
    "fxe": "Invesco CurrencyShares Euro Trust", "fxy": "Invesco CurrencyShares Japanese Yen Trust",
}


# ---- price sources ----------------------------------------------------------
# The forest is baked from the empty-data lake's TWO price namespaces, which
# share a schema (<id>.parquet with hour/price) but differ legally:
#
#   prices_public/  Twelve Data (equity/ETF/bonds/commodities/fx, 1970->) and
#                   the Kenneth R. French Data Library century series (1926->).
#                   Licensed for public display — this is what the site draws.
#                   Metadata: prices_public.json (groups + per-asset class/name).
#
#   prices/         The private lake. Its equity/FX history is Tiingo-sourced
#                   and may NOT be publicly displayed, so this bake reads ONLY
#                   its crypto slice (CoinGecko, publishable, and the one series
#                   that does not exist in prices_public/).
#                   Metadata: groups.json.
#
# `floor` is the source's licensing history floor, `classes` restricts which
# asset classes a source may contribute.

class Source:
    def __init__(self, name, root, prices_dir, floor=None, classes=None):
        self.name = name
        self.root = root
        self.prices = os.path.join(root, prices_dir)
        self.floor = floor
        self.classes = classes          # None = any class

    def tickers(self):
        if not os.path.isdir(self.prices):
            return []
        return sorted(f[:-8] for f in os.listdir(self.prices) if f.endswith(".parquet"))


def load_public_manifest():
    path = os.path.join(LAKE, "prices_public.json")
    if not os.path.exists(path):
        sys.exit(f"missing public price manifest: {path} — the public lake "
                 "(prices_public/ + prices_public.json) must be synced first")
    with open(path) as f:
        manifest = json.load(f)
    if manifest.get("schema_version") != 1:
        sys.exit(f"unsupported prices_public.json schema_version "
                 f"{manifest.get('schema_version')!r}")
    return manifest


def load_sources(manifest):
    return [
        Source("public", LAKE, manifest.get("prices_dir", "prices_public")),
        # Crypto only: everything else in the private lake is undisplayable.
        Source("lake", LAKE, "prices", floor=LAKE_HISTORY_FLOOR, classes={"crypto"}),
    ]


# Return basis, by upstream source. The Twelve Data series are fetched with
# adjust=all (dividend- and split-adjusted, i.e. total return) but the vendor's
# dividend adjustment is thinner before 2013; the Ken French series are total-
# return indexes by construction; crypto is a spot price with no yield.
BASIS_BY_SOURCE = {"twelvedata": "adjusted", "kenfrench": "total"}


def load_basis(manifest):
    """id -> return basis ('total' | 'adjusted' | 'spot')."""
    basis = {}
    for ticker, meta in manifest.get("assets", {}).items():
        basis[str(ticker).lower()] = BASIS_BY_SOURCE.get(meta.get("source"), "adjusted")
    return basis


def load_asset_names(manifest):
    """Public-manifest display names layered over the curated cross-asset map."""
    names = dict(DISPLAY_NAMES)
    for ticker, meta in manifest.get("assets", {}).items():
        name = meta.get("name")
        if name:
            names[str(ticker).lower()] = str(name)
    return names


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


def load_class_map(manifest):
    """id -> asset class, from the public manifest first, then groups.json.

    Both use the same `equity_*` / `bonds_*` / … group-prefix convention; the
    public manifest additionally states each asset's class outright.
    """
    tk2cls = {}
    for ticker, meta in manifest.get("assets", {}).items():
        cls = meta.get("class") or class_of(meta.get("group", ""))
        if cls:
            tk2cls[str(ticker).lower()] = cls
    with open(os.path.join(LAKE, "groups.json")) as f:
        groups = json.load(f)
    for grp, tickers in groups.items():
        c = class_of(grp)
        if c is None:
            continue
        for t in tickers:
            tk2cls.setdefault(t, c)   # first group wins (stable)
    return tk2cls


# ---- daily close ------------------------------------------------------------

def daily_close(ticker, src):
    df = pd.read_parquet(os.path.join(src.prices, f"{ticker}.parquet"),
                         columns=["hour", "price"])
    d = df["hour"].dt.tz_convert("UTC").dt.normalize()
    s = df.groupby(d)["price"].last()
    s.index = s.index.tz_localize(None)
    s = s[s > 0].sort_index()
    if src.floor is not None:
        s = s[s.index >= src.floor]
    return s


# ---- per-year ring stats ----------------------------------------------------

def angle_of_date(ts):
    """Fraction of the year [0,1) for a timestamp -> ring angle.
    0 = Jan 1 (top), increasing clockwise."""
    year_start = pd.Timestamp(ts.year, 1, 1)
    year_end = pd.Timestamp(ts.year + 1, 1, 1)
    return (ts - year_start) / (year_end - year_start)


def ring_for_year(year, s_year, cls, prev_close=None):
    """Compute one ring's stats from a year's daily close series.

    `prev_close` is the last close of the preceding year. A calendar year's
    return runs from that close to this year's last close, so the New Year's
    move belongs to the new ring; measuring first-close -> last-close inside
    the year silently dropped one trading day from every ring (SPY 2003 read
    +24% instead of +28%). The very first ring has no prior close and keeps
    its own opening print as the base.
    """
    s_year = s_year.dropna()
    n = len(s_year)
    if n < PARTIAL_YEAR_MIN_DAYS:
        return None

    px = s_year.values
    base = prev_close if prev_close is not None else px[0]
    first, last = px[0], px[-1]

    # Year total return + log growth (the WIDTH encoding).
    # `ret` is quantized to a whole percent before publication (see RET_QUANT),
    # and log_growth is derived FROM the quantized return so the width/color
    # encodings stay exactly consistent with the number we publish.
    total_ret = quantize_ret(last / base - 1.0)
    log_growth = float(np.log1p(max(total_ret, -0.99)))

    # Realized vol: annualized std of daily log returns (the DARKNESS encoding),
    # including the move in from the prior close, scaled by the class's own
    # bars-per-year (365 for crypto, 252 otherwise).
    path = np.concatenate(([base], px)) if prev_close is not None else px
    logr = np.diff(np.log(path))
    if len(logr) > 1:
        vol = float(np.std(logr, ddof=1) * np.sqrt(periods_per_year(cls)))
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
    # prepend the year's base (prior close, or the opening print) so January has a base.
    mser = pd.concat([pd.Series([base], index=[s_year.index[0]]), monthly])
    mret = mser.pct_change().dropna()
    # Compact 12-slot array (index 0 = Jan ... 11 = Dec); null where absent.
    mr = [None] * 12
    for ts, r in mret.items():
        mr[int(ts.month) - 1] = quantize_ret(r)

    partial = n < full_year_min_days(cls)

    return {
        "year": int(year),
        "ret": total_ret,
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

    A PRIMARY episode runs all-time peak -> trough -> recovery (first day the
    prior peak is reclaimed). A NESTED episode is a second crash inside an open
    primary: after the primary's trough the price climbs to an interim high and
    then falls more than `threshold` from it, before the old peak is reclaimed
    (Bitcoin, March 2020: -60% from the June 2019 high, while still below the
    December 2017 peak; the US market in 1937-38, still below 1929). Without
    nested episodes a market-wide event only scarred the trees that happened to
    be at a high when it struck. A nested episode's depth is measured from its
    interim high, and it recovers when that high is reclaimed.

    Returns a list of dicts; recovery fields are None while the asset is still
    underwater at the end of the series. Besides the depth gate, an episode must
    stay underwater for at least MIN_SCAR_HEAL_DAYS past its trough (or still be
    open) to scar the tree — a deep but instantly-recovered V is a flesh wound,
    and drawing it leaves a blob in one ring with nothing radiating.
    """
    px = s.values
    idx = s.index
    primary, nested = [], []
    runmax, peak_i, cur_trough_i, cur_depth = px[0], 0, 0, 0.0
    imax, ipeak_i, sdepth, strough_i = px[0], 0, 0.0, 0   # interim-high tracking since the trough

    def close_nested(rec_i):
        nonlocal sdepth
        if sdepth <= -threshold:
            nested.append((ipeak_i, strough_i, rec_i, sdepth))
        sdepth = 0.0

    for i in range(1, len(px)):
        if px[i] >= runmax:
            close_nested(i)                       # the old peak is back: everything below it healed
            if cur_depth <= -threshold:
                primary.append((peak_i, cur_trough_i, i, cur_depth))
            runmax, peak_i, cur_trough_i, cur_depth = px[i], i, i, 0.0
            imax, ipeak_i = px[i], i
        else:
            dd = px[i] / runmax - 1.0
            if dd < cur_depth:                    # a new bottom: the primary trough moves, interim tracking restarts
                cur_depth, cur_trough_i = dd, i
                imax, ipeak_i, sdepth = px[i], i, 0.0
            elif px[i] >= imax:                   # a new interim high: a pending nested episode has recovered
                close_nested(i)
                imax, ipeak_i = px[i], i
            else:
                sdd = px[i] / imax - 1.0
                if sdd < sdepth:
                    sdepth, strough_i = sdd, i
    close_nested(None)
    if cur_depth <= -threshold:
        primary.append((peak_i, cur_trough_i, None, cur_depth))

    out = []
    for kind, episodes in (("primary", primary), ("nested", nested)):
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
            if kind == "nested":
                scar["nested"] = True
            if rec_i is not None:
                r_date = idx[rec_i]
                scar["r_year"] = int(r_date.year)
                scar["r_angle"] = round(float(angle_of_date(r_date)), 4)
                scar["r_date"] = r_date.strftime("%Y-%m-%d")
            else:
                scar["r_year"] = None
            out.append(scar)
    out.sort(key=lambda sc: sc["date"])
    return out


def build_tree(ticker, cls, src):
    try:
        s = daily_close(ticker, src)
    except Exception:
        return None
    if len(s) < full_year_min_days(cls):
        return None

    rings = []
    prev_close, prev_year = None, None
    for year, s_year in s.groupby(s.index.year):
        s_year = s_year.dropna()
        if not len(s_year):
            continue
        # Chain only across adjacent years; after a feed gap the old close is stale.
        r = ring_for_year(year, s_year, cls, prev_close if prev_year == year - 1 else None)
        if r is not None:
            rings.append(r)
        prev_close, prev_year = float(s_year.iloc[-1]), year

    full_rings = [r for r in rings if not r["partial"]]
    if len(full_rings) < MIN_FULL_YEARS:
        return None

    rings.sort(key=lambda r: r["year"])

    # Never bridge a multi-year hole (dead/relisted tickers, feed gaps): a tree
    # cannot skip rings, so keep only the most recent contiguous run of years
    # and let the asset fail the age gate if what remains is too young.
    runs = [[rings[0]]]
    for r in rings[1:]:
        if r["year"] - runs[-1][-1]["year"] > 1:
            runs.append([])
        runs[-1].append(r)
    if len(runs) > 1:
        rings = runs[-1]
        print(f"  ! {ticker}: year gap in history — kept {rings[0]['year']}-{rings[-1]['year']}, "
              f"dropped {sum(len(run) for run in runs[:-1])} earlier ring(s)")
        full_rings = [r for r in rings if not r["partial"]]
        if len(full_rings) < MIN_FULL_YEARS:
            return None
        s = s[s.index.year >= rings[0]["year"]]

    # Whole-tree summary stats (for the enlarged single-tree panel + sorting).
    px_first = s.iloc[0]
    px_last = s.iloc[-1]
    years_elapsed = (s.index[-1] - s.index[0]).days / DAYS_PER_YEAR
    cagr = (px_last / px_first) ** (1.0 / years_elapsed) - 1.0 if years_elapsed > 0 else 0.0

    # Whole-history max drawdown.
    pxv = s.values
    runmax = np.maximum.accumulate(pxv)
    dd_all = pxv / runmax - 1.0
    worst_dd_all = float(dd_all.min())

    # Scar severity gate, in the asset's own units: a fall of SCAR_SIGMA times
    # its median full-year vol, in log space (so it can never exceed 100%), with
    # a small absolute floor. The old clamp to [15%, 50%] bound at an endpoint for
    # every bond, FX and crypto tree — FX carried one scar in twenty years, crypto
    # scarred at half its own annual vol. Now a 12% fall scars a currency fund,
    # a 20% fall scars the S&P, and Bitcoin needs about 57%.
    med_vol = float(np.median([r["vol"] for r in full_rings]))
    scar_thr = max(SCAR_MIN_DEPTH, 1.0 - float(np.exp(-SCAR_SIGMA * med_vol)))
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
    positive = float(np.mean(rets > 0))
    # Ring uniformity: std of full-year log-growth (lower = steadier grower).
    lg = np.array([r["log_growth"] for r in full_rings])
    uniformity = float(np.std(lg))

    return {
        "id": ticker,
        "cls": cls,
        "data_through": s.index[-1].strftime("%Y-%m-%d"),
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
        "positive": round(positive, 4),
        "uniformity": round(uniformity, 5),
        "first_year": rings[0]["year"],
        "last_year": rings[-1]["year"],
    }


# ---- featured forest selection ---------------------------------------------
# Majors across classes + a few extremes.  Everything else is computed and
# swappable via the selector; this is the curated public forest.

FEATURED = [
    # Curated lead — the order the Forest opens in. The first rows have to
    # teach the encoding before anything else: a century tree with 1929 and
    # 2008 carved in it, a steady compounder, a violent young one, a bond, a
    # commodity, a currency fund — old beside young, wide beside thin, scarred
    # beside smooth. After the lead the list runs by class.
    "us-market", "ko", "btc",
    "spy", "tlt", "eth",
    "gld", "nvda", "sol",
    "fxe", "brk.b", "doge",
    # crypto majors + extremes
    "xrp", "bnb", "ada", "ltc", "link", "avax",
    "shib", "pepe", "uni", "aave", "xlm", "xmr", "zec", "etc", "bch", "eos",
    "trx", "lunc", "mana", "mkr", "atom", "stx", "fil", "axs", "dot", "near",
    "inj", "ton", "render", "op",
    # equity index + megacap + extremes
    "qqq", "iwm", "aapl", "msft", "tsla", "amzn", "meta", "googl",
    "coin", "mstr", "mara", "pltr", "amd",
    "ge", "dis", "xom", "wmt", "jpm", "o", "intc", "asml",
    "nflx", "ewj", "eem",
    "ibm", "jnj", "mcd",   # 2026-09-18: three 1970-era elders round the forest to 100
    # bonds (old-growth, tight pale rings)
    "ief", "shy", "agg", "lqd", "hyg", "tip", "emb", "mbb",
    # commodities
    "slv", "uso", "dbc", "ung", "dba", "cper", "pplt",
    # fx
    "uup", "fxy", "fxa", "fxb", "fxc", "fxf",
    # century trees (Kenneth R. French Data Library, 1926->), from prices_public/
    "durables", "manufacturing", "energy",
    "chemicals", "tech", "telecom", "utilities", "retail", "healthcare",
    "finance",
]


def climate_years(trees, min_trees=30, top=6):
    """Years in which the forest was wounded TOGETHER.

    For each calendar year: breadth = share of trees alive that year whose scar
    troughed in it; R = mean resultant length of those troughs' calendar angles
    (1 = all on the same day, 0 = spread around the year). score = breadth × R,
    so a year ranks high only when many trees were hit AND at the same time.
    Years with fewer than `min_trees` living trees are excluded (too few to
    call a climate). Ported from the archived Climate Years lab.
    """
    alive, hits = {}, {}
    for tr in trees:
        for r in tr["rings"]:
            alive[r["year"]] = alive.get(r["year"], 0) + 1
        for sc in tr["scars"]:
            hits.setdefault(sc["year"], []).append(sc["angle"])
    rows = []
    for year, n in alive.items():
        if n < min_trees or year not in hits:
            continue
        ang = np.array(hits[year]) * 2 * np.pi
        R = float(np.hypot(np.cos(ang).mean(), np.sin(ang).mean()))
        breadth = len(ang) / n
        rows.append({"year": int(year), "n": int(n), "scarred": len(ang),
                     "breadth": round(breadth, 3), "R": round(R, 3),
                     "score": round(breadth * R, 4)})
    rows.sort(key=lambda x: -x["score"])
    return rows[:top]


def main():
    print(f"lake: {LAKE}")
    manifest = load_public_manifest()
    sources = load_sources(manifest)
    tk2cls = load_class_map(manifest)
    asset_names = load_asset_names(manifest)
    basis_map = load_basis(manifest)

    # ticker -> owning source; the first source listed wins a collision (and
    # says so, since a shadowed id would silently change what a tree means).
    # The public lake is listed first, so a public id can never be shadowed by
    # its undisplayable private-lake twin.
    owner = {}
    for src in sources:
        for t in src.tickers():
            if src.classes is not None and tk2cls.get(t) not in src.classes:
                continue
            if t in owner:
                print(f"warning: {t} exists in both {owner[t].name} and {src.name} "
                      f"lakes — keeping {owner[t].name}")
                continue
            owner[t] = src

    # A featured id present in NEITHER source is a wiring failure, not a data
    # gap — fail here rather than shipping a forest with a hole in it.
    # (scripts/validate.py --expect-featured is the second gate, post-bake.)
    missing = sorted(set(FEATURED) - set(owner))
    if missing:
        sys.exit(f"featured ids missing from every price source: {missing}")

    trees = []
    skipped = 0
    for t in sorted(owner):
        cls = tk2cls.get(t)
        if cls is None:
            skipped += 1
            continue
        tree = build_tree(t, cls, owner[t])
        if tree is None:
            skipped += 1
            continue
        tree["name"] = asset_names.get(t, t.upper())
        tree["basis"] = "spot" if cls == "crypto" else basis_map.get(t, "adjusted")
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

    # Normalization anchors so the renderer maps width/darkness consistently.
    # Computed over the FEATURED trees only: the 150-odd non-featured crypto
    # tokens never render, and letting them set crypto's anchors coloured the
    # visible trees against an invisible tail (and moved every time a token
    # entered or left the lake). Same principle as the fixed 100-year disc
    # reference — what is on the wall must not be re-normalized by what isn't.
    anchor_trees = [tr for tr in trees if tr["featured"]]
    all_lg = [r["log_growth"] for tr in anchor_trees for r in tr["rings"]]
    all_vol = [r["vol"] for tr in anchor_trees for r in tr["rings"]]
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
        vols = [r["vol"] for tr in anchor_trees if tr["cls"] == cls for r in tr["rings"]]
        lgs = [r["log_growth"] for tr in anchor_trees if tr["cls"] == cls for r in tr["rings"]]
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

    data_through = max(tr["data_through"] for tr in trees)
    climate = climate_years([tr for tr in trees if tr["featured"]])
    out = {
        "schema_version": 1,
        # Derived from source data rather than wall-clock bake time so an
        # unchanged lake produces byte-identical output and no empty CI commit.
        "generated": f"{data_through} market close",
        "data_through": data_through,
        "n_trees": len(trees),
        "n_featured": n_feat,
        "norm": norm,
        "climate_years": climate,
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
