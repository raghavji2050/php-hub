# Launch checklist

Live site: https://php-hub-rj.vercel.app

## Before every release
- [ ] `npm ci && npm run build` passes (also regenerates `vercel.json` via `scripts/gen-vercel-json.mjs`).
- [ ] `node scripts/check-links.mjs` reports 0 broken internal links in `dist/`.
- [ ] CI (`.github/workflows/ci.yml`) is green on the PR.
- [ ] No secrets committed (`.env*` stays out of git; endpoints come from `PUBLIC_*` env vars).

## Security headers (set in `scripts/gen-vercel-json.mjs`, never edit `vercel.json` by hand)
- [ ] CSP keeps `'self'` (covers Vercel Analytics at `/_vercel/insights`), `'wasm-unsafe-eval'` (Pagefind) and the Formspree origin in `connect-src` / `form-action`.
- [ ] HSTS, X-Frame-Options DENY + `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, COOP `same-origin`, X-Permitted-Cross-Domain-Policies `none`.
- [ ] Verify on live: `curl -sI https://php-hub-rj.vercel.app/ | grep -iE 'content-security|strict-transport|cross-origin'`.

## Dependencies
- [ ] `npm audit`; apply `npm audit fix` (no `--force`). Remaining advisories needing a major Astro upgrade are tracked separately.

## Live QA after deploy
- [ ] `/`, `/lessons`, `/articles`, `/contact` return 200 (also covered by `uptime.yml`).
- [ ] Crawl internal links; external 403/429 (e.g. Medium, LeetCode bot blocking) = unverified, check manually.
- [ ] Contact form submits (Formspree) and search (Pagefind) works with no CSP errors in the console.
- [ ] Vercel Analytics records page views.
