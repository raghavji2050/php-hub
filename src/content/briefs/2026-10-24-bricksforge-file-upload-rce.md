---
severity: Critical
status: Actively exploited
---
# Bricksforge (WordPress) unauthenticated file upload → RCE, actively exploited: CVE-2026-85097

*PHP Hub security brief · 24 Oct 2026 · Severity: Critical*

## What happened
Patchstack reports active exploitation of **CVE-2026-85097** in **Bricksforge**, a commercial add-on for the Bricks builder on WordPress. The flaw is an **unauthenticated arbitrary file upload** that leads to remote code execution.

Bricksforge checks a file's MIME type on upload, but when a form is submitted it trusts client-sent metadata: the `url` field inside the `temporaryFileUploads` parameter. That lets an attacker turn an image/PHP polyglot into an executable `.php` file. Patchstack first saw exploitation on **8 Oct 2026, 3:17 AM IST** (7 Oct, 21:47 UTC), with traffic that looked automated and came from many IPs.

## Who is affected
WordPress sites running Bricksforge **≤ 3.1.8.9**. Patchstack puts usage at roughly 6,000 sites. No login is needed to exploit it.

## Affected / fixed versions
- **Affected:** ≤ 3.1.8.9
- **Fixed:** **3.1.8.10** (also fixed in 4.0.0, per the vendor changelog)
- **Recommended:** the latest release. The vendor changelog lists **4.0.1** (8 Oct 2026), with a further Pro Forms upload security fix that applies even to forms without upload fields.

## CVE / CVSS
- CVE-2026-85097
- **CVSS 10.0 (Critical) per Patchstack.** Some outlets cite 9.8 from other scorers. Patchstack's advisory is the primary source used here.

## Exploited in the wild?
**Yes, per Patchstack** ("Active exploitation observed"). It is **not in CISA KEV** (catalog version 2026.10.23, checked 23 Oct 2026, 11:59 PM IST).

## Fix steps for developers
1. **Check the version:** `wp plugin list --name=bricksforge`, or WP Admin → Plugins.
2. **Update to 4.0.1 (or at least 3.1.8.10).** Bricksforge is commercial, so `wp plugin update bricksforge` only works with an active licence. Otherwise download the latest zip from your Bricksforge account and replace the plugin. If you can't update immediately, deactivate the plugin: `wp plugin deactivate bricksforge`.
3. **Search access logs** for the exploitation pattern Patchstack published:
   - `grep -E "POST /wp-json/bricksforge/v1/form_submit|bricksforge_form_submit" /var/log/nginx/access.log*` (or the Apache equivalent)
   - Request bodies are rarely logged. Where they are (WAF logs), look for `temporaryFileUploads` entries whose server path ends in `.gif`/`.png` but whose `url` ends in `.php`.
4. **Look for dropped PHP files:**
   - `find wp-content/uploads/bricksforge/tmp -type f -name '*.php*'`
   - `find wp-content/uploads -type f -name 'login_admin_*.php'`
   - `find wp-content/uploads -type f -name '*.php'` (WordPress uploads should normally contain no PHP)
5. **If anything turns up, treat it as a full compromise.** Updating does not remove a backdoor. Then:
   - Review admin users: `wp user list --role=administrator`
   - Verify core checksums: `wp core verify-checksums`. For plugins on wordpress.org, also run `wp plugin verify-checksums --all`.
   - Rotate WP salts, admin passwords, DB credentials and API keys.
   - Restore from a clean backup if needed.
6. **Hardening:** block PHP execution in `wp-content/uploads`, e.g. an nginx `location ~* /wp-content/uploads/.*\.php$ { deny all; }` or an Apache `.htaccess` rule there.

## Service angle
Owners of Bricks-based sites often don't know their add-ons are vulnerable, and update failures on commercial plugins are common. Paid, authorised work covers updating, log review, malware/backdoor cleanup and uploads hardening on sites the owner controls.

## Sources (dates in IST)
- Patchstack, *Critical Unauthenticated Arbitrary File Upload Vulnerability Exploited in Bricksforge Plugin* (exploitation first observed 8 Oct 2026, 3:17 AM IST): https://patchstack.com/articles/critical-unauthenticated-arbitrary-file-upload-vulnerability-exploited-in-bricksforge-plugin/
- Bricksforge official changelog, v4.0.1: 8 Oct 2026. https://bricksforge.io/version-changelog/
- SecurityWeek, *Bricksforge WordPress Plugin Vulnerability Exploited in the Wild*: 12 Oct 2026, 6:44 PM IST. https://www.securityweek.com/bricksforge-wordpress-plugin-vulnerability-exploited-in-the-wild/
- CISA KEV catalog (checked; not listed): https://www.cisa.gov/known-exploited-vulnerabilities-catalog
