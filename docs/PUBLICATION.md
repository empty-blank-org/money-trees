# Public release checklist

## Required before first public announcement

- [ ] Confirm written Tiingo display/redistribution permission covers the derived annual metrics published by Money Trees. Tiingo's standard internal-use plans do not grant redistribution rights.
- [ ] Confirm the CoinGecko account/license covers public display of derived crypto metrics and retain the required attribution on the methodology page.
- [ ] Audit any additional upstream providers represented in the featured universe and record their public-display requirements in the Empty Data source catalog.
- [ ] Add `moneytrees.fun` to Cloudflare and attach it to the Money Trees Pages project as the production custom domain.
- [ ] Redirect `www.moneytrees.fun` to `https://moneytrees.fun` (or deliberately choose the inverse) so there is one canonical host.
- [ ] Confirm Cloudflare has issued the edge TLS certificate and `https://moneytrees.fun` resolves before announcing it.
- [ ] Keep the production `SITE_URL` at its default `https://moneytrees.fun`; override it only for an intentionally separate preview environment.
- [ ] Confirm the R2 lake sync is current, then run the `Refresh tree rings` workflow once manually.
- [ ] Run `./scripts/check.sh` and confirm the `Validate production` workflow passes, including browser smoke tests.
- [ ] Test the production homepage, one long-history equity, one crypto specimen, touch inspection, keyboard inspection, poster download, 404 page, and methodology page.
- [ ] Validate the homepage social card with the target platforms' sharing debuggers after deployment.

## Ongoing

- Review source licenses whenever a provider, plan, or public use changes.
- Treat a failed refresh or validation workflow as a release blocker.
- Update `docs/ENCODING.md` whenever the renderer or bake contract changes.
- Keep the public methodology and visible data-through date aligned with the artifact.
