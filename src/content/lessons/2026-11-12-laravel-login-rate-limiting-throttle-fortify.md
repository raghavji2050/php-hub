---
categories: [PHP, Laravel, Security]
title: "Rate Limiting Login in Laravel: throttle, RateLimiter and Fortify"
date: 2026-11-12
description: "Slow brute-force and credential-stuffing attempts on Laravel login and other sensitive routes. Define named limiters, attach throttle middleware, and know what Fortify already does for starter kits."
summary: "Define named Laravel rate limiters with RateLimiter::for() and Limit::perMinute()->by(), attach them with the throttle middleware (HTTP 429 when exceeded), and keep Fortify's default login throttle: 5 attempts per 60 seconds, keyed by username and IP."
tags: ["php", "laravel", "security", "rate-limiting", "authentication"]
hero: "posts/laravel-login-rate-limiting-hero.webp"
heroAlt: "Bronze hourglass on cobblestones beside a vine-covered iron gate with a glowing emerald keyhole, faint footprints approaching the gate"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x routing and rate limiting documentation, the Laravel 13.x authentication and Fortify documentation, and Fortify 1.x `LoginRateLimiter` source, all linked below.*

Quick answer: put a named rate limiter on login, password reset and other sensitive routes, and key it by more than just an IP address. Laravel returns HTTP 429 when a limiter is exceeded. If you use an official starter kit, Fortify already throttles login attempts.

## Named limiters and the `throttle` middleware

In Laravel 13.x, you define named limiters in the `boot` method of `App\Providers\AppServiceProvider` with `RateLimiter::for()`. Each limiter returns one or more `Illuminate\Cache\RateLimiting\Limit` objects. The official docs use `Limit::perMinute()` and `Limit::perHour()`, and they key a limiter with `by()` so that one client cannot share another client's budget:

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    RateLimiter::for('login', function (Request $request) {
        return [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perMinute(5)->by($request->input('email')),
        ];
    });
}
```

Attach that limiter with the `throttle` middleware and the limiter name:

```php
Route::post('/login', [LoginController::class, 'store'])
    ->middleware('throttle:login');
```

If the client goes over the limit, Laravel returns **HTTP 429** automatically. You can replace that response with `Limit::response()`. You can also attach several limits at once, which is how the Laravel 13.x docs show a login limiter: a higher global cap plus a tighter per-email cap.

A useful option is response-based limiting with `after()`. The closure receives the HTTP response and should return `true` when that response should count toward the limit. The docs describe this as a way to count only certain outcomes (they use 404 enumeration as the example) so harmless validation errors need not burn a retry.

The rate limiter uses your default cache store, unless you set a `limiter` store in `config/cache.php`. If that store is Redis, you can map `throttle` to `ThrottleRequestsWithRedis` by calling `throttleWithRedis()` in `bootstrap/app.php`.

## Rate-limiting an action, not only a route

HTTP middleware is not the only API. The separate [rate limiting](https://laravel.com/docs/13.x/rate-limiting) document covers `RateLimiter::attempt()`, `tooManyAttempts()`, `increment()`, `remaining()`, `availableIn()` and `clear()`. `attempt()` runs a callback if the key still has tries left and returns `false` when it does not. The fourth argument is the decay time in seconds (60 by default), so five attempts every two minutes looks like this:

```php
use Illuminate\Support\Facades\RateLimiter;

$executed = RateLimiter::attempt(
    'send-message:'.$user->id,
    5,
    function () {
        // Send the message...
    },
    120,
);

if (! $executed) {
    $seconds = RateLimiter::availableIn('send-message:'.$user->id);

    return back()->withErrors([
        'email' => "Too many attempts. Try again in {$seconds} seconds.",
    ]);
}
```

Clear the key after a successful login so a legitimate user is not left in a lockout from their own typos. Under concurrent load, the docs recommend checking the integer returned by `increment()` on Redis, Memcached or the database cache, because those stores increment atomically.

## What Fortify already does

Laravel 13 starter kits use Fortify for authentication. The authentication docs say that starter kits automatically rate-limit login attempts, that the throttle is unique to the username or email address plus IP address, and that the user cannot log in for one minute after too many failures.

The default path is Fortify's `EnsureLoginIsNotThrottled` action, used when `config('fortify.limiters.login')` is not set. In Fortify 1.x, `LoginRateLimiter` hard-codes that policy:

- `tooManyAttempts()` allows **5** attempts
- `increment()` decays after **60** seconds
- the key is `Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip())`

If you set `fortify.limiters.login` to a named limiter, Fortify applies the `throttle` middleware to the login route instead, and you control the budget yourself. The official starter-kit docs show a custom limiter like `Limit::perMinute(5)->by($request->email.$request->ip())`.

Rate limiting is not a complete defence. It slows password guessing from one address, but it does not replace a strong password hash, [session regeneration after login](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration/), or two-factor authentication. Fortify's own documentation puts it plainly: a mix of throttling, two-factor authentication and an external WAF is stronger than throttling alone.

## Quick audit checklist

- Confirm `/login`, `/forgot-password` and `/reset-password` are behind a limiter, including any JSON login route you added yourself.
- Key the limiter by username or email as well as IP, so a shared NAT cannot lock out every customer, and so one IP cannot try every account unthrottled.
- Use a cache store that increments atomically under load (the docs call out Redis, Memcached and the database store).
- Clear the limiter after a successful login.
- Return a generic error on failure. Do not reveal whether the email exists.
- Add tests that the sixth attempt within a minute is rejected, and that a successful login resets the counter.

Related lessons: [Session Security in PHP and Laravel](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration/) and [Password Hashing in PHP](/lessons/2026-11-03-password-hashing-in-php-password-hash-verify-rehash/).

## Sources

- [Laravel 13.x docs: Routing, Rate Limiting](https://laravel.com/docs/13.x/routing#rate-limiting)
- [Laravel 13.x docs: Rate Limiting (attempt, availableIn, clear)](https://laravel.com/docs/13.x/rate-limiting)
- [Laravel 13.x docs: Authentication, Login Throttling](https://laravel.com/docs/13.x/authentication#login-throttling)
- [Laravel 13.x docs: Fortify, Authentication Throttling](https://laravel.com/docs/13.x/fortify#authentication-throttling)
- [Laravel 13.x docs: Starter Kits, Rate Limiting](https://laravel.com/docs/13.x/starter-kits#rate-limiting)
- [laravel/fortify 1.x: LoginRateLimiter.php](https://github.com/laravel/fortify/blob/1.x/src/LoginRateLimiter.php)
- [MITRE CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
