---
tags: [php, php-core, symfony, phpspreadsheet, phpunit, weekly]
severity: Critical
status: Actively exploited
---
# PHP security this week (26 Oct – 2 Nov 2026)

*PHP Hub security brief · 2 Nov 2026 · Severity: Critical*

Five items worth a look this week, from official sources only (checked 2 Nov 2026 against NVD, the CISA KEV catalog and GitHub advisories). One is urgent (PHP itself); the rest are routine upgrades. We didn't find a major new WordPress core advisory in this window, so it's not listed.

## 1. PHP core: two RCE bugs now on CISA's exploited list
**CVE-2026-109618** (OOM memory corruption) and **CVE-2026-109619** (stale request-state)

- **Update:** our [24 Oct PHP2Shell brief](/briefs/2026-10-24-php2shell-php-rce) said these were not yet in KEV; that has now changed.
- **Summary:** Two PHP engine bugs can let an unauthenticated attacker reach remote code execution under certain conditions.
- **Severity:** Critical, CVSS 4.0 base score 9.2 (as published by security@php.net on NVD).
- **Affected / fixed:** below 8.2.35, 8.3.36, 8.4.27 and 8.5.12; fixed in **8.2.35, 8.3.36, 8.4.27, 8.5.12** (released 21 Oct 2026).
- **Exploited in the wild:** Yes. CISA added both to its Known Exploited Vulnerabilities catalog on 26 Oct 2026.
- **What to do:** Run `php -v` on every server and container, and upgrade to the patched release for your branch (update your base Docker image or ask your host). Restart PHP-FPM afterwards.
- **Sources:** [CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=CVE-2026-109618) (both added 26 Oct 2026), [NVD CVE-2026-109618](https://nvd.nist.gov/vuln/detail/CVE-2026-109618), [NVD CVE-2026-109619](https://nvd.nist.gov/vuln/detail/CVE-2026-109619), [PHP advisory GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) [php.net releases](https://www.php.net/releases/)

## 2. Symfony YAML: one document can crash the process
**CVE-2026-109413** (GHSA-2v3c-qxhr-7vpv), severity high

- **Summary:** Unbounded recursion in the YAML inline parser means a crafted YAML document can crash PHP if you parse untrusted YAML.
- **Fixed in:** `symfony/yaml` (and `symfony/symfony`) 5.4.54, 6.4.45, 7.4.18 and 8.1.6.
- **Exploited in the wild:** Not reported in the advisory.
- **What to do:** `composer update symfony/yaml`, then check `composer show symfony/yaml`.
- **Source:** [GitHub advisory](https://github.com/advisories/GHSA-2v3c-qxhr-7vpv) (28 Oct 2026, 12:31 AM IST)

## 3. Symfony HttpFoundation: ReDoS via the Cache-Control header
**CVE-2026-108082** (GHSA-r925-mgvr-h9cc), severity high

- **Summary:** A slow regex in `HeaderUtils::split()` can be triggered by a crafted `Cache-Control` request header, tying up CPU. Laravel uses this package for every request.
- **Fixed in:** `symfony/http-foundation` 5.4.54, 6.4.46, 7.4.19 and 8.1.7.
- **Exploited in the wild:** Not reported in the advisory.
- **What to do:** `composer update symfony/http-foundation` and redeploy.
- **Source:** [GitHub advisory](https://github.com/advisories/GHSA-r925-mgvr-h9cc) (28 Oct 2026, 12:31 AM IST)

## 4. PhpSpreadsheet: XXE, SSRF and DoS on file import
**CVE-2026-108357**, **CVE-2026-108358** (XmlScanner bypass, XXE/DoS, high), **CVE-2026-108359** (ODS DoS, high), **CVE-2026-108360** (SSRF, medium)

- **Summary:** Crafted spreadsheet uploads can bypass the XML safety scanner, exhaust memory, or make the server fetch internal URLs. This matters if users upload Excel/ODS files (Laravel Excel uses this library).
- **Fixed in:** `phpoffice/phpspreadsheet` 5.10.0, 3.10.8, 2.4.8, 2.1.19 and 1.30.7 (check the advisory for your branch; CVE-2026-108357 lists fixes for the 3.x+ lines only).
- **Exploited in the wild:** Not reported in the advisories.
- **What to do:** `composer update phpoffice/phpspreadsheet`, and keep upload size limits in place.
- **Sources:** [GHSA-rxj4-h86g-25gc](https://github.com/advisories/GHSA-rxj4-h86g-25gc), [GHSA-3x94-m842-937c](https://github.com/advisories/GHSA-3x94-m842-937c), [GHSA-j2w7-387v-m2rq](https://github.com/advisories/GHSA-j2w7-387v-m2rq), [GHSA-2phh-27fw-q4gc](https://github.com/advisories/GHSA-2phh-27fw-q4gc) (all 27 Oct 2026, about 9:08 PM IST)

## 5. PHPUnit: local code execution via shared temp dir
**CVE-2026-119193** (GHSA-9vw2-f4vp-x7gf), severity medium

- **Summary:** On machines shared by several users, another local user could run code through PHPT code-coverage temp files.
- **Affected / fixed:** `phpunit/phpunit` 13.4.0 up to before 13.4.4; fixed in 13.4.4.
- **Exploited in the wild:** Not reported in the advisory.
- **What to do:** `composer update phpunit/phpunit --with-dependencies` on shared CI runners or dev boxes.
- **Source:** [GitHub advisory](https://github.com/advisories/GHSA-9vw2-f4vp-x7gf) (31 Oct 2026, 4:31 AM IST)

---

**Quick habit:** run `composer audit` in CI so issues like these show up on their own.

Want a second pair of eyes on your PHP or Laravel app? See our [security audit services](/services) or [get in touch](/contact).
