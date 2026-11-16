---
categories: [PHP, Laravel, Security]
title: "PHP security this week (9–16 Nov 2026)"
date: 2026-11-16
description: "Quiet week in PHP: Laravel concurrency output injection (low), two medium code16/sharp flaws, and a FileGator upload/batch-download pair. None is on CISA KEV."
tags: [php, laravel, composer, weekly, sharp, filegator]
severity: Medium
hero: "posts/php-security-this-week-2026-11-16-hero.webp"
heroAlt: "Open leather ledger on a dark wooden desk under a brass lamp, a glowing emerald glass shield on the blank pages, and two brown paper parcels with green wax seals beside it"
---

*PHP Hub security brief · 16 Nov 2026 · Severity: Medium*

*Covers 9–16 Nov 2026 (IST). Official sources only: GitHub Security Advisories (Composer ecosystem), CISA KEV, php.net, wordpress.org, NVD. Times converted to IST. Checked 16 Nov 2026.*

**The short version:** a quiet week. Four real advisories (one Laravel, two Laravel-admin-panel `code16/sharp`, one pair in FileGator), all low to medium. None is marked as exploited in the wild. Routine updates, no panic.

> Checks done: no new PHP release since the 8.x security releases of 22 Oct 2026 (php.net ChangeLog); latest WordPress core offered by wordpress.org is 7.1.4; CISA KEV (catalog 2026.11.13) added nothing for PHP, Laravel, Symfony or WordPress this week. Fewer than five items is the honest count.

---

## 1. Laravel framework — concurrency task output injection (CVE-2026-128083 / GHSA-63hm-g96r-2m2q)

- **What it is:** If a `Concurrency::run()` task prints user-controlled text, an attacker may forge the framework's internal result message and, in certain conditions, get code execution. Needs unusual app code (a route using `Concurrency::run()` plus a task echoing user input), so not exploitable by default.
- **Affected:** `laravel/framework` < 12.71.0, and >= 13.0.0 < 13.40.0.
- **Fixed:** 12.71.0 and 13.40.0.
- **Severity:** GitHub rates it **low**; CVSS v4 2.3 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update laravel/framework` to 12.71.0+ / 13.40.0+. Grep for `Concurrency::run` and make sure tasks never print raw user input.
- **Source:** [GHSA-63hm-g96r-2m2q](https://github.com/advisories/GHSA-63hm-g96r-2m2q), published 14 Nov 2026, 12:24 AM IST.

## 2. code16/sharp — SSRF via autocomplete endpoint (CVE-2026-84987 / GHSA-g6f8-c3x9-jv7f)

- **What it is:** An authenticated user can use the Autocomplete API to make the server request another internal route (unanchored endpoint check).
- **Affected:** `code16/sharp` < 9.23.0; 10.0.0-beta.1 up to before 10.0.0-beta.4.
- **Fixed:** 9.23.0 and 10.0.0-beta.4.
- **Severity:** Medium; CVSS v3.1 5.4 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update code16/sharp`. Workaround per advisory: use `setRemoteCallback()` instead of `setRemoteEndpoint()`.
- **Source:** [GHSA-g6f8-c3x9-jv7f](https://github.com/advisories/GHSA-g6f8-c3x9-jv7f), published 12 Nov 2026, 11:51 PM IST.

## 3. code16/sharp — arbitrary class instantiation via `embed_key` (CVE-2026-84974 / GHSA-h24v-f482-8cwf)

- **What it is:** An authenticated user can make the Laravel container instantiate any class via the `embed_key` parameter. Constructor runs; attacker can't pass values or call methods.
- **Affected / fixed:** same as item 2 (< 9.23.0 → 9.23.0; 10.0.0-beta.1 to < beta.4 → 10.0.0-beta.4).
- **Severity:** Medium; CVSS v3.1 5.4 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** Same update as item 2 fixes both.
- **Source:** [GHSA-h24v-f482-8cwf](https://github.com/advisories/GHSA-h24v-f482-8cwf), published 12 Nov 2026, 11:48 PM IST.

## 4. FileGator — missing authorization on upload and batch download (CVE-2026-94619, CVE-2026-94618)

- **What it is:** A logged-in low-privilege user can read/delete other users' temporary files (`POST /upload`, GHSA-44r8-3p76-84mw) or download another user's batch ZIP if they get its id (`GET /batchdownload`, GHSA-f74m-x83r-c4v4). The advisory notes preconditions, so impact is bounded.
- **Affected:** `filegator/filegator` <= 7.14.4.
- **Fixed:** 7.15.0.
- **Severity:** Medium; CVSS v3.1 5.9 and 5.4 (as listed by GitHub).
- **Exploited in the wild:** Not reported.
- **What to do:** `composer update filegator/filegator` (or upgrade your FileGator install to 7.15.0). Review who has the `upload` permission.
- **Sources:** [GHSA-44r8-3p76-84mw](https://github.com/advisories/GHSA-44r8-3p76-84mw) and [GHSA-f74m-x83r-c4v4](https://github.com/advisories/GHSA-f74m-x83r-c4v4), both published 10 Nov 2026, about 3:47–3:50 AM IST.

---

## Quick checklist
1. `composer audit` in each project (it uses these same advisories).
2. Update Laravel to 12.71.0+ / 13.40.0+ at your next window.
3. Keep PHP on 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 or later (from the 22 Oct releases).

## Need a hand?
Want a second pair of eyes on your Laravel or PHP app? See our [security audit services](/services) or [get in touch](/contact).
