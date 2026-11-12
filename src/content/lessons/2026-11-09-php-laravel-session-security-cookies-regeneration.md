---
categories: [PHP, Laravel, Security]
title: "Session Security in PHP and Laravel: Cookie Flags, Strict Mode and ID Regeneration"
date: 2026-11-09
description: "Stop session fixation and cookie theft: set HttpOnly, Secure and SameSite on the session cookie, turn on PHP's strict mode, and regenerate the session ID at login and logout in PHP and Laravel."
summary: "Plain PHP ships with session.use_strict_mode, cookie_httponly and cookie_secure all off. Turn them on, regenerate the ID after login, and in Laravel set SESSION_SECURE_COOKIE and keep the regenerate/invalidate calls in your auth flow."
tags: ["php", "laravel", "security", "sessions", "cookies"]
hero: "posts/php-laravel-session-security-hero.webp"
heroAlt: "Abstract emerald cookie sealed with a padlock inside a glass capsule, circled by a refresh arrow, while a broken red key fades away on a dark navy background"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual's session configuration and session security pages, the Laravel 13.x session and authentication documentation, the default Laravel 13.x `config/session.php`, and the OWASP Session Management Cheat Sheet linked below.*

Quick answer: the session ID *is* the login. Protect the cookie that carries it (`HttpOnly`, `Secure`, `SameSite`), refuse session IDs your server never issued (`session.use_strict_mode`), and give the user a fresh ID whenever their privilege level changes, most importantly right after login. Laravel handles most of this for you, but only if you keep its defaults and its auth calls in place.

## Two attacks to keep in mind

- **Session fixation.** An attacker gets a victim to use a session ID the attacker already knows, then waits for the victim to log in. If the app keeps the same ID after login, the attacker now shares an authenticated session. The PHP manual describes exactly this: links or emails carrying a known session ID.
- **Session hijacking.** The attacker steals a valid ID after login, for example by reading `document.cookie` through an XSS bug or sniffing a cookie sent over plain HTTP.

OWASP's rule for the first one is direct: the session ID must be renewed or regenerated after any privilege level change, and authentication is the most common case. The cookie flags below make the second one much harder.

## Plain PHP: the defaults are not secure

According to the PHP manual's session configuration table, these settings all default to off or empty:

| Setting | Default | What to use |
| --- | --- | --- |
| `session.use_strict_mode` | `0` | `1` |
| `session.cookie_httponly` | `0` | `1` |
| `session.cookie_secure` | `0` | `1` (HTTPS sites) |
| `session.cookie_samesite` | `""` (no attribute) | `Lax` or `Strict` |

`session.use_only_cookies` already defaults to `1`, and disabling it is deprecated as of PHP 8.4.0. Keep it on so session IDs never travel in URLs.

Set them in `php.ini` or before `session_start()`:

```php
<?php
ini_set('session.use_strict_mode', '1');

session_set_cookie_params([
    'lifetime' => 0,          // until the browser closes
    'path'     => '/',
    'secure'   => true,       // only over HTTPS
    'httponly' => true,       // not readable from JavaScript
    'samesite' => 'Lax',
]);

session_start();
```

With strict mode on, the manual explains, an uninitialized session ID is rejected and a new one is created (when the save handler supports it), which blocks the "use this known ID" trick.

## Plain PHP: regenerate after login, destroy on logout

`session_regenerate_id()` replaces the current ID with a new one and keeps the session data. Pass `true` to delete the old session so the old ID stops working:

```php
<?php
// After the password has been verified with password_verify()
session_regenerate_id(true);
$_SESSION['user_id'] = $user->id;
```

On logout, clear the data and end the session rather than just unsetting one key:

```php
<?php
$_SESSION = [];
session_destroy();
```

## Laravel: what the defaults already do

The default Laravel 13.x `config/session.php` sets `http_only` to `true` (via `SESSION_HTTP_ONLY`) and `same_site` to `'lax'` (via `SESSION_SAME_SITE`). The comments in that file say you are unlikely to want to disable `http_only`, and that `same_site` can help mitigate CSRF. Laravel manages its own session IDs, so PHP's `session.use_strict_mode` setting is not what protects a Laravel app; regeneration does.

One setting is **not** on by default: `secure` reads `env('SESSION_SECURE_COOKIE')` with no fallback. On a production HTTPS site, set it explicitly:

```dotenv
SESSION_SECURE_COOKIE=true
```

Other defaults worth knowing: `SESSION_LIFETIME=120` (minutes), `SESSION_EXPIRE_ON_CLOSE=false`, and the `database` driver.

## Laravel: regenerate at login, invalidate at logout

The Laravel docs say the session ID is regenerated automatically during authentication if you use one of the starter kits or Laravel Fortify. If you wrote your own login controller, you must do it yourself, as the authentication docs show:

```php
if (Auth::attempt($credentials)) {
    $request->session()->regenerate();

    return redirect()->intended('dashboard');
}
```

And the documented logout pattern invalidates the session and issues a fresh CSRF token:

```php
public function logout(Request $request): RedirectResponse
{
    Auth::logout();

    $request->session()->invalidate();

    $request->session()->regenerateToken();

    return redirect('/');
}
```

`invalidate()` regenerates the ID **and** removes all session data in one call. Apply the same `regenerate()` idea when a user steps up privileges, for example after a 2FA check or switching into an admin role.

## A runnable plain-PHP demo

This CLI script shows strict mode and regeneration in action. It buffers output and disables cookies so the session functions work outside a web server:

```php
<?php
// CLI demo: no cookies are sent, so we pass session IDs by hand.
ob_start(); // CLI: buffer output so session functions can still run
ini_set('session.cache_limiter', '');
ini_set('session.use_cookies', '0');
ini_set('session.save_path', __DIR__);

echo "use_strict_mode default: ", var_export(ini_get('session.use_strict_mode'), true), PHP_EOL;

// 1) Without strict mode, an attacker-chosen ID is accepted as-is.
session_id('attackerchosenid123');
session_start();
echo "non-strict id: ", session_id(), PHP_EOL;
session_write_close();

// 2) With strict mode, an uninitialized ID is rejected and a new one is created.
ini_set('session.use_strict_mode', '1');
session_id('anotherunknownid456');
session_start();
echo "strict id replaced: ", session_id() !== 'anotherunknownid456' ? 'yes' : 'no', PHP_EOL;

// 3) After "login", regenerate the ID and delete the old session file.
$_SESSION['user_id'] = 42;
$before = session_id();
session_regenerate_id(true);
$after = session_id();
echo "regenerated: ", $before !== $after ? 'yes' : 'no', ", data kept: ", $_SESSION['user_id'], PHP_EOL;
echo "old file exists: ", file_exists(__DIR__ . "/sess_$before") ? 'yes' : 'no', PHP_EOL;
session_write_close();
```

Output on PHP 8.4:

```text
use_strict_mode default: '0'
non-strict id: attackerchosenid123
strict id replaced: yes
regenerated: yes, data kept: 42
old file exists: no
```

Without strict mode, PHP happily created a session under the attacker's chosen ID. With strict mode, the unknown ID was replaced. After `session_regenerate_id(true)`, the user kept their data under a new ID and the old session file was gone.

## Quick audit checklist

- Plain PHP: confirm `session.use_strict_mode=1`, `session.cookie_httponly=1`, `session.cookie_secure=1` and a `session.cookie_samesite` value in production (`php -i | grep session` or `phpinfo()`).
- Check the flags your server actually sends: paste `curl -I https://your-site.example` output into the free [Session Cookie Flag Checker](/tools/session-cookie-checker) (runs in your browser).
- Search for login code that sets `$_SESSION['user_id']` without a `session_regenerate_id(true)` call first.
- Laravel: set `SESSION_SECURE_COOKIE=true` on HTTPS, and don't set `SESSION_HTTP_ONLY=false` or `SESSION_SAME_SITE=none` without a clear reason.
- Custom Laravel login controllers: look for `$request->session()->regenerate()` after `Auth::attempt()`, and `invalidate()` plus `regenerateToken()` on logout.
- Fix XSS first: `HttpOnly` stops scripts reading the cookie, but an XSS bug can still act as the user inside the page. See [XSS Prevention in Laravel Blade](/lessons/2026-11-06-xss-prevention-laravel-blade-echo-js-from) and [Laravel CSRF Protection](/lessons/2026-11-05-laravel-csrf-protection-tokens-exceptions-spa).

Want a review of session, cookie and login handling across a Laravel or PHP app? See [PHP Hub services](/services) (contact for quote) or run a quick pass with the [PHP Security Checker](https://php-security-checker.vercel.app).

## Sources

- [PHP manual: Session runtime configuration](https://www.php.net/manual/en/session.configuration.php) — defaults for `session.use_strict_mode`, `session.cookie_httponly`, `session.cookie_secure`, `session.cookie_samesite`, `session.use_only_cookies` (PHP 8.4 deprecation note)
- [PHP manual: Session management basics](https://www.php.net/manual/en/features.session.security.management.php) — strict mode rejects uninitialized IDs; session fixation via known IDs
- [PHP manual: session_regenerate_id](https://www.php.net/manual/en/function.session-regenerate-id.php)
- [PHP manual: session_set_cookie_params](https://www.php.net/manual/en/function.session-set-cookie-params.php)
- [Laravel 13.x docs: HTTP Session](https://laravel.com/docs/13.x/session) — Regenerating the Session ID, `regenerate()`, `invalidate()`, starter kits / Fortify
- [Laravel 13.x docs: Authentication](https://laravel.com/docs/13.x/authentication) — manual `Auth::attempt` + `regenerate()`, logout with `invalidate()` and `regenerateToken()`
- [Laravel 13.x skeleton: config/session.php](https://github.com/laravel/laravel/blob/13.x/config/session.php) — `secure`, `http_only`, `same_site`, `lifetime` defaults
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
