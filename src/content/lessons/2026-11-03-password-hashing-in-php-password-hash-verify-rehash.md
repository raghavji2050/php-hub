---
categories: [PHP, Laravel, Security]
title: "Password Hashing in PHP: password_hash, password_verify and Safe Rehashing"
date: 2026-11-03
description: "Store PHP passwords safely with password_hash() and password_verify(), upgrade old hashes on login with password_needs_rehash(), and migrate legacy MD5 hashes. Laravel Hash facade notes included."
summary: "Store PHP passwords safely with password_hash() and password_verify(), upgrade old hashes on login with password_needs_rehash(), and migrate legacy MD5 hashes."
tags: ["php", "laravel", "security", "passwords", "authentication"]
level: beginner
hero: "posts/password-hashing-php-hero.webp"
heroAlt: "Abstract illustration of a glowing green padlock over a network of connected nodes and hash-like bars on a dark background"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the official PHP, Laravel and OWASP documentation linked below.*

Quick answer: in PHP, hash passwords with `password_hash($password, PASSWORD_DEFAULT)`, check them with `password_verify()`, and on every successful login call `password_needs_rehash()` so old hashes are upgraded automatically. Never use `md5()`, `sha1()` or plain `hash('sha256', ...)` for passwords, and never generate your own salt.

## Why fast hashes are wrong for passwords

OWASP's Password Storage Cheat Sheet is clear: passwords must be stored with a **slow, salted** algorithm such as Argon2id, scrypt, bcrypt or PBKDF2. Fast algorithms like SHA-256 let an attacker with a stolen database try huge numbers of guesses per second. A unique per-password salt also stops precomputed rainbow-table attacks and hides which users share the same password.

PHP's password API (available since PHP 5.5) does all of this for you: it picks a strong algorithm, generates a random salt, and stores the algorithm, cost and salt inside the hash string itself.

## 1. Hash on registration

```php
<?php
const PW_ALGO = PASSWORD_DEFAULT;
const PW_OPTIONS = []; // e.g. ['cost' => 13] for bcrypt

function register(PDO $db, string $email, string $password): void
{
    if (strlen($password) > 72) {
        throw new InvalidArgumentException('Password too long (max 72 bytes).');
    }
    $hash = password_hash($password, PW_ALGO, PW_OPTIONS);
    $stmt = $db->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    $stmt->execute([$email, $hash]);
}
```

Key points from the PHP manual:

- `PASSWORD_DEFAULT` currently means **bcrypt** (the `$2y$` prefix), but it is designed to change as stronger algorithms are added. Store the hash in a column that can grow beyond 60 bytes; the manual suggests **255** (`VARCHAR(255)`).
- Don't pass a `salt` option. It is deprecated, and since PHP 8.0 an explicit salt is ignored. A secure random salt is generated for every hash.
- With bcrypt, input longer than **72 bytes** is truncated. That's why the example rejects longer passwords instead of silently cutting them. (Note: bytes, not characters, so multibyte passwords hit the limit sooner.)
- Since PHP 8.0, `password_hash()` throws on failure instead of returning `false`.

## 2. Verify on login, then rehash if needed

```php
<?php
function login(PDO $db, string $email, string $password): ?int
{
    $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return null; // same message for "no such user" and "wrong password"
    }

    if (password_needs_rehash($user['password_hash'], PW_ALGO, PW_OPTIONS)) {
        $new = password_hash($password, PW_ALGO, PW_OPTIONS);
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
           ->execute([$new, $user['id']]);
    }

    return (int) $user['id'];
}
```

`password_verify()` reads the algorithm, cost and salt from the stored hash, so you don't need separate columns for them, and the manual states it is safe against timing attacks. Do **not** compare hashes yourself with `==`.

`password_needs_rehash()` returns `true` when the stored hash doesn't match the algorithm and options you pass in. The only moment you have the plain-text password is right after a successful login, so that's where you upgrade it. OWASP recommends exactly this "rehash on next login" approach for raising work factors.

## Why rehashing matters right now: PHP 8.4 raised the bcrypt cost

The PHP manual's changelog notes that in **PHP 8.4.0 the default bcrypt `cost` went from 10 to 12**. If your app uses `PASSWORD_DEFAULT` with no options, users who registered on PHP 8.3 or older have cost-10 hashes. After upgrading to 8.4, `password_needs_rehash($hash, PASSWORD_DEFAULT)` returns `true` for them, and the login code above quietly upgrades each one to cost 12 the next time they sign in. You can see a hash's parameters with `password_get_info($hash)`.

To pick a cost for your own server, the manual's benchmark example increases the cost until a hash takes about 350 ms, which it calls an appropriate delay for interactive logins. OWASP says bcrypt's work factor should be at least 10. Higher costs also make login more CPU-heavy, so pair them with rate limiting.

## Argon2id instead of bcrypt?

OWASP's first recommendation for new systems is **Argon2id** (bcrypt is listed for legacy systems where Argon2 isn't available). PHP supports it with `PASSWORD_ARGON2ID` (PHP 7.3+), but only if PHP was compiled with Argon2 support, so check `defined('PASSWORD_ARGON2ID')` first. Switching is a one-line change to `PW_ALGO`. Because the login code already calls `password_needs_rehash()`, existing bcrypt hashes migrate to Argon2id as users log in.

## Migrating legacy MD5 hashes

If an old app stored `md5($password)`, you can upgrade users on login without a forced reset:

```php
<?php
$stored = $user['password_hash'];
$isLegacyMd5 = (bool) preg_match('/^[a-f0-9]{32}$/', $stored);

$ok = $isLegacyMd5
    ? hash_equals($stored, md5($password))   // old scheme, constant-time compare
    : password_verify($password, $stored);

if ($ok && ($isLegacyMd5 || password_needs_rehash($stored, PASSWORD_DEFAULT))) {
    $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
       ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
}
```

`hash_equals()` is PHP's timing-attack-safe string comparison. OWASP points out the catch: weak hashes stay in the database until each user logs in. For inactive accounts, either expire them and require a password reset, or wrap the old hash, e.g. `password_hash($md5Hash, ...)`, and replace it with a direct hash at the next login.

## Laravel: the Hash facade does the same thing

Laravel's `Hash` facade wraps the same ideas. Bcrypt is the default driver (set with `HASH_DRIVER`, with `argon` and `argon2id` also available):

```php
use Illuminate\Support\Facades\Hash;

$hashed = Hash::make($request->password);

if (Hash::check($plain, $hashed)) {
    // The passwords match...
}

if (Hash::needsRehash($hashed)) {
    $hashed = Hash::make($plain);
}
```

The Laravel docs also note that `Hash::check` first confirms the hash was made with the app's configured algorithm and throws a `RuntimeException` if it wasn't. If you're mid-migration between algorithms, the docs say you can set `HASH_VERIFY=false`.

## Checklist

- Use `password_hash()` with `PASSWORD_DEFAULT` (or Argon2id if available). No custom salts, no MD5/SHA for passwords.
- Store hashes in a `VARCHAR(255)` column.
- Verify only with `password_verify()` (or `Hash::check` in Laravel).
- Call `password_needs_rehash()` after every successful login, especially after upgrading to PHP 8.4.
- With bcrypt, enforce a 72-byte maximum password length.
- Benchmark the cost on your server and rate-limit login attempts.

## Sources

- PHP manual: [password_hash()](https://www.php.net/manual/en/function.password-hash.php)
- PHP manual: [password_verify()](https://www.php.net/manual/en/function.password-verify.php)
- PHP manual: [password_needs_rehash()](https://www.php.net/manual/en/function.password-needs-rehash.php)
- PHP manual: [password_get_info()](https://www.php.net/manual/en/function.password-get-info.php) and [hash_equals()](https://www.php.net/manual/en/function.hash-equals.php)
- Laravel docs: [Hashing](https://laravel.com/docs/13.x/hashing)
- OWASP: [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
