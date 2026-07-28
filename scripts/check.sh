#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/validate.py
python3 -c "from pathlib import Path; [compile(p.read_text(), str(p), 'exec') for p in map(Path, ('scripts/bake-rings.py', 'scripts/validate.py'))]"

for file in app/*.js shared/*.js; do
  node --check "$file"
done

./build.sh
test ! -d dist/labs
test -f dist/data/rings.json
test -f dist/methodology/index.html
test -f dist/assets/og-money-trees.png

if grep -rEn "Open the lab|lab ↗" dist; then
  echo "public build contains a lab link" >&2
  exit 1
fi

echo "All production checks passed."
