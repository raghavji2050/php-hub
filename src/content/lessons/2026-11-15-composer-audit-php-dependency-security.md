---
categories: [PHP, Laravel, Security]
title: "Auditing PHP Dependencies with composer audit"
date: 2026-11-15
description: "Use composer audit and a committed lock file to catch known vulnerabilities, abandoned packages and malware flags in PHP dependencies, including in CI."
summary: "Run composer audit (and composer audit --locked in CI) against the Packagist advisory API. The command exits 0 when it finds no issues and 1 when packages match a policy, including security advisories, abandoned packages or malware flags. composer update already runs an audit unless you pass --no-audit."
tags: ["php", "composer", "security", "dependencies", "supply-chain"]
hero: "posts/composer-audit-dependency-security-hero.webp"
heroAlt: "Wooden crate of brown paper parcels with green wax seals, a glowing emerald magnifying glass above the crate, and one parcel set aside on the workbench"
auditCta: true
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Composer 2 CLI documentation for `audit`, `install` and `update`, the Composer environment-variable list, and Packagist's description of its security advisory API. Composer 2.11.1 was present on the machine used to check the command's help text.*

Quick answer: a lock file pins versions, but it does not tell you whether those versions have a published advisory. `composer audit` asks Packagist (or another configured repository) and also reports abandoned packages and packages flagged as malware. Run it in CI against the lock file, and fail the build when the command exits `1`.

## What `composer audit` actually checks

The official CLI docs describe `composer audit` as an audit of installed packages against defined dependency policies, including security advisories. By default it uses the Packagist.org API, or other repositories you have listed in `composer.json`. Packagist aggregates advisories from the GitHub Advisory Database and from FriendsOfPHP/security-advisories, and other Composer repositories (for example Drupal's) can publish advisories for their own packages.

The same command also detects abandoned packages and packages flagged as malware. The documented exit codes are simple:

- `0` — no issues
- `1` — packages matched a policy, or required packages were missing

Those are the only audit exit codes in the current CLI docs. Do not treat the exit status as a count of advisories.

Useful flags, as documented and as shown by `composer audit --help` on Composer 2.11.1:

- `--locked` — audit the lock file, even if `vendor/` is missing or out of date. This is the flag you want in CI.
- `--no-dev` — skip `require-dev` packages.
- `--direct` / `-D` — only packages your root package requires, not transitive ones. Useful as a summary, not as a complete audit.
- `--format=table|plain|json|summary` — `json` is the format to parse in a script.
- `--abandoned=ignore|report|fail` — how abandoned packages are treated. The CLI docs also point at `config.audit.abandoned`.
- `--ignore-severity` — may be repeated.
- `--ignore-unreachable` — ignore advisory sources that are down or not returning HTTP 200.

```bash
composer audit --locked --format=json
```

## Where audit already runs

You do not have to remember a separate command after every change:

- `composer install --audit` runs an audit after the install finishes. The `--audit-format` option controls that output.
- `composer update` (and `require`) run the audit step after the lock file changes, unless you pass `--no-audit` or set `COMPOSER_NO_AUDIT=1`.

The abbreviated audit that `update` prints is a prompt to run the full `composer audit` command for details. An audit is also not a substitute for committing `composer.lock`, reviewing major upgrades, or keeping PHP itself up to date.

If you ignore a specific advisory, do it in project config with a reason you can revisit, not by piping the command to `|| true` in CI. The Composer config documentation describes ignore lists for advisory IDs; keep that list short.

## A CI sketch

A typical PHP job already runs `composer install --no-interaction`. Add an explicit audit of the lock file so the build fails when an advisory lands, even if nobody ran `update`:

```bash
composer install --no-interaction --prefer-dist
composer audit --locked --no-interaction
```

You can combine the first step as `composer install --no-interaction --prefer-dist --audit`. Using both is redundant but makes the failure reason obvious in the log.

`composer audit` will not invent a patch for you. When it reports a package, open the advisory link, confirm the affected version range, and bump the constraint only after you have checked the changelog. If a package is abandoned, the audit is telling you that security fixes may stop arriving; plan a replacement rather than silencing the finding forever.

This is the PHP counterpart of the work we described for this site's JavaScript dependencies in [How We Patched Our Own Site](/articles/2026-11-03-how-we-patched-our-own-site-astro-7/). An audit is a snapshot: run it on a schedule, not only when you remember to upgrade a package.

## Quick audit checklist

- Commit `composer.lock` and install from it in production and in CI.
- Run `composer audit --locked` in CI and fail on exit code `1`.
- Do not use `--direct` as your only CI check: transitive packages get advisories too.
- Review abandoned packages; do not set `--abandoned=ignore` without a written reason.
- Re-run the audit after `composer update`, or leave the default update audit enabled.
- Keep PHP, Composer and your platform packages on supported versions; `composer audit` does not cover the interpreter.

Related reading: [How We Patched Our Own Site: Clearing 5 npm Advisories with an Astro 7 Upgrade](/articles/2026-11-03-how-we-patched-our-own-site-astro-7/).

## Sources

- [Composer CLI: audit](https://getcomposer.org/doc/03-cli.md#audit)
- [Composer CLI: install `--audit`](https://getcomposer.org/doc/03-cli.md#install)
- [Composer CLI: update `--no-audit`](https://getcomposer.org/doc/03-cli.md#update)
- [Composer CLI: environment variables (`COMPOSER_NO_AUDIT`)](https://getcomposer.org/doc/03-cli.md#composer-no-audit)
- [Packagist blog: Discover Security Advisories with Composer's audit command](https://blog.packagist.com/discover-security-advisories-with-composers-audit-command/)
- [Packagist API: security advisories](https://packagist.org/apidoc)
