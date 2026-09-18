#!/usr/bin/env bash
# Reproducible public build for Cloudflare Pages.
#
# Assembles the static site into dist/ — EXCLUDING the dev-only labs/ archive and
# stripping its links, so the public deploy carries no lab content and no dead paths.
# Cloudflare Pages runs this as the build command (output directory: dist).
# It only touches repo files (no lake access); the data (data/rings.json) is baked
# separately by .github/workflows/refresh-rings.yml and committed.
set -euo pipefail
cd "$(dirname "$0")"
SITE_URL="${SITE_URL:-https://moneytreerings.com}"
SITE_URL="${SITE_URL%/}"

rm -rf dist
mkdir -p dist
cp -r index.html 404.html app shared assets data methodology specimen dist/
# The committed artifact keeps every computed tree for the labs; the site can only
# open featured ones, so publish just those (about 40% of the payload).
python3 - <<'EOF'
import json
d = json.load(open('dist/data/rings.json'))
d['trees'] = [t for t in d['trees'] if t['featured']]
d['n_trees'] = len(d['trees'])
json.dump(d, open('dist/data/rings.json', 'w'), separators=(',', ':'))
EOF
cp site.webmanifest robots.txt sitemap.xml _headers dist/

# Strip the dev-only lab links from the public entry pages (portable sed: macOS + Linux).
sed -i.bak '/Open the lab/d' dist/index.html && rm -f dist/index.html.bak
sed -i.bak '/class="lab-link"/d' dist/specimen/index.html && rm -f dist/specimen/index.html.bak

# Resolve absolute sharing/canonical URLs at build time. Set SITE_URL in
# Cloudflare Pages when a custom domain replaces the default pages.dev host.
while IFS= read -r file; do
  sed -i.bak "s|__SITE_URL__|${SITE_URL}|g" "$file" && rm -f "$file.bak"
done < <(find dist -type f \( -name '*.html' -o -name '*.xml' -o -name 'robots.txt' \))

echo "Built dist/ ($(find dist -type f | wc -l | tr -d ' ') files, no labs/)"
