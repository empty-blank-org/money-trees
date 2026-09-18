# Public release checklist

## Required before first public announcement

- [x] Equity/ETF/bond/commodity/FX history now comes from Twelve Data via the upstream public namespace (`prices_public/`), whose free tier permits public display of derived data. Tiingo no longer feeds the published artifact. Keep the "Data provided by Twelve Data" attribution (dofollow link) on the methodology page and near the data on the main site, and keep published returns quantized to a whole percent (`RET_QUANT` in the bake) so the artifact cannot be inverted to vendor closes.
- [ ] Confirm the CoinGecko account/license covers public display of derived crypto metrics and retain the required attribution on the methodology page and site footer.
- [ ] Audit any additional upstream providers represented in the featured universe and record their public-display requirements in the Empty Data source catalog.
- [ ] Add `moneytreeforest.com` (chosen 2026-09-18 over moneytreerings.com, which was registered the same day and can redirect) to Cloudflare and attach it to the Pages project as the production custom domain. `moneytrees.fun` belongs to an unrelated crypto token project — never point anything at it.
- [ ] Redirect `www.moneytreeforest.com` to `https://moneytreeforest.com` (or deliberately choose the inverse) so there is one canonical host.
- [ ] Confirm Cloudflare has issued the edge TLS certificate and `https://moneytreeforest.com` resolves before announcing it.
- [ ] Keep the production `SITE_URL` at its default `https://moneytreeforest.com`; override it only for an intentionally separate preview environment.
- [ ] Confirm the R2 lake sync is current, then run the `Refresh tree rings` workflow once manually.
- [ ] Run `./scripts/check.sh` and confirm the `Validate production` workflow passes, including browser smoke tests.
- [ ] Test the production homepage, one long-history equity, one crypto specimen, touch inspection, keyboard inspection, poster download, 404 page, and methodology page.
- [ ] Validate the homepage social card with the target platforms' sharing debuggers after deployment, and one pre-rendered specimen page (`/specimen/btc/`): the build writes one stub per featured tree with its own title and description, and lists all of them in `sitemap.xml`.

## Ongoing

- Review source licenses whenever a provider, plan, or public use changes.
- Treat a failed refresh or validation workflow as a release blocker.
- Update `docs/ENCODING.md` whenever the renderer or bake contract changes.
- Keep the public methodology and visible data-through date aligned with the artifact.
