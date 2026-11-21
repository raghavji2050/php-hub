---
categories: [PHP, Laravel, Security]
title: "Keeping Secrets Out of Git: .env, APP_KEY and APP_DEBUG"
date: 2026-11-21
description: "Keep Laravel secrets out of source control. Do not commit .env, generate APP_KEY locally, and leave APP_DEBUG off in production. Use env:encrypt if you must store an environment file in git."
summary: "Laravel's documentation says the .env file should not be committed to source control. Keep APP_KEY and database credentials in the environment, set APP_DEBUG to false in production, and after config:cache only call env() from config files. If you need a file in git, use php artisan env:encrypt and store the decryption key in a password manager."
tags: ["php", "laravel", "security", "secrets", "environment"]
hero: "posts/laravel-secrets-env-debug-hero.webp"
heroAlt: "Open blank leather notebook beside a riveted iron strongbox with a glowing emerald key resting on the lid"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x configuration documentation (environment files, configuration caching, debug mode, and environment encryption).*

Quick answer: credentials belong in the environment, not in the repository. Laravel's configuration docs say your `.env` file should not be committed to source control, both because each machine may need different values and because a leaked repository would expose those secrets. Turn `APP_DEBUG` off in production. After you cache config, stop calling `env()` from application code.

## What belongs in `.env`, and what belongs in git

A fresh Laravel app ships `.env.example` and copies it to `.env` during install. The example file is meant to be committed, with placeholders, so teammates can see which variables are required. The real `.env` file is not.

Typical values that must stay out of git include `APP_KEY`, database passwords, mail credentials, API tokens and any webhook secret. External system environment variables override `.env`, which is the usual pattern on a host or in a container platform.

`APP_KEY` is also your encryption key. The [encryption lesson](/lessons/2026-11-16-encryption-laravel-crypt-app-key-sodium/) covers `Crypt` and `APP_PREVIOUS_KEYS`. If this value is in a public repo, an attacker can decrypt cookies and other `Crypt` payloads, and can mint new ones. Generate it with `php artisan key:generate` and rotate it if it has ever been committed. Check history, not just the latest tree: `git log -p -- .env` and `git rev-list --all -- .env` are the first places to look, then rotate every secret that file ever held.

Laravel also lets you encrypt an environment file and commit the ciphertext. `php artisan env:encrypt` writes `.env.encrypted`. The decryption key is printed once and, the docs say, should be stored in a secure password manager. Decrypt on the server with `php artisan env:decrypt`. The default cipher is AES-256-CBC and needs a 32-character key; you may pass `--cipher` and `--key`, or `--env=staging` to encrypt `.env.staging`. The `--readable` option keeps variable names visible and encrypts only the values. Unencrypted environment files, the docs repeat, should never be stored in source control.

## `APP_DEBUG` and configuration caching

The `debug` option in `config/app.php` follows `APP_DEBUG` in `.env`. For local development you may set it to `true`. In production, the docs say, this value should **always** be `false`. If it is `true` in production, you risk exposing sensitive configuration values to end users.

Treat a production debug page as a secret leak: paths, framework versions, environment values and query details can all appear in a stack trace. Keep `APP_ENV=production` and `APP_DEBUG=false` on live hosts, and do not override them from a leftover `.env` on the server.

Laravel's default layout already helps: the document root is the `public/` directory, so `.env` in the project root is not a public URL. Do not point the web server at the project root, and do not copy `.env` into `public/`. The same applies to `storage/` and `vendor/`. If you deploy with a build pack or a container, prefer real environment variables over baking a `.env` into an image that might be shipped or cached.


On deploy, Laravel recommends `php artisan config:cache`. That command collapses your config files into one cached file. The important restriction: **once configuration is cached, the `.env` file is not loaded**. `env()` will only return external, system-level environment variables. If you call `env('APP_KEY')` from a controller or a service class after `config:cache`, you can get `null` in production and a real value on your laptop. Call `env()` only from files in `config/`, and in the rest of the app use `config('app.key')`.

## Quick audit checklist

- `.env` is in `.gitignore`. `.env.example` contains placeholders only, not live credentials.
- `git ls-files .env` is empty, and history does not contain an old `.env`. If it does, rotate every secret and consider `git filter-repo` or a fresh repo after rotation.
- Production has `APP_DEBUG=false` and a unique `APP_KEY` that was not copied from `.env.example`.
- Application code uses `config()`, not `env()`, outside config files.
- CI logs, Docker build contexts and error trackers are not printing the environment.
- If you commit `.env.encrypted`, the decryption key lives in a password manager, not in the same repository.
- `phpunit.xml` and CI variable files should use empty placeholders or references to a secret store, not production credentials.


Related lesson: [Encryption in Laravel and PHP](/lessons/2026-11-16-encryption-laravel-crypt-app-key-sodium/). The same secrets should also stay out of application logs.

## Sources

- [Laravel 13.x docs: Configuration](https://laravel.com/docs/13.x/configuration)
- [Laravel 13.x docs: Environment File Security](https://laravel.com/docs/13.x/configuration#environment-file-security)
- [Laravel 13.x docs: Encrypting Environment Files](https://laravel.com/docs/13.x/configuration#encrypting-environment-files)
- [Laravel 13.x docs: Configuration Caching](https://laravel.com/docs/13.x/configuration#configuration-caching)
- [Laravel 13.x docs: Debug Mode](https://laravel.com/docs/13.x/configuration#debug-mode)
- [MITRE CWE-215: Insertion of Sensitive Information Into Debugging Code](https://cwe.mitre.org/data/definitions/215.html)
- [MITRE CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html)
