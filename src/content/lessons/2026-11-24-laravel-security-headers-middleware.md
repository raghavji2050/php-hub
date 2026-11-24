---
categories: [PHP, Laravel, Security]
title: "Security Headers in Laravel with One Middleware"
date: 2026-11-24
description: "Add X-Content-Type-Options, Referrer-Policy, frame protection, Permissions-Policy and HSTS to every Laravel response with one small middleware, using OWASP's recommended values."
summary: "Laravel does not add browser security headers for you. Write one middleware that sets nosniff, a Referrer-Policy, frame-ancestors / X-Frame-Options, a Permissions-Policy, and HSTS on HTTPS only, register it globally in bootstrap/app.php, hide X-Powered-By with expose_php = Off, and set each header in one layer only."
tags: ["php", "laravel", "security", "http-headers", "hsts"]
hero: "posts/laravel-security-headers-hero.webp"
heroAlt: "Old iron gate at dusk with a chain of brass padlocks and a glowing lantern hanging beside it"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the OWASP HTTP Security Response Headers Cheat Sheet, the Laravel 13.x middleware documentation, MDN and the PHP manual.*

Quick answer: a handful of response headers tell the browser to stop guessing file types, refuse to frame your pages, trim the `Referer` it sends, switch off features you never use, and stick to HTTPS. They take a few lines of code and they protect every page at once. Laravel lets you add them in one global middleware.

## The headers worth setting

These are the values the OWASP HTTP Headers Cheat Sheet recommends:

| Header | Value | What it stops |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing, where a browser treats an uploaded "image" as script or HTML |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaking full URLs (paths, query strings, tokens) to other sites |
| `Content-Security-Policy` | `frame-ancestors 'none'` | Clickjacking, because other sites can't frame your pages |
| `X-Frame-Options` | `DENY` | The same thing, for older browsers |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` | An injected script turning on features your site never uses |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Downgrades to plain HTTP |

OWASP also says not to rely on `X-XSS-Protection`. Either leave it out or send `X-XSS-Protection: 0`, because the old browser filter could itself create XSS bugs. Use a Content Security Policy instead.

## One middleware for all of them

Create it with `php artisan make:middleware SecurityHeaders`, then set the headers on the way *out* (after `$next($request)`):

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

        // Don't overwrite a fuller CSP that a route has already set.
        if (! $headers->has('Content-Security-Policy')) {
            $headers->set('Content-Security-Policy', "frame-ancestors 'none'");
        }

        // HSTS only means something over HTTPS.
        if ($request->secure() && app()->isProduction()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
```

Register it globally in `bootstrap/app.php`, the way the Laravel 13.x docs show for global middleware:

```php
use App\Http\Middleware\SecurityHeaders;

->withMiddleware(function (Middleware $middleware): void {
    $middleware->append(SecurityHeaders::class);
})
```

If your app sits behind a load balancer or a proxy that terminates TLS, `$request->secure()` only returns `true` once Laravel trusts that proxy. Configure trusted proxies first, or HSTS will never be sent.

## Roll out HSTS carefully

HSTS is the one header that can lock users out. OWASP warns that if you send a long `max-age` and your certificate later expires or breaks, browsers will refuse to connect until that time runs out. The safe order:

1. Make sure the whole site, including every subdomain, works on HTTPS.
2. Start with a short `max-age` (for example `300`), then raise it to a year or two once nothing breaks.
3. Add `includeSubDomains` only when every subdomain is on HTTPS.
4. Add `preload` only after you have read the HSTS preload requirements. Removing a site from the preload list is slow.

That's why the middleware above uses one year without `preload`. Move to OWASP's full value once you're ready.

## Hide `X-Powered-By`

By default PHP can send `X-Powered-By: PHP/<version>`. OWASP recommends removing it. Turn it off at the source in `php.ini`:

```ini
expose_php = Off
```

This won't stop a determined attacker from fingerprinting your stack, but there's no reason to hand out your exact PHP version.

## Set each header in one layer only

If Nginx also adds security headers with `add_header` while Laravel sets them too, the response can carry both copies, sometimes with conflicting values (`DENY` from one, `SAMEORIGIN` from the other). Pick one layer. OWASP notes another Nginx catch: an `add_header` inside a `location` block quietly drops every `add_header` inherited from the `server` block.

## Check it

```bash
curl -sI https://your-app.example | grep -iE 'x-content-type|referrer|x-frame|permissions|content-security|strict-transport|x-powered'
```

Run it against a normal page, a redirect, an error page and a file download. A middleware won't cover files that the web server serves directly from `public/`, so set the headers there too, or check them separately. OWASP also points to the Mozilla Observatory for a quick online scan.

## Quick checklist

- `nosniff`, `Referrer-Policy`, frame protection and `Permissions-Policy` on every response.
- HSTS on HTTPS only. Start short, and add `preload` last.
- Trusted proxies configured so `$request->secure()` is correct.
- `expose_php = Off`.
- Each header set in one place: app *or* web server.
- A full Content Security Policy is the next step. It needs nonces or hashes for inline scripts, so plan it separately.

Related lessons: [XSS Prevention in Laravel Blade](/lessons/2026-11-06-xss-prevention-laravel-blade-echo-js-from/) and [Session Security in PHP and Laravel](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration/).

## Sources

- [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP HTTP Strict Transport Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [Laravel 13.x docs: Middleware](https://laravel.com/docs/13.x/middleware)
- [Laravel 13.x docs: Configuring Trusted Proxies](https://laravel.com/docs/13.x/requests#configuring-trusted-proxies)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)
- [PHP manual: expose_php](https://www.php.net/manual/en/ini.core.php#ini.expose-php)
