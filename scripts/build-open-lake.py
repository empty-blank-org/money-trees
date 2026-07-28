#!/usr/bin/env python3
"""
Grow Money Trees rings from TRULY-OPEN data: the Kenneth R. French Data Library.

Downloads the daily 12 Industry Portfolios (value-weighted returns, 1926->) and
the daily Fama/French research factors (Mkt-RF + RF), compounds each daily return
series into a synthetic total-return price index starting at 100, and writes a
self-contained mini-lake in the bake schema:

    openlake/data/prices/<id>.parquet         hour, price, open, high, low, volume, trade_count
    openlake/data/groups.json                 group -> [ids]   (drives asset class)
    openlake/data/fundamentals/meta.parquet   ticker, name (display names)

scripts/bake-rings.py reads this directory as a SECOND price source alongside
the $EMPTY_DATA lake (override with OPEN_LAKE), so:

    python3 scripts/build-open-lake.py && python3 scripts/bake-rings.py

The mini-lake is gitignored — it is cheap to regenerate and CI rebuilds it on
every scheduled bake. Only the downloaded zips are cached (openlake/_src).

Every series here is license-clean back to 1926 and is NOT subject to the
1970 licensing floor bake-rings.py applies to lake-sourced assets.

Source files (zipped CSVs with header/footer prose):
  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/12_Industry_Portfolios_daily_CSV.zip
  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip

Returns are in PERCENT. Missing data are -99.99 or -999.
"""
import io
import json
import os
import re
import subprocess
import sys
import zipfile

import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = os.path.abspath(os.environ.get("OPEN_LAKE", os.path.join(REPO, "openlake", "data")))
PRICES = os.path.join(LAKE, "prices")
CACHE = os.path.abspath(os.environ.get("OPEN_LAKE_CACHE", os.path.join(REPO, "openlake", "_src")))

BASE = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/"
IND_ZIP = "12_Industry_Portfolios_daily_CSV.zip"
FF3_ZIP = "F-F_Research_Data_Factors_daily_CSV.zip"

# Ken French's 12-industry short codes -> our asset id + display name.
#
# "Other" (mines, construction, transport, hotels, business services, ...) is
# deliberately omitted: it is the catch-all bucket left over after the eleven
# named industries, so its ring record describes no readable sector.
# "NoDur" (consumer nondurables) is omitted by curatorial choice.
INDUSTRIES = {
    "Durbl": ("durables",      "Consumer Durables"),
    "Manuf": ("manufacturing", "Manufacturing"),
    "Enrgy": ("energy",        "Oil, Gas & Coal"),
    "Chems": ("chemicals",     "Chemicals"),
    "BusEq": ("tech",          "Business Equipment (Tech)"),
    "Telcm": ("telecom",       "Telephone & Television"),
    "Utils": ("utilities",     "Utilities"),
    "Shops": ("retail",        "Wholesale & Retail"),
    "Hlth":  ("healthcare",    "Healthcare, Medical Equipment & Drugs"),
    "Money": ("finance",       "Finance"),
}
MARKET_ID, MARKET_NAME = "us-market", "Total U.S. Stock Market"

MISSING = (-99.99, -999.0, -99.99)


def fetch(zip_name):
    """Download (and cache) a Ken French zip; return the single CSV's text."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, zip_name)
    if not os.path.exists(path):
        print(f"downloading {zip_name} ...")
        # curl rather than urllib: this machine's Python has no CA bundle wired up.
        subprocess.run(["curl", "-fsSL", "-A", "money-trees/1.0",
                        "-o", path, BASE + zip_name], check=True)
    with zipfile.ZipFile(path) as z:
        name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        return z.read(name).decode("latin-1")


def parse_block(text, header_re=None):
    """Pull one daily YYYYMMDD block out of a Ken French CSV.

    The files are prose header + optionally several labelled blocks (value-
    weighted, equal-weighted, ...) + copyright footer.  We locate the column
    header line (the one starting with a bare comma) that follows `header_re`,
    then consume consecutive `^\\d{8},` rows.
    """
    lines = text.splitlines()
    start = 0
    if header_re is not None:
        for i, ln in enumerate(lines):
            if re.search(header_re, ln, re.I):
                start = i
                break
        else:
            raise SystemExit(f"block header {header_re!r} not found")
    # first column-header line at/after start
    for i in range(start, len(lines)):
        if lines[i].strip().startswith(","):
            cols = [c.strip() for c in lines[i].strip().split(",")][1:]
            hdr = i
            break
    else:
        raise SystemExit("no column header found")
    rows = []
    for ln in lines[hdr + 1:]:
        if not re.match(r"^\s*\d{8}\s*,", ln):
            if rows:
                break          # end of this block
            continue
        parts = [p.strip() for p in ln.split(",")]
        rows.append([parts[0]] + [float(p) for p in parts[1:]])
    df = pd.DataFrame(rows, columns=["date"] + cols)
    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d")
    df = df.set_index("date").sort_index()
    for c in cols:
        df.loc[df[c] <= -99.0, c] = np.nan     # -99.99 / -999 sentinels
    return df


def to_index(ret_pct):
    """Daily percent returns -> total-return index starting at 100 on day one.

    Days whose return is missing are dropped (not zeroed): the index only
    compounds observations that actually exist.
    """
    r = ret_pct.dropna() / 100.0
    if r.empty:
        return None
    idx = 100.0 * (1.0 + r).cumprod()
    # Prepend the base so day one is a real 100 observation and the first ring's
    # return is measured from the true start of the record.
    base = pd.Series([100.0], index=[r.index[0] - pd.Timedelta(days=1)])
    return pd.concat([base, idx])


def write_parquet(asset_id, series):
    os.makedirs(PRICES, exist_ok=True)
    hour = series.index.tz_localize("UTC") + pd.Timedelta(hours=21)   # daily bar, US close-ish
    px = series.to_numpy(dtype="float64")
    df = pd.DataFrame({
        "hour": hour,
        "price": px, "open": px, "high": px, "low": px,
        "volume": np.zeros(len(px), dtype="float64"),
        "trade_count": np.zeros(len(px), dtype="int64"),
    })
    df.to_parquet(os.path.join(PRICES, f"{asset_id}.parquet"), index=False)
    return df


def main():
    ind = parse_block(fetch(IND_ZIP), r"Average Value Weighted Returns\s*--\s*Daily")
    ff3 = parse_block(fetch(FF3_ZIP))
    print(f"industries: {ind.index.min().date()} -> {ind.index.max().date()}  n={len(ind)}  cols={list(ind.columns)}")
    print(f"ff3       : {ff3.index.min().date()} -> {ff3.index.max().date()}  n={len(ff3)}  cols={list(ff3.columns)}")

    # Total market total return = excess market return + risk-free rate.
    mkt = ff3["Mkt-RF"] + ff3["RF"]

    series = {MARKET_ID: to_index(mkt)}
    names = {MARKET_ID: MARKET_NAME}
    for code, (aid, label) in INDUSTRIES.items():
        # Every series keeps its full record: these are the arboretum's true
        # century elders, and the age-anchored sizing has nothing to say if
        # their history is trimmed.
        series[aid] = to_index(ind[code])
        names[aid] = label

    for aid, s in series.items():
        write_parquet(aid, s)
        print(f"  {aid:<14} {s.index[0].date()} -> {s.index[-1].date()}  n={len(s):>6}  "
              f"index {s.iloc[0]:.0f} -> {s.iloc[-1]:,.0f}  ({s.iloc[-1]/s.iloc[0]:,.0f}x)")

    # groups.json: bake-rings.py maps a group PREFIX to an asset class, so these
    # must start with "equity" to land in the equity class.
    groups = {
        "equity_index": [MARKET_ID],
        "equity_industry": [aid for aid, _ in INDUSTRIES.values()],
    }
    os.makedirs(LAKE, exist_ok=True)
    with open(os.path.join(LAKE, "groups.json"), "w") as f:
        json.dump(groups, f, indent=2)

    # fundamentals/meta.parquet supplies display names to the bake (load_asset_names).
    os.makedirs(os.path.join(LAKE, "fundamentals"), exist_ok=True)
    pd.DataFrame({"ticker": list(names), "name": [names[k] for k in names]}).to_parquet(
        os.path.join(LAKE, "fundamentals", "meta.parquet"), index=False)

    print(f"\nlake ready: {LAKE}  ({len(series)} assets)")


if __name__ == "__main__":
    main()
