---
categories: [PHP, Laravel, Security]
title: "PHP Deserialization Risks: Why unserialize Is Unsafe for User Input"
date: 2026-11-20
description: "Do not pass untrusted input to PHP's unserialize(), even with allowed_classes. Prefer JSON, and HMAC any serialized payload you must store yourself."
summary: "The PHP manual warns: do not pass untrusted input to unserialize(), regardless of allowed_classes. Unserialization can instantiate objects and run code during autoloading. Prefer json_encode() / json_decode() for data you accept from users, and treat allowed_classes as a hardening step for trusted payloads only."
tags: ["php", "security", "unserialize", "deserialization", "json"]
hero: "posts/php-unserialize-deserialization-hero.webp"
heroAlt: "Ornate wooden puzzle box with brass inlay, held shut by a glowing emerald latch, green light leaking from under the lid"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual page for `unserialize`, the OWASP Deserialization Cheat Sheet, and MITRE CWE-502. The behaviour of `allowed_classes` and `json_decode` was checked on PHP 8.4.23.*

Quick answer: if a cookie, cache value, queue payload or form field is handed to `unserialize()`, stop. The official PHP warning is not limited to "don't unserialize objects". It says **do not pass untrusted user input to `unserialize()` regardless of the `allowed_classes` option**. Use JSON for data that crosses a trust boundary.

## Why `unserialize()` is different from JSON

`unserialize()` rebuilds a PHP value, including objects. After an object is reconstructed, PHP may call `__unserialize()` or `__wakeup()` if they exist. If the class is not loaded, autoloading can run during that process. That is why a crafted payload is dangerous even when you never call a method yourself: construction is enough. This is insecure deserialization (CWE-502).

The manual's `allowed_classes` option can be `false` (accept no classes), an allow-list of class names, or `true` (accept all classes). If an unexpected class appears and the option is not `true`, PHP instantiates `__PHP_Incomplete_Class` instead. **Omitting the option is the same as `true`.** That hardening is useful for data you serialized yourself. It does not make untrusted input safe. The manual says so in a warning at the top of the page.

If you must store a serialized payload in a place someone else could edit, the manual's own advice is to authenticate it with `hash_hmac()` and refuse to unserialize a value that fails the check. Even then, prefer JSON.

`json_encode()` / `json_decode()` move arrays and scalar values without reconstructing objects. That is the right default for APIs, cookies and job payloads that do not need PHP classes.

## What we ran on PHP 8.4.23

```php
<?php
$payload = serialize(['order_id' => 42, 'status' => 'paid']);
$fromAllowed = unserialize($payload, ['allowed_classes' => false]);
// array('order_id' => 42, 'status' => 'paid')

class DemoWidget {
    public function __construct(public string $name) {}
}
$blocked = unserialize(serialize(new DemoWidget('demo')), ['allowed_classes' => false]);
// $blocked is __PHP_Incomplete_Class

$decoded = json_decode(
    json_encode(['order_id' => 42, 'status' => 'paid'], JSON_THROW_ON_ERROR),
    true,
    512,
    JSON_THROW_ON_ERROR
);
```

An array payload still decodes when `allowed_classes` is `false`. An object payload becomes `__PHP_Incomplete_Class` rather than `DemoWidget`. That is the documented hardening, and it is still not a reason to call `unserialize()` on a request body.

Two other options are worth knowing about from the changelog on the same manual page: `max_depth` (since PHP 7.4, default 4096) limits nesting so a deep payload is less likely to exhaust the stack, and since PHP 8.3 a string that is not unserializable emits `E_WARNING` (it used to be `E_NOTICE`).

Laravel's `Crypt::encryptString()` / `decryptString()`, covered in the [encryption lesson](/lessons/2026-11-16-encryption-laravel-crypt-app-key-sodium/), is the documented way to protect a string without treating it as a serialized PHP value. If you use Laravel cache or queues, prefer array or JSON payloads over `serialize()` of objects you do not control.

PHP sessions historically store serialized data, but that storage is a server-side file or store you control, not a good reason to accept a serialized blob from the browser. If you ever put session-like data in a cookie, use a signed or encrypted token (Laravel already encrypts cookies) and keep the contents as simple values, not arbitrary objects.


Also be careful with file paths that come from the request. Some PHP stream wrappers can have unexpected behaviour when a path is passed to filesystem functions. Do not let user input choose a wrapper or a path; the [path traversal lesson](/lessons/2026-11-14-path-traversal-php-laravel-realpath/) covers containment, and `allowed_classes` does not help there.

WordPress has `maybe_unserialize()` for options and metadata that may be stored serialized. That is fine for values WordPress itself wrote. It is not a reason to take a raw POST body or a cookie and run it through `maybe_unserialize()` or `unserialize()`. If you need to accept structured input from a user, parse JSON or a form array and then build your own objects in code.


## Quick audit checklist

- Search for `unserialize(`, `maybe_unserialize(`, and `Yii`/`Symfony` equivalents. Check whether the argument can come from a cookie, form, query string, database column a user can edit, or a queue.
- Replace those call sites with `json_decode(..., true, 512, JSON_THROW_ON_ERROR)` when you only need arrays and scalars.
- If you must call `unserialize()` on data you stored, HMAC it, pass `allowed_classes` (`false` or an allow-list, never omitted), and set a tight `max_depth`.
- Do not hide objects in cookies "because they are serialized".
- Add a test that an unexpected object does not come back as a live class instance.

Related lessons: [Encryption in Laravel and PHP](/lessons/2026-11-16-encryption-laravel-crypt-app-key-sodium/) and [Path Traversal in PHP and Laravel](/lessons/2026-11-14-path-traversal-php-laravel-realpath/).

## Sources

- [PHP manual: unserialize](https://www.php.net/manual/en/function.unserialize.php)
- [PHP manual: json_decode](https://www.php.net/manual/en/function.json-decode.php)
- [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
- [MITRE CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
