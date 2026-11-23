---
categories: [PHP, Laravel, Security]
title: "PHP security this week (16–23 Nov 2026)"
date: 2026-11-23
description: "Five PHP advisories worth a look: Jane OpenAPI codegen RCE, Silverstripe framework RCE, Paymenter (Laravel/Livewire) unauthenticated method call, Contao admin self-grant, and a SimpleSAMLphp SAML2 signature bypass. None is on CISA KEV."
tags: [php, laravel, composer, weekly, silverstripe, contao, paymenter]
severity: High
hero: "posts/php-security-this-week-2026-11-23-hero.webp"
heroAlt: "Open ledger on a dark desk with a glowing emerald glass shield, a brass padlock and an old key beside it"
---

*PHP Hub security brief · 23 Nov 2026 · Severity: High (for the affected packages only)*

*Covers 16–23 Nov 2026 (IST). Sources: GitHub Security Advisories (Composer ecosystem), CISA KEV. Versions and CVSS are exactly as GitHub lists them. Checked 23 Nov 2026.*

**The short version:** most of this week's advisories are in CMS/app packages, not core PHP, Laravel or Symfony. If you don't use these packages, nothing to do. CISA KEV (catalog 2026.11.20) added no PHP, Laravel, Symfony or WordPress item this week. I did not do a separate WordPress/WPScan pass this week, so no WordPress items are listed.

---

## 1. Jane (jane-php/open-api-3) — code-generation RCE (CVE-2026-63411, CVE-2026-63412, CVE-2026-63413)

- **What it is:** Crafted OpenAPI specs (parameter description, query or header parameter names) can break out of a generated PHPDoc comment and inject code at generation time. Risk is when you generate a client from an untrusted spec.
- **Affected:** `jane-php/open-api-3` < 7.12.0. **Fixed:** 7.12.0.
- **Severity:** GitHub rates these **critical** (no CVSS score listed). A related SSRF/LFI advisory (CVE-2026-63415) is rated high.
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update jane-php/open-api-3`. Only generate clients from specs you trust, and review generated code in a PR.
- **Sources:** [GHSA-q8v2-3j4h-xg2p](https://github.com/advisories/GHSA-q8v2-3j4h-xg2p), published 19 Nov 2026, 9:48 PM IST; [GHSA-x9xr-53qx-9qcf](https://github.com/advisories/GHSA-x9xr-53qx-9qcf); [GHSA-xwcw-j52r-34x4](https://github.com/advisories/GHSA-xwcw-j52r-34x4).

## 2. Silverstripe Framework — RCE via i18nTextCollectorTask (CVE-2026-91115 / GHSA-c94f-87xg-65wf)

- **What it is:** The `writer` parameter of the i18n text collector task can lead to remote code execution. Published together with five medium-severity Silverstripe Framework advisories (privilege escalation, auth bypass, two XSS, ClassName change).
- **Affected:** `silverstripe/framework` >= 6.0.0 < 6.2.13 . **Fixed:** 6.2.13.
- **Severity:** High; CVSS v3.1 8.8 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update silverstripe/framework` to 6.2.13. Make sure dev tasks aren't reachable on production.
- **Source:** [GHSA-c94f-87xg-65wf](https://github.com/advisories/GHSA-c94f-87xg-65wf), published 17 Nov 2026, 4:05 AM IST.

## 3. Paymenter (Laravel app) — unauthenticated Livewire method invocation (CVE-2026-103026 / GHSA-prhx-9q2h-ph2x)

- **What it is:** Unauthenticated arbitrary method invocation in Livewire components of the Paymenter billing app.
- **Affected:** `paymenter/paymenter` <= 1.5.6. **Fixed:** 1.5.7.
- **Severity:** High; CVSS v3.1 8.1 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** Upgrade Paymenter to 1.5.7 (`composer update paymenter/paymenter` or follow its upgrade guide). If you run your own Livewire app, keep `livewire/livewire` current and don't expose sensitive public methods.
- **Source:** [GHSA-prhx-9q2h-ph2x](https://github.com/advisories/GHSA-prhx-9q2h-ph2x), published 20 Nov 2026, 8:26 PM IST.

## 4. Contao core-bundle — non-admins can self-grant admin permissions (CVE-2026-104883 / GHSA-r9qp-pqx5-8369)

- **What it is:** Non-admin back-end users can give themselves permissions that implicitly make them administrators.
- **Affected:** `contao/core-bundle` >= 5.0.0 < 5.3.50, and >= 5.4.0-RC1 < 5.7.12. **Fixed:** 5.3.50 and 5.7.12.
- **Severity:** High; CVSS v3.1 7.2 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update contao/core-bundle contao/newsletter-bundle`. Review back-end user and group permissions.
- **Source:** [GHSA-r9qp-pqx5-8369](https://github.com/advisories/GHSA-r9qp-pqx5-8369), published 21 Nov 2026, 5:15 AM IST.

## 5. SimpleSAMLphp saml2 — signature bypass, incomplete earlier fix (CVE-2026-110782 / GHSA-r7hw-jx6r-756g)

- **What it is:** An unsigned embedded Response can bypass HTTP-Artifact signature checks (incomplete fix of CVE-2026-49283). A similar signature-wrapping issue was published for `litesaml/lightsaml` (CVE-2026-63182).
- **Affected:** `simplesamlphp/saml2` >= 6.2.2, <= 6.2.3; >= 7.0.0-rc1 < 7.0.0-rc2. **Fixed:** 6.2.4 and 7.0.0-rc2.
- **Severity:** High; CVSS v3.1 8.7 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update simplesamlphp/saml2` (and `litesaml/lightsaml` to 4.7.1 / 5.0.1 if used). Check SSO logs for unexpected logins.
- **Source:** [GHSA-r7hw-jx6r-756g](https://github.com/advisories/GHSA-r7hw-jx6r-756g), published 18 Nov 2026, 2:30 AM IST.

---

**Quick check for any project:** run `composer audit` and commit the updated `composer.lock` after tests pass.

## Need a security audit?

Want a second pair of eyes on your PHP/Laravel app? See [/services](/services) and get in touch via [/contact](/contact).
