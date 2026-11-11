---
categories: [PHP, Laravel, Security]
title: "Open Redirects in PHP and Laravel: Validating ?next= and Return URLs"
date: 2026-11-11
description: "Stop ?next=, ?return_to= and back() from sending your users to a phishing site. See why redirect($input) is an open redirect in Laravel, and add a small safe-path helper for PHP and Laravel."
summary: "Laravel's redirect()->to() returns full URLs like https://evil.example or //evil.example unchanged, so redirect($request->input('next')) is an open redirect. Accept only single-slash local paths (or an explicit host allowlist), reject backslashes and control characters, and fall back to a safe default."
tags: ["php", "laravel", "security", "redirects", "owasp"]
hero: "posts/php-laravel-open-redirect-hero.webp"
heroAlt: "Glowing emerald signpost on a dark navy background, one arrow pointing to a lit doorway and the other toward a foggy path blocked by a translucent shield"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x framework source (Redirector and UrlGenerator), the Laravel 13.x responses documentation, the PHP manual page for parse_url, and the OWASP and MITRE pages linked below.*

Quick answer: if a login, logout or "save and return" action redirects to a URL taken from the request (`?next=`, `?return_to=`, `?redirect=`), an attacker can build a link to your real domain that lands the victim on their site after login. That is an open redirect (CWE-601), and it makes phishing links look trustworthy. Only redirect to local paths you have validated, or to hosts on an explicit allowlist.

## Why `redirect($request->input('next'))` is unsafe in Laravel

In Laravel 13.x, `redirect()->to($path)` hands the path to `UrlGenerator::to()`. The first thing that method does is check `isValidUrl($path)`, and if the value already looks like a full URL it returns it unchanged:

```php
// laravel/framework 13.x, src/Illuminate/Routing/UrlGenerator.php
public function isValidUrl($path)
{
    if (! preg_match('~^(#|//|https?://|(mailto|tel|sms):)~', $path)) {
        return filter_var($path, FILTER_VALIDATE_URL) !== false;
    }

    return true;
}
```

So `https://evil.example/login` and the protocol-relative `//evil.example` both go straight into the `Location` header. A plain relative path like `/orders/42` is different: Laravel prefixes it with your app's root URL, which keeps it on your domain.

The Laravel docs are direct about `redirect()->away()`: it creates a redirect "without any additional URL encoding, validation, or verification". Treat both `away()` and `to()` with user input as unsafe.

Two more places to know about:

- **`back()`** uses `url()->previous()`, which reads the `Referer` request header first and only falls back to the session's previous URL when there is no header. The `Referer` comes from whatever page the browser was on, which can be another site. For sensitive flows, redirect to a named route instead.
- **`redirect()->intended()`** pulls `url.intended` from the session. Laravel's own `guest()` fills it with the current full URL of a GET request, which is on your domain. It becomes unsafe only if you call `redirect()->setIntendedUrl($request->input('next'))` yourself.

## A safe redirect helper for plain PHP and Laravel

The simplest rule that holds up: accept only a local path that starts with exactly one `/`, and send everything else to a default.

```php
<?php
function safe_redirect_path(?string $next, string $fallback = '/dashboard'): string
{
    if ($next === null || $next === '') {
        return $fallback;
    }
    // Reject control characters (CR/LF header tricks) and backslashes.
    if (preg_match('/[\x00-\x1F\x7F\\\\]/', $next)) {
        return $fallback;
    }
    // Only a single leading slash: a local path, not "//host".
    if (!str_starts_with($next, '/') || str_starts_with($next, '//')) {
        return $fallback;
    }
    $parts = parse_url($next);
    if ($parts === false || isset($parts['scheme']) || isset($parts['host'])) {
        return $fallback;
    }
    return $next;
}
```

Why reject backslashes? The [WHATWG URL Standard](https://url.spec.whatwg.org/) that browsers follow treats `\` like `/` in `http` and `https` URLs, so a raw `Location: /\evil.example` from plain PHP can be read as `//evil.example`. The `parse_url()` check is a final guard, not the main defence: the PHP manual says the function "is not meant to validate the given URL" and can return nonsense for malformed input, which is why the string checks come first.

In a Laravel controller it looks like this:

```php
public function store(LoginRequest $request)
{
    $request->authenticate();
    $request->session()->regenerate();

    $next = safe_redirect_path($request->query('next'), route('dashboard', absolute: false));

    return redirect($next); // a single-slash path, so Laravel prefixes your app URL
}
```

If you really need to send users to other domains (for example a docs site or a payment page), follow OWASP's advice: parse the URL, compare the scheme, host and port against an explicit allowlist, reject URLs with a username or password part, and never use "starts with" or "ends with" string matching on the host. A mapping is even safer: accept `?next=billing` and look up the real URL server-side.

## What the demo printed

We ran the helper next to a copy of Laravel's `isValidUrl()` regex on PHP 8.4.23. "Laravel passes it through" means `redirect()->to()` would send the value unchanged:

| Input | Laravel passes it through | `safe_redirect_path()` result |
| --- | --- | --- |
| `/orders/42?tab=invoices` | no | `/orders/42?tab=invoices` |
| `https://evil.example/login` | yes | `/dashboard` |
| `//evil.example` | yes | `/dashboard` |
| `/\evil.example` | no | `/dashboard` |
| `javascript:alert(1)` | no | `/dashboard` |
| `/ok` + CRLF + `Set-Cookie: x=1` | no | `/dashboard` |
| `orders/42` (no leading slash) | no | `/dashboard` |

The two "yes" rows are the ones that turn `redirect($input)` into an open redirect.

## Quick audit checklist

- Search your code for `redirect(`, `redirect()->to(`, `->away(`, `setIntendedUrl(` and `header('Location:` and check whether any argument comes from the request.
- Grep for common parameter names: `next`, `return`, `return_to`, `redirect`, `redirect_uri`, `continue`, `url`.
- Run every user-supplied redirect target through one helper like `safe_redirect_path()` or an allowlist.
- Use named routes (`redirect()->route('dashboard')`) instead of `back()` after login, logout and payment steps.
- Add tests for `https://evil.example`, `//evil.example` and `/\evil.example`, and expect your fallback.

Related lessons: [Laravel CSRF Protection: Tokens, Exceptions and SPA Pitfalls](/lessons/2026-11-05-laravel-csrf-protection-tokens-exceptions-spa/) and [Session Security in PHP and Laravel](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration/).

## Sources

- [laravel/framework 13.x: Routing/UrlGenerator.php](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Routing/UrlGenerator.php) (`to()`, `isValidUrl()`, `previous()`)
- [laravel/framework 13.x: Routing/Redirector.php](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Routing/Redirector.php) (`back()`, `guest()`, `intended()`, `away()`)
- [Laravel 13.x docs: HTTP Responses, Redirecting to External Domains](https://laravel.com/docs/13.x/responses#redirecting-external-domains)
- [PHP manual: parse_url](https://www.php.net/manual/en/function.parse-url.php)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [MITRE CWE-601: URL Redirection to Untrusted Site ('Open Redirect')](https://cwe.mitre.org/data/definitions/601.html)
