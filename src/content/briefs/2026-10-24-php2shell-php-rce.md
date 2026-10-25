---
tags: [php, php-core, rce]
severity: Critical
---
# PHP2Shell: two critical PHP core RCE flaws fixed in 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35

*PHP Hub security brief · 24 Oct 2026 · Severity: Critical*

## What happened
On 21 Oct 2026 the PHP project shipped emergency security releases fixing two vulnerabilities in PHP itself (not in any framework or plugin). Both can allow **unauthenticated remote code execution**. CISA refers to them as "php2shell".

- **CVE-2026-109618** (GHSA-w8hw-w9fx-j79w), *RCE via OOM corruption*: if a request hits an out-of-memory condition at the wrong moment, request cleanup can treat partly initialised data as valid. Crafted multipart requests can reach this state.
- **CVE-2026-109619** (GHSA-6wmf-4rv5-p3rp), *RCE via stale global state*: request-owned state can outlive its freed memory, and a later request on the same worker may use it.

php.net's pre-announcement rates both **CVSS v4.0 9.2**. Other scores circulating online come from third parties and are not repeated here.

## Who is affected
php.net says the at-risk group is **all PHP installations serving web requests**: PHP-FPM, Apache mod_php, php-cgi, FrankenPHP and LiteSpeed. Risk is highest on **Apache + mod_php**, where a demonstrated exploit fires from an unauthenticated request before any application code runs. That covers WordPress, Laravel and custom PHP sites alike.

## Affected / fixed versions (per GHSA-w8hw-w9fx-j79w)
| Branch | Affected | Fixed |
|---|---|---|
| 8.5 | < 8.5.12 | **8.5.12** |
| 8.4 | < 8.4.27 | **8.4.27** |
| 8.3 | < 8.3.36 | **8.3.36** |
| 8.2 | < 8.2.35 | **8.2.35** |
| 8.1 and older | EOL, no official release | Upgrade to a supported branch, or use a distro/LTS vendor backport. php.net published minimal source backports for 7.4, 8.0 and 8.1 for people building from source. |

## Exploited in the wild?
**Unknown / not confirmed by CISA.** The CVEs are **not in CISA KEV** (catalog version 2026.10.23, checked 23 Oct 2026, 11:59 PM IST). CISA's 21 Oct alert said it had *not* observed exploitation at publication. Some third-party trackers report exploitation attempts, but we have not verified those reports.

## Fix steps for developers
1. **Find the real runtime version.** The CLI can differ from FPM or Apache, so check both:
   - `php -v` and `php-fpm8.x -v` (or `php-fpm -v`)
   - a temporary `phpinfo()` page that you delete right after, or the hosting panel's PHP version screen
2. **Upgrade.**
   - Debian/Ubuntu: `sudo apt update && sudo apt install --only-upgrade 'php8.*'`. Then confirm your distro or PPA ships a build containing the fix, since distros may backport under their own version numbers. Check your vendor's security tracker.
   - RHEL/Alma/Rocky: `sudo dnf update 'php*'`
   - Docker: bump the base image to `php:8.4.27-*`, `php:8.3.36-*` (etc.), rebuild and redeploy. Don't just restart the old image.
   - Shared hosting/cPanel: switch to the patched version in the PHP selector, or ask the host to confirm their build.
3. **Restart every worker** (`sudo systemctl restart php8.x-fpm` and/or `apache2`/`httpd`), then re-run step 1.
4. **If you can't upgrade today**, apply php.net's partial mitigations. They reduce exposure but do **not** make the server safe:
   - `session.upload_progress.enabled=0`, set in php.ini, the FPM pool or the server config (not `ini_set()` or `.user.ini`), then restart workers. php.net repeated this advice on 23 Oct for a related, low-likelihood issue (CVE-2026-115560).
   - On PHP 8.5: `fatal_error_backtraces=0`.
   - Set a low `post_max_size` (8M if there are no uploads, 32M with uploads), keep `upload_max_filesize` below it, and enforce request-size and multipart limits at the web server or proxy.
   - `memory_limit=-1` via `php_admin_value`, only as php.net describes and alongside a container or cgroup memory limit. Do **not** use `RLIMIT_AS`/`RLIMIT_DATA`.
   - CISA: if PHP 8.1 or older can't be patched, take it offline until it can be. A WAF may give some interim protection.
5. **Check for signs of compromise.** CISA advises monitoring for **PHP worker processes launching shells or downloading tools**. Also review:
   - PHP-FPM and Apache error logs for unusual worker crashes or segfaults
   - recently modified `.php` files in web roots and upload folders, e.g. `find /var/www -name '*.php' -mtime -7`
   - unexpected admin users or cron jobs

## Service angle
Many small sites run old PHP on cPanel or VPS hosts and don't know which version FPM actually uses. Paid, authorised help covers a version audit, patch or branch upgrade (incl. 7.x/8.1 → 8.3/8.4 compatibility fixes), and a post-patch compromise check on the owner's own server.

## Sources (dates in IST)
- php.net, *Security advisory: Critical remote code execution vulnerabilities, update now*, and the 8.x release notes: 21 Oct 2026, ~7:30 PM IST (14:00 UTC release). https://www.php.net/archive/2026.php
- php.net, *Upcoming Critical PHP Security Release* (CVSS v4.0 9.2): 20 Oct 2026. https://www.php.net/archive/2026.php
- php.net, *Informational advisory: Session upload progress*: 23 Oct 2026. https://www.php.net/archive/2026.php
- GitHub Security Advisory GHSA-w8hw-w9fx-j79w (php/php-src): 21 Oct 2026. https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w
- php.announce, PHP 8.3.36 Released: 21 Oct 2026, 7:30 PM IST. https://news-web.php.net/php.announce/511
- The PHP Foundation blog: 21 Oct 2026. https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/
- CISA alert, *Critical Vulnerabilities in PHP Require Immediate Patching*: 21 Oct 2026. https://www.cisa.gov/news-events/alerts/2026/10/21/critical-vulnerabilities-php-require-immediate-patching
- CISA KEV catalog (checked; not listed): https://www.cisa.gov/known-exploited-vulnerabilities-catalog
