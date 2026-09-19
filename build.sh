#!/usr/bin/env bash
# Reproducible public build for Cloudflare Pages.
#
# Assembles the static site into dist/ — EXCLUDING the dev-only labs/ archive, so
# the public deploy carries no lab content. The pages carry no lab links even in dev;
# the archive is reached by URL at /labs/.
# Cloudflare Pages runs this as the build command (output directory: dist).
# It only touches repo files (no lake access); the data (data/rings.json) is baked
# separately by .github/workflows/refresh-rings.yml and committed.
set -euo pipefail
cd "$(dirname "$0")"
SITE_URL="${SITE_URL:-https://moneytreeforest.com}"
SITE_URL="${SITE_URL%/}"

rm -rf dist
mkdir -p dist
cp -r index.html 404.html app shared assets data methodology tree compare dist/
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

# Pre-render one page per featured tree at /tree/<id>/ so a shared link
# previews as THAT tree (title, description) and search engines can find all 100.
# Each stub is the tree page with real meta tags, a <base> so the app's
# relative paths still resolve one level deeper, and the id injected. The app
# then writes pretty URLs itself (window.PRETTY_ROUTES). /tree/?id= still works.
python3 - <<'PY'
import json, html, re, os
rings = json.load(open('dist/data/rings.json'))
src = open('dist/tree/index.html').read()
flag = '<script>window.PRETTY_ROUTES=true</script>'
open('dist/tree/index.html', 'w').write(src.replace('<head>', '<head>' + flag, 1))
home = open('dist/index.html').read()
open('dist/index.html', 'w').write(home.replace('<head>', '<head>' + flag, 1))
cmp = open('dist/compare/index.html').read()
open('dist/compare/index.html', 'w').write(cmp.replace('<head>', '<head>' + flag, 1))
urls = []
for t in rings['trees']:
    tid, name = t['id'], html.escape(t['name'])
    title = f"{name} — Money Tree Forest"
    n_sc = len(t['scars'])
    desc = html.escape(f"{t['name']} ({t['id'].upper()}) as tree rings: {t['n_rings']} annual rings, "
                       f"{t['first_year']}–{t['last_year']}. {t['cagr']*100:+.1f}% annualized growth, "
                       f"worst drawdown {t['worst_dd']*100:.0f}%, {n_sc} major scar{'s' if n_sc != 1 else ''}.")
    page = src.replace('<head>', f'<head><base href="/tree/">{flag}<script>window.TREE_ROUTE="{tid}"</script>', 1)
    page = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', page, count=1)
    page = page.replace('<meta property="og:title" content="One tree — Money Tree Forest">', f'<meta property="og:title" content="{title}">')
    page = page.replace('<meta name="description" content="Explore a financial asset’s complete annual tree-ring record, including growth, volatility, and drawdown scars.">', f'<meta name="description" content="{desc}">')
    page = page.replace('<meta property="og:description" content="A complete financial history rendered as annual tree rings.">', f'<meta property="og:description" content="{desc}">')
    page = page.replace('__SITE_URL__/tree/', f'__SITE_URL__/tree/{tid}/')
    if os.path.exists(f'dist/assets/og/{tid}.jpg'):   # per-tree preview image, rendered by scripts/render-og.js
        page = page.replace('__SITE_URL__/assets/og-money-trees.png', f'__SITE_URL__/assets/og/{tid}.jpg')
    os.makedirs(f'dist/tree/{tid}', exist_ok=True)
    open(f'dist/tree/{tid}/index.html', 'w').write(page)
    urls.append(f'  <url><loc>__SITE_URL__/tree/{tid}/</loc></url>')
sm = open('dist/sitemap.xml').read().replace('</urlset>', '\n'.join(urls) + '\n</urlset>')
open('dist/sitemap.xml', 'w').write(sm)
print(f"pre-rendered {len(urls)} tree pages")
PY


# Resolve absolute sharing/canonical URLs at build time. Set SITE_URL in
# Cloudflare Pages when a custom domain replaces the default pages.dev host.
while IFS= read -r file; do
  sed -i.bak "s|__SITE_URL__|${SITE_URL}|g" "$file" && rm -f "$file.bak"
done < <(find dist -type f \( -name '*.html' -o -name '*.xml' -o -name 'robots.txt' \))

echo "Built dist/ ($(find dist -type f | wc -l | tr -d ' ') files, no labs/)"
