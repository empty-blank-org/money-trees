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

rm -rf dist
mkdir -p dist
cp -r index.html 404.html app shared data specimen dist/

# Strip the dev-only lab links from the public entry pages (portable sed: macOS + Linux).
sed -i.bak '/Open the lab/d' dist/index.html && rm -f dist/index.html.bak
sed -i.bak '/class="lab-link"/d' dist/specimen/index.html && rm -f dist/specimen/index.html.bak

echo "Built dist/ ($(find dist -type f | wc -l | tr -d ' ') files, no labs/)"
