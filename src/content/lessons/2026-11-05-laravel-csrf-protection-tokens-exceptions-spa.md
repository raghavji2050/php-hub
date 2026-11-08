---
categories: [PHP, Laravel, Security]
title: "Laravel CSRF Protection: Tokens, Exceptions and SPA Pitfalls"
date: 2026-11-05
description: "How Laravel PreventRequestForgery (CSRF) works today: Sec-Fetch-Site origin checks, session tokens, @csrf, X-CSRF-TOKEN / X-XSRF-TOKEN, careful route exceptions, and Sanctum SPA setup with axios withCredentials and withXSRFToken."
summary: "Keep Laravel CSRF on for cookie-auth routes, put tokens in forms and AJAX headers, exclude only true third-party webhooks, and initialize Sanctum SPAs with /sanctum/csrf-cookie."
tags: ["php", "laravel", "security", "csrf", "middleware"]
level: intermediate
hero: "posts/laravel-csrf-protection-hero.webp"
heroAlt: "Abstract emerald shield and hexagon token filtering green request lines on a dark background; red stop marks block forged lines while safe lines pass through"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the official Laravel CSRF and Sanctum documentation and the OWASP CSRF Prevention Cheat Sheet linked below.*

Quick answer: leave Laravel's request-forgery middleware on for every cookie-authenticated, state-changing route. Put a CSRF secret in forms (`@csrf` / `_token`) or AJAX headers (`X-CSRF-TOKEN` or `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie). Exclude only endpoints that truly cannot send a token (payment webhooks). For a first-party SPA with Sanctum, call `/sanctum/csrf-cookie` first and enable `axios.defaults.withCredentials` and `withXSRFToken`.

## What CSRF is

Cross-Site Request Forgery (CSRF) is when a malicious site, email, or page tricks a victim's browser into sending an unwanted request to a site where that victim is already logged in. Browsers attach session cookies automatically, so the target app can mistake the forged request for a genuine one unless it checks something the attacker cannot read — typically a synchronizer token or modern Fetch Metadata (`Sec-Fetch-Site`). OWASP's CSRF Prevention Cheat Sheet is the reference definition and defence catalogue.

## How Laravel's forgery middleware works

Current Laravel docs protect the `web` middleware group with `Illuminate\Foundation\Http\Middleware\PreventRequestForgery` (older releases exposed the same idea as `VerifyCsrfToken` / `ValidateCsrfToken`). It uses a **two-layer** approach:

1. **Origin verification** — if the browser sends `Sec-Fetch-Site` and the request is same-origin, Laravel allows it without a token check.
2. **CSRF token fallback** — when origin verification does not pass (older browsers, missing header, non-HTTPS), Laravel requires a secret that matches the session token.

The session CSRF token is available as `$request->session()->token()` or `csrf_token()`. On protected methods (`POST`, `PUT`, `PATCH`, `DELETE`, and related), the middleware accepts the token from any of:

- the `_token` form field
- the `X-CSRF-TOKEN` request header
- the `X-XSRF-TOKEN` request header (value taken from Laravel's encrypted `XSRF-TOKEN` cookie)

A mismatch typically yields HTTP **419**. You can also opt into origin-only mode with `preventRequestForgery(originOnly: true)` in `bootstrap/app.php` (failures then return **403** instead of 419).

## Blade `@csrf`

For every HTML form that changes state, include the hidden field:

```blade
<form method="POST" action="/profile">
    @csrf

    {{-- Equivalent to: --}}
    {{-- <input type="hidden" name="_token" value="{{ csrf_token() }}" /> --}}

    <button type="submit">Save</button>
</form>
```

For AJAX from Blade pages, a common pattern is a meta tag plus the `X-CSRF-TOKEN` header:

```blade
<meta name="csrf-token" content="{{ csrf_token() }}">
```

```js
$.ajaxSetup({
    headers: {
        'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
});
```

Laravel also sets an encrypted `XSRF-TOKEN` cookie on responses so libraries such as Axios or Angular can send `X-XSRF-TOKEN` automatically on same-origin requests.

## Excluding routes carefully

Some callers (Stripe webhooks, payment callbacks) cannot know your session token. Prefer placing those routes **outside** the `web` middleware group. If you must stay on `web`, exclude specific URIs in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->preventRequestForgery(except: [
        'stripe/*',
    ]);
})
```

**Do not** blanket-exclude your entire API just because it is JSON. If those routes still use cookie/session authentication (Sanctum SPA, `web` guard, `auth` session), excluding CSRF turns them into classic CSRF targets: any malicious page can POST with the victim's cookies. Token-based Bearer APIs that never rely on browser cookies are a different model — they are not protected by this middleware in the first place, and should not share a cookie session with a first-party SPA without CSRF.

CSRF verification is automatically disabled while running tests.

## SPA / Axios and Sanctum

Laravel's CSRF docs point SPA backends at **Sanctum**. For cookie-based SPA auth:

1. SPA and API must share the same top-level domain (subdomains are fine).
2. Enable Sanctum's stateful API middleware (`statefulApi()`), configure `sanctum.stateful` domains, and allow credentials in CORS (`supports_credentials` => `true`).
3. On the client:

```js
axios.defaults.withCredentials = true;
axios.defaults.withXSRFToken = true;
```

4. Before login, initialize CSRF protection:

```js
axios.get('/sanctum/csrf-cookie').then(() => {
    // then POST /login
});
```

That route sets the `XSRF-TOKEN` cookie. Subsequent state-changing requests must send its URL-decoded value as `X-XSRF-TOKEN` (Axios does this when `withXSRFToken` is on). Session expiry often surfaces as **401** or **419** — send the user back to login.

## Minimal PHP demo (no Laravel)

This CLI script shows why a state-changing POST needs a secret the attacker cannot forge. It is conceptual — not a web server:

```php
<?php
declare(strict_types=1);

// Victim's session (server-side only)
$sessionToken = bin2hex(random_bytes(16));

function acceptPost(array $post, string $sessionToken): string
{
    $incoming = $post['_token'] ?? '';
    if (! is_string($incoming) || $incoming === '' || ! hash_equals($sessionToken, $incoming)) {
        return "REJECTED (419-style): missing or mismatched CSRF token\n";
    }
    $email = $post['email'] ?? '';
    return "ACCEPTED: would change email to {$email}\n";
}

// Attacker site can auto-submit email=… but cannot read the session token
$forged = ['email' => 'attacker@evil.example'];
echo acceptPost($forged, $sessionToken);

// Same-origin form includes the hidden token
$legit = ['email' => 'me@example.com', '_token' => $sessionToken];
echo acceptPost($legit, $sessionToken);
```

Run it with `php demo.php`. The forged body is rejected; the matching token is accepted. `hash_equals()` avoids timing leaks when comparing secrets ([php.net hash_equals](https://www.php.net/manual/en/function.hash-equals.php)).

## Practical checklist

- Keep forgery middleware on every cookie-auth, state-changing route.
- Always use `@csrf` (or an equivalent header) on mutating forms and AJAX.
- Exclude only third-party webhooks you cannot tokenise; never "turn off CSRF for `/api/*`" if those routes still use cookies.
- For Sanctum SPAs: `/sanctum/csrf-cookie` → credentials + XSRF header → then login.
- Prefer HTTPS so `Sec-Fetch-Site` origin checks can apply; treat tokens as the fallback for older clients.
- Remember OWASP's warning: XSS can defeat CSRF defences — fix XSS too.

Want a second pair of eyes on Laravel auth, Sanctum, or session cookie settings? See [PHP Hub services](/services) (contact for quote) or run a quick pass with the [PHP Security Checker](https://php-security-checker.vercel.app).

## Sources

- [Laravel CSRF Protection](https://laravel.com/docs/csrf) — `PreventRequestForgery`, `@csrf`, exclusions, `X-CSRF-TOKEN`, `X-XSRF-TOKEN`
- [Laravel Sanctum — SPA Authentication](https://laravel.com/docs/sanctum) — `/sanctum/csrf-cookie`, `withCredentials`, `withXSRFToken`
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PHP hash_equals](https://www.php.net/manual/en/function.hash-equals.php)
