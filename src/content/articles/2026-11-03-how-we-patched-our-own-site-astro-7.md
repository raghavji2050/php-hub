---
title: "How We Patched Our Own Site: Clearing 5 npm Advisories with an Astro 7 Upgrade"
date: 2026-11-03
description: "A real case study: npm audit flagged 5 advisories (1 critical) on PHP Hub. Here is how we upgraded Astro 5.18.2 to 7.4.5, moved CI to Node 22 and verified nothing broke."
summary: "npm audit flagged 5 advisories (1 critical) on PHP Hub. How we upgraded Astro 5.18.2 to 7.4.5, moved to Node 22 and proved nothing broke."
tags: ["security", "npm", "astro", "dependencies", "case-study"]
hero: "posts/astro7-patched-own-site-hero.webp"
heroAlt: "Abstract illustration of a glowing green shield with a check mark over dark green bars"
---

*This article was drafted with AI assistance. Every version number and advisory ID below was checked against the GitHub Advisory Database and our own pull request.*

We audit other people's code, so we should be able to show how we handle our own. On 2 November 2026 `npm audit` on this site (a static Astro build hosted on Vercel) reported **5 advisories: 1 critical, 3 high and 1 low**. This is exactly what we did, in about 30 minutes.

## What npm audit found

| Package | npm severity | Advisories (GitHub Advisory Database) | Fixed in |
|---|---|---|---|
| astro 5.18.2 | critical | [GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2) RCE through AVIF image optimization (critical); [GHSA-376h-93r7-7g6f](https://github.com/advisories/GHSA-376h-93r7-7g6f) authorization bypass when stripping the configured base (medium); [GHSA-98hj-9722-w3j8](https://github.com/advisories/GHSA-98hj-9722-w3j8) XSS via unescaped `<script>`/`<style>` content (medium) | 7.2.8 / 7.2.4 / 7.3.2 |
| sharp | high | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) (libvips), [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) (libheif), [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) (librsvg) | 0.35.5 |
| zod (and zod-to-ts through it) | high | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) memory exhaustion on oversized constrained collections | 4.6.6 |
| esbuild | low | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) arbitrary file read from the dev server on Windows | 0.28.1 |

npm offered only one fix: `npm audit fix --force`, which means jumping to `astro@7.4.5`, a breaking major upgrade.

## Should a static site care?

Partly. Several of these issues need a running server or dev server, and our production output is static HTML. But the build runs sharp on images, CI and local machines run the dev server, and "it probably doesn't apply" is not evidence. The cheapest safe answer was to upgrade and **prove** nothing changed.

## The steps

1. **Baseline.** Run `npm audit`, build, and save a copy of `dist/` to compare later.
2. **Upgrade.** `npm i astro@^7.4.5`. Transitive packages moved to sharp 0.35.5 and zod 4.6.7. `@astrojs/sitemap` 3.7.4 and `@astrojs/rss` 4.0.19 were already current.
3. **First failure.** The build failed on Node 20, because Astro 7 requires Node 22 or newer. We moved CI from Node 20 to 22 and added `.nvmrc` and `engines.node` to `package.json`.
4. **Rebuild and check links.** The build passed, and our link checker found 55 pages with 0 broken internal links.
5. **Diff the output.** We compared the old `dist/` with the new one, then committed and opened a pull request with CI.

No source or `astro.config` changes were needed. The site loads posts with `import.meta.glob`, not content collections, so there was nothing to migrate.

## How we proved nothing broke

- `npm audit` after the upgrade: **0 vulnerabilities**.
- The same 55 HTML routes before and after.
- The generated security headers and CSP, the sitemap and the RSS feed were byte-identical.
- Head meta, canonical URLs and JSON-LD were unchanged. Scripts were still external modules, with no new inline scripts.
- The only diffs were hashed asset filenames and equivalent HTML entity encoding (for example `&#38;` became `&amp;`).
- The contact form, spam honeypot and SEO meta were untouched.

## Takeaways for your PHP or JS project

- Treat `npm audit fix --force` as a planned major upgrade, not a quick fix. Branch it and review it.
- Snapshot your build output before upgrading, then diff it. That is the fastest way to show reviewers that nothing changed.
- Read each advisory's affected range and "patched in" version on the GitHub Advisory Database instead of trusting the severity label alone. npm rolled two medium Astro advisories up under one critical entry.
- Pin the runtime (`.nvmrc`, `engines`) in the same PR, so CI and production build the same way.

The same thinking applies to Composer: `composer audit` lists advisories for your `composer.lock`. If you want a second pair of eyes on your stack, see our [Services](/services) page.

## Sources

- GitHub Advisory Database entries linked in the table above.
- PHP Hub pull request: [raghavji2050/php-hub#14](https://github.com/raghavji2050/php-hub/pull/14)
- [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [npm audit documentation](https://docs.npmjs.com/cli/commands/npm-audit)
