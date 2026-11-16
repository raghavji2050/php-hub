---
categories: [PHP, Laravel, Security]
title: "Encryption in Laravel and PHP: Crypt, APP_KEY and sodium"
date: 2026-11-16
description: "Encrypt application secrets with Laravel's Crypt facade or PHP's sodium functions. Protect APP_KEY, prefer encryptString, and rotate keys with APP_PREVIOUS_KEYS."
summary: "Laravel's Crypt::encryptString() uses OpenSSL AES-256-CBC and signs every value with a MAC. Generate APP_KEY with php artisan key:generate, never commit it, and use APP_PREVIOUS_KEYS when you rotate. In plain PHP, use the sodium extension's documented secretbox API rather than a home-grown cipher."
tags: ["php", "laravel", "security", "encryption", "cryptography"]
hero: "posts/laravel-crypt-encryption-hero.webp"
heroAlt: "Gold envelope with a glowing emerald wax seal beside an antique iron key, resting on dark blue cloth"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x encryption documentation and the PHP manual pages for the sodium secretbox functions. The sodium extension was not available on the PHP 8.4.23 CLI used for other demos in this series, so the sodium examples below are taken from the PHP manual rather than executed here.*

Quick answer: passwords should be hashed, not encrypted — see the [password hashing lesson](/lessons/2026-11-03-password-hashing-in-php-password-hash-verify-rehash/). For values you must later read back (API tokens, webhook secrets), use Laravel's `Crypt` facade or PHP's sodium functions. Protect `APP_KEY`. Do not invent a cipher of your own.

## Laravel `Crypt` and `APP_KEY`

Laravel's encryption documentation describes a wrapper around OpenSSL that offers AES-256 and AES-128. Before you encrypt anything, `config/app.php` must have a `key` value, which comes from the `APP_KEY` environment variable. Generate it with `php artisan key:generate`. The docs say that command uses PHP's secure random byte generator. A fresh Laravel install usually writes the key for you.

To encrypt a string, use `Crypt::encryptString()`. The same documentation states that this method encrypts with OpenSSL and the **AES-256-CBC** cipher, and that every encrypted value is signed with a message authentication code (MAC) so a tampered payload will not decrypt:

```php
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

$stored = Crypt::encryptString($request->token);

try {
    $token = Crypt::decryptString($stored);
} catch (DecryptException $e) {
    // The MAC did not match, or the key cannot decrypt this payload.
}
```

Catch `Illuminate\Contracts\Encryption\DecryptException`. That is the documented result when decryption fails, including when the MAC is invalid.

Prefer `encryptString()` / `decryptString()` for text. The documented API for everyday use is those two methods; they avoid treating the payload as a serialized PHP value.

## Rotating the key

If you change `APP_KEY`, Laravel will no longer decrypt data that was encrypted with the old key. The docs also note a second effect: **all authenticated user sessions are logged out**, because Laravel encrypts cookies, including the session cookie.

To rotate without an abrupt lockout, set `APP_PREVIOUS_KEYS` to a comma-separated list of old keys. Laravel then encrypts new values with the current `APP_KEY`, and when decrypting it tries the current key first, then each previous key, until one succeeds.

Do not paste keys into chat, tickets or git. Keep the current key and the previous-key list in your environment or a secret manager, not in the repository.

Encryption is only as strong as access to the key. If `APP_KEY` leaks, every cookie and every `Crypt` value can be decrypted, and attackers can mint payloads your app will trust. Rotate the key if it has been exposed, and treat old keys as secrets too until you are sure no ciphertext still depends on them.

## Plain PHP: sodium, not a homemade cipher

Outside Laravel, use the sodium extension. The PHP manual's documented symmetric API is `sodium_crypto_secretbox()` with `sodium_crypto_secretbox_keygen()` and a random nonce of `SODIUM_CRYPTO_SECRETBOX_NONCEBYTES`. Decrypt with `sodium_crypto_secretbox_open()`, and treat a `false` return as a failed authentication check, not as empty plaintext.

```php
<?php
$key = sodium_crypto_secretbox_keygen();
$nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
$cipher = sodium_crypto_secretbox($plaintext, $nonce, $key);

$plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);
if ($plain === false) {
    throw new RuntimeException('Could not decrypt payload.');
}
```

Store the nonce next to the ciphertext (it is not a secret) and keep the key in the environment, not in the repository. If sodium is not loaded, do not fall back to a homemade combination of `openssl_encrypt()` and a hand-rolled MAC; enable the extension or use a maintained library. We did not execute the sodium example here because this machine's PHP 8.4.23 CLI was built without `sodium`.

Encryption also does not authenticate *who* is allowed to see a value. A decrypted token still needs an authorization check before you use it.

One more distinction: hashing is one-way and is the right tool for passwords; encryption is reversible and is the right tool for a secret you must show or send later. Mixing them up usually means either storing passwords in a recoverable form, or encrypting a value you will never need to decrypt. Laravel's `Hash` facade and PHP's `password_hash()` belong in the password lesson, not in a `Crypt` call. And because `Crypt` values are only as confidential as `APP_KEY`, a staging key must not be reused in production.


## Quick audit checklist

- Confirm `APP_KEY` is set in production, was generated by `key:generate`, and is not in git.
- Encrypt only values you must later read; hash passwords with `password_hash()` / `Hash::make()`.
- Use `Crypt::encryptString()` and `decryptString()`, and catch `DecryptException`.
- When you rotate a key, set `APP_PREVIOUS_KEYS` and plan for sessions to re-authenticate once old keys are dropped.
- In plain PHP, use sodium secretbox (or a maintained library), not a custom cipher.

Related lessons: [Password Hashing in PHP](/lessons/2026-11-03-password-hashing-in-php-password-hash-verify-rehash/) and [Secure Random Tokens in PHP and Laravel](/lessons/2026-11-10-secure-random-tokens-php-laravel-random-bytes/).

## Sources

- [Laravel 13.x docs: Encryption](https://laravel.com/docs/13.x/encryption)
- [PHP manual: sodium_crypto_secretbox](https://www.php.net/manual/en/function.sodium-crypto-secretbox.php)
- [PHP manual: sodium_crypto_secretbox_keygen](https://www.php.net/manual/en/function.sodium-crypto-secretbox-keygen.php)
- [PHP manual: sodium_crypto_secretbox_open](https://www.php.net/manual/en/function.sodium-crypto-secretbox-open.php)
