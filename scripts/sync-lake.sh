#!/usr/bin/env bash
# sync-lake.sh — pull the slice of the empty-data lake that the bake reads from R2.
#
# The lake is published to the `empty-data-lake` R2 bucket after every nightly
# pipeline run (empty-data Stage 11, scripts/sync-r2.sh). This script is the ONE
# place that decides which objects Money Trees downloads; both the local bake and
# .github/workflows/refresh-rings.yml call it, so dev and CI bake from the same
# source.
#
# What it pulls, and why only that:
#   * prices_public/ + prices_public.json — the publishable namespace (Twelve
#     Data equities/ETFs/bonds/commodities/FX 1970->, plus the Kenneth R. French
#     century series 1926->). Everything the site draws except crypto.
#   * the CRYPTO slice of prices/ + groups.json — CoinGecko history, which only
#     exists in the private namespace. The rest of prices/ is Tiingo-sourced and
#     must never reach a public artifact, so it is not even downloaded.
#   * health.json — the freshness contract (generated_at); the caller gates on it.
#
# Usage:  scripts/sync-lake.sh [DEST]          (default DEST: ./lake, gitignored)
#
# Credentials, in order of preference:
#   * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment (CI), or
#   * the `[r2]` profile in ~/.aws (dev). Override with R2_PROFILE.
#   R2_ACCOUNT_ID must be set, or be readable from the sibling empty-data .env.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$REPO/lake}"
BUCKET="${R2_BUCKET:-empty-data-lake}"

if [[ -z "${R2_ACCOUNT_ID:-}" ]]; then
  for env in "$REPO/../empty-blank/empty-data/.env" "$REPO/../empty-data/.env"; do
    if [[ -f "$env" ]]; then
      R2_ACCOUNT_ID="$(grep -E '^R2_ACCOUNT_ID=' "$env" | tail -1 | cut -d= -f2)"
      [[ -n "$R2_ACCOUNT_ID" ]] && break
    fi
  done
fi
if [[ -z "${R2_ACCOUNT_ID:-}" ]]; then
  echo "sync-lake: R2_ACCOUNT_ID is not set and no empty-data .env was found" >&2
  exit 2
fi

AWS_ARGS=(--endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com")
if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
  AWS_ARGS+=(--profile "${R2_PROFILE:-r2}")
fi
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

mkdir -p "$DEST/prices" "$DEST/prices_public"

# Publishable namespace: everything.
aws s3 sync "s3://$BUCKET/prices_public" "$DEST/prices_public" "${AWS_ARGS[@]}" --no-progress
for f in prices_public.json groups.json health.json; do
  aws s3 cp "s3://$BUCKET/$f" "$DEST/$f" "${AWS_ARGS[@]}" --only-show-errors
done

# Private namespace: the crypto ids only (see the header note).
python3 - "$DEST/groups.json" > "$DEST/crypto-ids.txt" <<'EOF'
import json, sys
groups = json.load(open(sys.argv[1]))
ids = {t for g, ts in groups.items() if g.startswith("crypto") for t in ts}
print("\n".join(sorted(ids)))
EOF
echo "sync-lake: $(wc -l < "$DEST/crypto-ids.txt" | tr -d ' ') crypto ids"
xargs -P 8 -I{} aws s3 cp "s3://$BUCKET/prices/{}.parquet" "$DEST/prices/{}.parquet" \
  "${AWS_ARGS[@]}" --only-show-errors < "$DEST/crypto-ids.txt"

python3 - "$DEST/health.json" <<'EOF'
import json, sys
from datetime import datetime, timezone
gen = json.load(open(sys.argv[1]))["generated_at"]
age = datetime.now(timezone.utc) - datetime.fromisoformat(gen)
print(f"sync-lake: snapshot generated_at={gen} ({age.days}d {age.seconds // 3600}h old)")
EOF
