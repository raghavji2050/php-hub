---
categories: [PHP, Laravel, Security]
title: "Secure Random Tokens in PHP and Laravel: random_bytes, random_int and Str::random"
date: 2026-11-10
description: "Generate unguessable reset links, API keys and OTP codes in PHP and Laravel with random_bytes, random_int, Random\\Randomizer and Str::random, store only a hash, and compare with hash_equals."
summary: "uniqid(), mt_rand() and rand() are not for secrets. Use random_bytes() or random_int() (or Laravel's Str::random, which uses random_bytes), store a hash of the token instead of the token, and compare with hash_equals()."
tags: ["php", "laravel", "security", "tokens", "randomness"]
hero: "posts/php-laravel-secure-random-tokens-hero.webp"
heroAlt: "Glowing emerald key made of scattered particles rising from a swirl of noise, next to a cracked grey dice on a dark navy background"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual pages for random_bytes, random_int, uniqid, mt_rand, Random\Randomizer and hash_equals, and the Laravel framework and Sanctum source files linked below.*

Quick answer: a password reset link, an email verification code, an API key or an invite token is only as safe as it is hard to guess. Build them from PHP's cryptographically secure generator (`random_bytes()` or `random_int()`), save only a hash of the token in your database, and check incoming tokens with `hash_equals()`.

## The functions you should not use for secrets

The PHP manual carries the same caution on both `uniqid()` and `mt_rand()`: they do not generate cryptographically secure values and must not be used for anything that needs to be unguessable.

- **`uniqid()`** is based on the current time in microseconds. With an empty prefix it returns 13 characters, and the manual also warns it doesn't even guarantee uniqueness.
- **`mt_rand()` and `rand()`** use the Mersenne Twister. Seed it with a known value and you get the same sequence again, which is exactly what an attacker wants.
- **`md5(time())`, `sha1(uniqid())` and friends** only hide a guessable input behind a hash. The hash is still guessable if the input is.

A quick check you can run yourself:

```php
<?php
mt_srand(42); $a = mt_rand();
mt_srand(42); $b = mt_rand();
var_dump($a === $b); // bool(true): same seed, same "random" number
```

## The functions you should use

`random_bytes()` and `random_int()` (both PHP 7.0+) read from the operating system's secure source, such as `getrandom()` or `/dev/urandom` on Linux. The manual says their output is suitable for all applications, including long-term secrets like encryption keys. If no secure source is available they throw `Random\RandomException` (since PHP 8.2; before that, a plain `Exception`) instead of quietly returning weak data.

```php
<?php
// 32 random bytes = 256 bits. Raw bytes are unprintable, so encode them.
$hexToken = bin2hex(random_bytes(32));          // 64 hex characters

// URL-safe base64 version (shorter: 43 characters)
$urlToken = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

// 6-digit OTP. random_int is inclusive on both ends, so pad leading zeros.
$otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
```

On PHP 8.3+, `Random\Randomizer::getBytesFromString()` picks characters from an alphabet you choose, handy for codes people type by hand. When you create a `Randomizer` without an engine it uses `Random\Engine\Secure`:

```php
<?php
$r = new Random\Randomizer(); // defaults to Random\Engine\Secure
$code = $r->getBytesFromString('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10); // no 0/O, 1/I
```

## Laravel: Str::random is already secure

In the Laravel framework source, `Str::random($length = 16)` builds its string from `random_bytes()`, base64-encodes it and strips `/`, `+` and `=`. So it's fine for tokens:

```php
use Illuminate\Support\Str;

$token = Str::random(64); // letters and digits only
```

Laravel's own features follow the "store a hash, not the token" rule:

- **Password resets.** `DatabaseTokenRepository::createNewToken()` returns `hash_hmac('sha256', Str::random(40), $this->hashKey)`, and the row saved to the database holds `$this->hasher->make($token)`, a password-style hash. The plain token only lives in the email link.
- **Sanctum API tokens.** `HasApiTokens::createToken()` saves `hash('sha256', $plainTextToken)` in the `token` column, and `PersonalAccessToken::findToken()` checks it with `hash_equals()`.

## Store a hash and compare safely

If your database leaks, plain tokens in it are instantly usable. A SHA-256 hash of a 256-bit random token is not reversible in practice, so storing the hash is enough. You don't need bcrypt here because the input is already high-entropy, unlike a human password.

```php
<?php
// Issue
$plain = bin2hex(random_bytes(32));
$stored = hash('sha256', $plain);   // save $stored (+ user_id, expires_at)
// send $plain to the user, e.g. https://example.com/invite/{$plain}

// Verify
function tokenMatches(string $stored, string $fromUser): bool
{
    return hash_equals($stored, hash('sha256', $fromUser));
}
```

`hash_equals()` compares in a way that doesn't leak how much of the string matched through timing. The manual says to pass the known (secret) value first and the user-supplied value second. Hashing the user input first also keeps both arguments the same length.

In Laravel, look the row up by the hash, then check expiry:

```php
$invite = Invite::where('token_hash', hash('sha256', $request->route('token')))
    ->where('expires_at', '>', now())
    ->first();

abort_unless($invite, 404);
$invite->delete(); // single use
```

## What the demo printed

We ran the snippets above on PHP 8.4.23: the `Randomizer` engine was `Random\Engine\Secure`, the hex token was 64 characters, the URL-safe token 43, the OTP 6 digits, the alphabet code 10 characters, `hash_equals` returned `true` for the real token and `false` for a guess, the seeded `mt_rand()` repeated itself, and `uniqid()` was 13 characters.

## Quick audit checklist

- Search the codebase for `uniqid(`, `mt_rand(`, `rand(`, `md5(time` and `str_shuffle(` near anything called token, code, key, reset or invite.
- Use `random_bytes(32)` (encoded) or `Str::random(40+)` for links and keys, and `random_int()` for numeric codes.
- Store `hash('sha256', $token)`, never the plain token, and add an expiry and single-use delete.
- Compare with `hash_equals($stored, hash('sha256', $input))`, not `==` or `===`.
- Rate-limit OTP and reset endpoints, because a 6-digit code has only a million values.
- Hashing passwords is a different job: see [Password Hashing in PHP](/lessons/2026-11-03-password-hashing-in-php-password-hash-verify-rehash). Session IDs are covered in [Session Security in PHP and Laravel](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration).

Want a review of reset flows, API keys and token handling across a Laravel or PHP app? See [PHP Hub services](/services) (contact for quote) or run a quick pass with the [PHP Security Checker](https://php-security-checker.vercel.app).

## Sources

- [PHP manual: random_bytes](https://www.php.net/manual/en/function.random-bytes.php) — secure sources, suitable for encryption keys, Random\RandomException since 8.2
- [PHP manual: random_int](https://www.php.net/manual/en/function.random-int.php) — inclusive range, same secure sources
- [PHP manual: uniqid](https://www.php.net/manual/en/function.uniqid.php) — not cryptographically secure, 13 characters, no uniqueness guarantee
- [PHP manual: mt_rand](https://www.php.net/manual/en/function.mt-rand.php) — not cryptographically secure, seeding repeats the sequence
- [PHP manual: Random\Randomizer::getBytesFromString](https://www.php.net/manual/en/random-randomizer.getbytesfromstring.php) — PHP 8.3+
- [PHP manual: hash_equals](https://www.php.net/manual/en/function.hash-equals.php) — timing-safe comparison, argument order
- [Laravel framework 13.x: Str.php](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Support/Str.php) — `Str::random()` uses `random_bytes()`
- [Laravel framework 13.x: DatabaseTokenRepository.php](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Auth/Passwords/DatabaseTokenRepository.php) — reset token creation and hashed storage
- [Laravel Sanctum 4.x: HasApiTokens.php](https://github.com/laravel/sanctum/blob/4.x/src/HasApiTokens.php) and [PersonalAccessToken.php](https://github.com/laravel/sanctum/blob/4.x/src/PersonalAccessToken.php) — SHA-256 token storage and `hash_equals` lookup
