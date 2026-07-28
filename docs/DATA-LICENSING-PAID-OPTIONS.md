# Paid data-licensing options (if we monetize / go pro)

Research conclusions from July 2026, verified against live vendor pages. Not legal
advice. Context: the lake (empty-data) is fed by Tiingo EOD (stocks/ETFs, internal-use
tier) + paid CoinGecko (crypto). Money Trees publishes derived *annual* aggregates;
Empty Block would display real daily-granularity values to paying subscribers —
different licensing problems, even though they share the lake.

## The moment monetization starts, someone must sell us a display license

"Display license" = the vendor grants the right to show their data (or things computed
from it) to third parties in a product, including paying subscribers. Internal-use API
tiers (what we have with Tiingo today) explicitly exclude this.

## Ranked options for stocks/ETFs

### 1. Intrinio — preferred if Empty Block monetizes (~$250/mo, published terms)
- The published terms explicitly permit paywalled display: subscribers "can display
  the data in their application to their own end users," licensed for Business Use,
  with **"no per-user fees, display fees, or exchange requirements."**
- Why that matters: per-user fees (bill scales with your subscriber count), display
  fees (surcharge for showing data on screens), and exchange requirements (you sign
  paperwork + pay fees directly to NYSE/Nasdaq, with audits) are the three classic
  ways market-data bills balloon after signing. Intrinio rules all three out in
  public writing — you can read the whole deal before talking to sales.
- Reputation for reliability is good.
- Caveats: annual contracts are the norm; history depth to 1962 unverified (test
  before committing if the deep-history trees matter); lower-tier pricing not yet
  checked.

### 2. Tiingo Business display tier — $250/mo startup / $500/mo enterprise
- Listed on the EOD product page; covers **End-of-Day prices + IEX only** (fundamentals,
  news, forex, crypto are separately licensed, sales-only, and fundamentals is
  third-party-sourced — vendors often *can't* unilaterally grant display rights there).
- 1962-depth history, fully adjusted closes, zero migration (pipeline already on Tiingo).
- Everything decision-critical is in an **unpublished contract**: whether paywalled SaaS
  is OK at $250 vs $500, "startup" eligibility, multi-property scope, chart-display vs
  CSV-export line, user caps, audit rights. All sales-only. Scope is probably
  entity-level (pricing keys to company size, not property count), but the grant is
  scoped to whatever use case you describe — name every property (Money Trees, Empty
  Block, Asset ELO) up front if going this route.
- **Disliked clause (ToS §1.6)**: on termination you must "promptly and permanently
  delete all Tiingo Data from every system... including production systems, local
  storage, archives, backups, disaster-recovery systems" — the lake's daily-close
  store is Tiingo Data. Also, derived-data creation/retention technically requires
  written approval. Not a dealbreaker; annoying, and a real switching cost.

### 3. Twelve Data Venture — $499/mo ($414 annual), the "bulletproof" pick
- Only vendor combining a published commercial "external display" tier with a
  contractual **Derived Data ownership clause** ("Customer retains rights to Derived
  Data" that cannot be reverse-engineered to the underlying data) — both the display
  right and ownership of our published JSON in black-letter text.
- Enterprise ($1,099/mo) adds raw-data redistribution (we don't need it).
- Caveat: 1962-depth on oldest names unverified.

### Ruled out
- **Polygon/Massive Business**: $1,999/mo and only ~20yr history. Too shallow, too dear.
- **Intrinio Starter ($250)**: explicitly non-display — must be their business packages.
- **EODHD (~€20–80/mo)**: display requires discretionary written approval; commercial
  licensing quote-only. Cheapest *possible* outcome, but a negotiation, not a listed right.
- **FMP**: display agreement quote-only; weak deep history.
- **Xignite**: institutional, quote-only.
- **Databento**: cleanest redistribution license in the industry (US Equities Mini:
  zero license fees, free redistribution) but equities history starts ~2018. Future
  real-time layer only.

## Crypto side (already resolved)

- **CoinGecko explicitly allows commercial products** built on the API — "You are
  entitled to charge for your services and products that incorporate or integrates
  our CoinGecko API." Monetization does not break the crypto side. Required
  attribution regardless of tier: "Powered by CoinGecko" displayed prominently.
- We currently pay for the CoinGecko API; the lake's full crypto history was fetched
  under the paid plan. Their deletion clauses trigger only on CoinGecko-initiated
  termination or full relationship termination — downgrading paid→free is neither,
  so the lake is retainable post-cancel (keep an active free Demo key so the
  relationship never "terminates"; check the paid order form in the dashboard before
  cancelling — it isn't public and could have its own clause).
  Deliberate decision: do NOT email them asking to confirm post-cancel retention —
  the public text favors us, and asking invites adverse paper.

## Bottom line

- Nothing needs to change until a product charges its first user.
- When Empty Block monetizes: **Intrinio** is the working default (published paywall
  permission, no scaling fees), with Tiingo's $250 tier as the zero-migration
  alternative if their sales answers come back clean, and Twelve Data Venture as
  the max-certainty option.
- $250–500/mo is normal cost-of-goods for a paid data product; the thing to guard
  against isn't the sticker price but unpublished contracts where per-user fees,
  dataset add-ons, and audit rights appear later.
- Money Trees by itself never justifies a paid display license; it rides along only
  if an entity-scoped license exists anyway.
