---
categories: [WordPress, PHP, Symfony, Security]
tags: [wordpress, php, php-core, symfony, composer, weekly, kev]
severity: Critical
status: Actively exploited
---
# PHP security this week (2–9 Nov 2026)

*PHP Hub security brief · 9 Nov 2026 · Severity: Critical*

*Covers 2–9 Nov 2026 (IST). Official sources only: php.net, NVD, CISA KEV, GitHub Security Advisories, Packagist / FriendsOfPHP, wordpress.org. Times converted to IST. Checked 9 Nov 2026.*

**The short version:** four items worth your attention. Two are already on CISA's "exploited in the wild" list (a WordPress core flaw and the PHP "PHP2Shell" pair). The rest are routine patch-and-move-on updates. Nothing here needs panic; it needs a maintenance window.

> No new Laravel advisory was published this week (latest on GitHub Advisories: 23 Oct 2026), so Laravel is not listed. Fewer than five items is the honest count.

---

## 1. WordPress core — upgrade-window remote code execution (CVE-2026-119977)

- **What it is:** WordPress core staged files in predictable, web-accessible paths during full-package core upgrades. An unauthenticated attacker could run code on the server during that upgrade window (CWE-367, race condition).
- **Affected:** WordPress 4.7 through 7.1.3 (NVD lists per-branch ranges up to the 7.1.4 fix).
- **Fixed:** 7.1.4. WordPress says the security fixes were backported to all branches eligible to receive security fixes (currently through 4.7), and "will ship as they become ready".
- **Exploited in the wild:** **Yes, per CISA.** Added to the KEV catalog on 3 Nov 2026 (CISA gives a date only). CISA's due date was 6 Nov 2026. Ransomware use: "Unknown".
- **What to do:** Update to 7.1.4 (or your branch's backport once available). Check for unexpected files after any recent core upgrade and review access logs from the upgrade window.
- **Sources:**
  - [CISA KEV entry](https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=CVE-2026-119977), added 3 Nov 2026
  - [NVD CVE-2026-119977](https://nvd.nist.gov/vuln/detail/CVE-2026-119977), last modified 4 Nov 2026, 6:22 PM IST
  - [WordPress 7.1.4 release post](https://wordpress.org/news/2026/10/wordpress-7-1-4/), published 28 Oct 2026 (before this week's window, but the KEV listing landed inside it)

## 2. PHP — "PHP2Shell" pair (CVE-2026-109618 and CVE-2026-109619)

- **What it is:** Two flaws in how PHP handles memory and request state.
  - CVE-2026-109618: out-of-memory handling can leave memory uninitialised, which can lead to remote code execution.
  - CVE-2026-109619: stale request-state can lead to remote code execution.
- **Affected (as NVD states):** 109618: PHP 7.3.0 up to before 8.2.35, 8.3.0 before 8.3.36, 8.4.0 before 8.4.27, 8.5.0 before 8.5.12. 109619: the same fixed versions, starting from 5.4.0.
- **Fixed:** PHP 8.2.35, 8.3.36, 8.4.27 and 8.5.12. php.net's ChangeLog dates these releases 22 Oct 2026; the GitHub advisories were published 21 Oct 2026. NVD lists no fix for older branches, so anything below 8.2 needs an upgrade path.
- **Rating (NVD, source: security@php.net):** CVSS 4.0 base score 9.2 for both; attack complexity is rated High.
- **Exploited in the wild:** **Yes, per CISA.** Both were added to KEV on 26 Oct 2026.
- **What's new this week:** We already covered these in the [24 Oct PHP2Shell brief](/briefs/2026-10-24-php2shell-php-rce) and [last week's brief](/briefs/2026-11-02-php-security-this-week). NVD last modified both entries on 5 Nov 2026 (6 Nov 2026, 12:47 AM IST) and lists php:php CPE ranges for the affected versions.
- **What to do:** Move to 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 or later. If you can't yet, check whether your host's distro has backported the fix.
- **Sources:**
  - [NVD CVE-2026-109618](https://nvd.nist.gov/vuln/detail/CVE-2026-109618)
  - [NVD CVE-2026-109619](https://nvd.nist.gov/vuln/detail/CVE-2026-109619)
  - [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=CVE-2026-109618), added 26 Oct 2026
  - [php-src advisory GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w)
  - [php.net ChangeLog 8.x](https://www.php.net/ChangeLog-8.php)
- **Heads-up:** PHP 8.6.0 GA is planned for 19 Nov 2026. That's a feature release, not a fix for the above.

## 3. Symfony — Security Release 2026-4 (21 advisories, 4 Nov 2026)

- **What it is:** A batch of 21 advisories across Symfony components, published together on 4 Nov 2026 at 5:13 PM IST (11:43 UTC). Notable ones rated "high" on GitHub:
  - **CVE-2026-121623** — `DataUriNormalizer` can open data URIs with a non-lowercase scheme as local files.
  - **CVE-2026-118515** — the Serializer can build `UploadedFile` objects from request data.
  - **CVE-2026-121971** — `ScopingHttpClient` can send default-scope credentials to other origins.
  - **CVE-2026-123792** — YAML parser can take exponential or quadratic time on one crafted document (DoS).
  - **CVE-2026-118513** — X509 authenticators misread escaped characters in a DN value.
- **Affected / fixed (Packagist advisory ranges):** symfony/symfony and the affected components are fixed in **5.4.56, 6.4.50, 7.4.23 and 8.1.11**. Older versions in each line are affected. Check each advisory for the exact range of the component you use.
- **Exploited in the wild:** None stated in the advisories; not on CISA KEV.
- **What to do:** Run `composer update "symfony/*"` to the versions above, then `composer audit`. The ones above matter most if you accept untrusted YAML, uploads or serialized request data.
- **Sources:**
  - [Symfony security advisories list](https://symfony.com/blog/category/security-advisories), 4 Nov 2026
  - [GitHub advisory GHSA-pxj9-jh84-vhm5 (CVE-2026-121623)](https://github.com/symfony/symfony/security/advisories/GHSA-pxj9-jh84-vhm5)
  - [GitHub advisory GHSA-h38r-xrmh-cwhr (CVE-2026-118515)](https://github.com/symfony/symfony/security/advisories/GHSA-h38r-xrmh-cwhr)
  - [FriendsOfPHP security-advisories](https://github.com/FriendsOfPHP/security-advisories), added 4 Nov 2026, 5:33 PM IST

## 4. paragonie/halite (Composer library) — AAD not bound in file encryption (PKSA-rpfb-zysg-cdwj)

- **What it is:** In Halite's file cryptography, the "additional authenticated data" (AAD) parameter wasn't correctly bound. Details are in the linked advisory.
- **Affected:** `>=5, <5.1.5` (as Packagist states).
- **Fixed:** 5.1.5.
- **Exploited in the wild:** Not stated.
- **What to do:** If you use Halite 5 for file encryption, update to 5.1.5 or later. Everyone else can ignore this one.
- **Sources:**
  - [GitHub advisory GHSA-jw8x-c445-phrm](https://github.com/paragonie/halite/security/advisories/GHSA-jw8x-c445-phrm)
  - Packagist listing dated 6 Nov 2026 (date only)
  - FriendsOfPHP commit merged 6 Nov 2026, 9:22 PM UTC = **7 Nov 2026, 2:52 AM IST**
- *No CVE ID was shown on the sources I checked.*

---

## Checked but not included

- **CVE-2026-115560:** I could not find it in NVD (no record returned on 9 Nov 2026), so I'm not treating it as a confirmed advisory. We'll re-check once php.net or NVD publishes it.
- **PHPUnit CVE-2026-119193** (local code execution via shared `/tmp` in PHPT coverage, fixed in 13.4.4) was published 29–30 Oct 2026 (GitHub advisory 31 Oct 2026, 4:31 AM IST), so it falls outside this week's window. Low likelihood, and only affects shared dev machines.

## Need a second pair of eyes?

If you'd like someone to check your PHP, Laravel, Symfony or WordPress stack against this list, we can help with a security audit.

- See what we offer: [/services](/services)
- Talk to us: [/contact](/contact)
