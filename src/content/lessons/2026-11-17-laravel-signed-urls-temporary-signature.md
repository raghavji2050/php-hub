---
categories: [PHP, Laravel, Security]
title: "Signed URLs in Laravel: signedRoute, Expiry and the signed Middleware"
date: 2026-11-17
description: "Create and validate Laravel signed URLs for unsubscribe links and other public actions. Use temporarySignedRoute, the signed middleware, and always read signed values with query()."
summary: "Laravel signed URLs append an HMAC to the query string so the path and query cannot be altered unnoticed. Prefer URL::temporarySignedRoute() with an expiry, protect the route with the signed middleware, and read parameters with $request->query() because the request body is not signed."
tags: ["php", "laravel", "security", "signed-urls", "urls"]
hero: "posts/laravel-signed-urls-hero.webp"
heroAlt: "Cream envelope with a green ribbon and glowing emerald wax seal standing beside a brass hourglass on a dark wooden desk"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x URL generation documentation (signed URLs, validation, the `signed` middleware, and invalid-signature responses).*

Quick answer: a signed URL lets you email a public link — unsubscribe, download, verify — and later reject any change to the path or query string. It is not a login, and it is not an authorization check. Generate the link with `URL::signedRoute()` or `URL::temporarySignedRoute()`, validate it with the `signed` middleware, and read the signed values with `$request->query()`.

## Creating a signed URL

Laravel appends a `signature` hash to the query string of a named route. The docs describe this as a way to confirm that the URL has not been modified since you created it. The usual example is a public unsubscribe link:

```php
use Illuminate\Support\Facades\URL;

return URL::signedRoute('unsubscribe', ['user' => 1]);

return URL::temporarySignedRoute(
    'unsubscribe',
    now()->plus(minutes: 30),
    ['user' => 1]
);
```

`temporarySignedRoute()` embeds an expiry. When Laravel later validates the URL, it checks that this timestamp has not passed. The Laravel 13.x docs use `now()->plus(minutes: 30)` for a 30-minute link (and `now()->plus(minutes: 5)` on the fluent `Uri` helper). Prefer a temporary link for anything sent by email.

If you generate a relative signed URL with `absolute: false`, the hash does not include the domain:

```php
URL::signedRoute('unsubscribe', ['user' => 1], absolute: false);
```

You must then validate it as a relative signature, or the check will fail.

## Validating the request

There are two documented ways to check the signature.

`hasValidSignature()` on the request returns a boolean. The docs' example calls `abort(401)` when it is missing:

```php
Route::get('/unsubscribe/{user}', function (Request $request) {
    if (! $request->hasValidSignature()) {
        abort(401);
    }
    // ...
})->name('unsubscribe');
```

The `signed` middleware (`Illuminate\Routing\Middleware\ValidateSignature`) is usually clearer. If the signature is missing or wrong, the middleware returns **HTTP 403**:

```php
Route::post('/unsubscribe/{user}', function (Request $request) {
    // ...
})->name('unsubscribe')->middleware('signed');
```

For links created with `absolute: false`, use `middleware('signed:relative')`.

`hasValidSignatureWhileIgnoring(['page', 'order'])` exists for the case where the frontend must append pagination or sort parameters. The docs warn that ignored parameters can be changed by anyone. Only ignore names you can afford to treat as unsigned.

When a temporary link has expired, Laravel shows the generic 403 error page. You can render a friendlier view by handling `Illuminate\Routing\Exceptions\InvalidSignatureException` in `bootstrap/app.php`:

```php
use Illuminate\Routing\Exceptions\InvalidSignatureException;

->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (InvalidSignatureException $e) {
        return response()->view('errors.link-expired', status: 403);
    });
})
```

## Read signed values from the query string

This is the easy bug. The Laravel 13.x docs are explicit: **a signature only covers the URL path and query string**. A form body or a JSON body is not signed and can be changed. Laravel merges input sources and gives the request body precedence over the query string, so `$request->input('email')`, `$request->all()`, or `$request->email` can return an unsigned value that overrides the signed query parameter. That is also true of GET requests, because a GET request can still carry a JSON body.

Always read signed parameters with `$request->query('email')` (or the route parameter for values that are part of the path).

A valid signature also does not mean "this user may do this". It only means the link was not altered and, for a temporary link, has not expired. If the action is sensitive, still authenticate the user or check a capability, and keep the expiry short. Treat a signed URL the way you treat a [secret token](/lessons/2026-11-10-secure-random-tokens-php-laravel-random-bytes/): if the email leaks, anyone who has the link can open it until it expires.

Do not send signed links through an [open redirect](/lessons/2026-11-11-open-redirects-php-laravel-safe-next-url/). And do not use a signed URL as a place to hide a secret you would not want in a log file; the whole URL often ends up in browser history, referrers and access logs.

Laravel 13.x also has fluent URI helpers, `Uri::signedRoute()` and `Uri::temporarySignedRoute()`, that follow the same rules — including `now()->plus(minutes: 5)` in the docs' own example. Whichever helper you use, the validation side stays the same: `signed` or `signed:relative`, and `query()` for the values.


## Quick audit checklist

- Use `temporarySignedRoute()` for email and other outbound links, with a short expiry.
- Put `middleware('signed')` (or `signed:relative`) on the target route.
- Read signed parameters with `$request->query()` or the route parameter, never `input()` or `$request->email`.
- Only use `hasValidSignatureWhileIgnoring()` for parameters that are safe to leave unsigned.
- Customise `InvalidSignatureException` so an expired unsubscribe link does not look like a generic 403.
- Remember that a signed URL is not authentication and not authorization.

Related lessons: [Secure Random Tokens in PHP and Laravel](/lessons/2026-11-10-secure-random-tokens-php-laravel-random-bytes/) and [Open Redirects in PHP and Laravel](/lessons/2026-11-11-open-redirects-php-laravel-safe-next-url/).

## Sources

- [Laravel 13.x docs: URL Generation, Signed URLs](https://laravel.com/docs/13.x/urls#signed-urls)
- [Laravel 13.x docs: Validating Signed Route Requests](https://laravel.com/docs/13.x/urls#validating-signed-route-requests)
- [Laravel 13.x docs: Responding to Invalid Signed Routes](https://laravel.com/docs/13.x/urls#responding-to-invalid-signed-routes)
