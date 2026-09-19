// Render one link-preview image per featured tree: assets/og/<id>.jpg (1200×630).
//
// Screenshots scripts/og/index.html?id=<id> for every featured tree in data/rings.json.
// A tree is re-rendered only when its signature (name, ring count, scar count) changed
// since the last render — recorded in assets/og/manifest.json — so the images do not
// churn on every daily bake; a new ring or a new scar is what changes the picture.
//
//   node scripts/render-og.js http://localhost:8081          # against a running server
//   node scripts/render-og.js http://localhost:8081 --force  # re-render everything
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const base = process.argv[2];
if (!base) { console.error('usage: node scripts/render-og.js <server-url> [--force]'); process.exit(2); }
const force = process.argv.includes('--force');
const root = path.resolve(__dirname, '..'), outDir = path.join(root, 'assets', 'og'), manifestPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
const rings = JSON.parse(fs.readFileSync(path.join(root, 'data', 'rings.json'), 'utf8'));
const featured = rings.trees.filter(t => t.featured);
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const sig = t => `${t.name}|${t.n_rings}|${t.scars.length}`;

(async () => {
  const todo = featured.filter(t => force || manifest[t.id] !== sig(t) || !fs.existsSync(path.join(outDir, `${t.id}.jpg`)));
  console.log(`render-og: ${featured.length} featured, ${todo.length} to render`);
  if (!todo.length) return;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const t of todo) {
    await page.goto(`${base}/scripts/og/?id=${encodeURIComponent(t.id)}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, `${t.id}.jpg`), type: 'jpeg', quality: 84 });
    manifest[t.id] = sig(t);
    process.stdout.write(`  ${t.id}\n`);
  }
  await browser.close();
  // Drop images for trees that are no longer featured.
  for (const id of Object.keys(manifest)) if (!featured.some(t => t.id === id)) { delete manifest[id]; try { fs.unlinkSync(path.join(outDir, `${id}.jpg`)); } catch {} }
  fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
  console.log('render-og: done');
})().catch(e => { console.error(e); process.exit(1); });
