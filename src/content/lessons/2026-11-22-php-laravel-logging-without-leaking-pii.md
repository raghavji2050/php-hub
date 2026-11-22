---
categories: [PHP, Laravel, Security]
title: "Logging Without Leaking Secrets or PII in PHP and Laravel"
date: 2026-11-22
description: "Keep passwords, tokens, cookies and card numbers out of Laravel logs. Log a request id, not the whole request, and redact sensitive keys before you write context."
summary: "Do not log $request->all(), Authorization headers, cookies or passwords. Use Laravel's Log facade with a request id from Log::withContext() or shareContext(), and run context arrays through a redaction helper before writing them. Logs are often copied to Slack, files and log vendors — a secret in a log is a secret out of your app."
tags: ["php", "laravel", "security", "logging", "privacy"]
hero: "posts/php-laravel-safe-logging-hero.webp"
heroAlt: "Open leather logbook under a green banker's lamp, a small stack of gold bars resting on the page, fountain pen beside it on a dark desk"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x logging documentation and the OWASP Logging Cheat Sheet. The redaction helper was run on PHP 8.4.23.*

Quick answer: logs exist so you can debug production, but they also leave the request path — into files, `stderr`, Slack, or a log vendor. If you write a password, a session cookie or a card number there, you have stored a secret in a second system. Log a request id and the fields you need. Do not log the raw request.

## What Laravel gives you — and what it does not

Laravel logging is built on channels (the default is a `stack` of other channels) and uses Monolog under the hood. Official drivers include `single`, `daily`, `monthly`, `slack`, `syslog`, `errorlog`, `monolog` and `custom`. That list is why a careless `Log::info()` can fan out: a stack that includes Slack will send the same context to a chat room.

You can pass a context array as the second argument:

```php
use Illuminate\Support\Facades\Log;

Log::info('Order paid', [
    'order_id' => $order->id,
    'user_id' => $order->user_id,
]);
```

For a value that should appear on every line of the current request, the docs show `Log::withContext()` on one channel, or `Log::shareContext()` to share a key such as a request id across all channels. That is a good place to put a UUID, not a place to dump the request:

```php
$requestId = (string) Str::uuid();
Log::shareContext(['request-id' => $requestId]);
$response->headers->set('Request-Id', $requestId);
```

The Laravel 13.x logging documentation does not describe an automatic PII or password redactor. If you log `$request->all()`, `$_POST`, `$request->headers`, or an exception that includes request input, those values are written as they are. You have to filter them.

## A small redaction helper

Call this on any context array before it reaches the logger. It replaces known secret keys, including nested ones, and keys that end with `_token` or `_password`:

```php
<?php
function redact_log_context(array $context, array $secretKeys = [
    'password',
    'password_confirmation',
    'token',
    'secret',
    'authorization',
    'cookie',
    'credit_card',
    'card_number',
    'cvv',
    'ssn',
]): array {
    $out = [];
    foreach ($context as $key => $value) {
        $name = strtolower((string) $key);
        $blocked = false;
        foreach ($secretKeys as $secretKey) {
            if ($name === $secretKey || str_ends_with($name, '_'.$secretKey)) {
                $blocked = true;
                break;
            }
        }
        if ($blocked) {
            $out[$key] = '[redacted]';
            continue;
        }
        $out[$key] = is_array($value) ? redact_log_context($value, $secretKeys) : $value;
    }
    return $out;
}
```

On PHP 8.4.23, this input:

```php
[
    'user_id' => 15,
    'email' => 'user@example.com',
    'password' => 'hunter2',
    'remember_token' => 'abc',
    'authorization' => 'Bearer secret-token',
    'order' => ['id' => 9, 'card_number' => '4111111111111111'],
]
```

became a structure where `user_id`, `email` and `order.id` were unchanged, and `password`, `remember_token`, `authorization` and `order.card_number` were replaced with `[redacted]`.

Redaction is not a licence to log everything else. An email address, a phone number or a home address may still be personal data you do not need in a debug log. Prefer ids (`user_id`, `order_id`) and a request id. The OWASP Logging Cheat Sheet's theme is the same: log enough to investigate an incident, and keep credentials and sensitive personal data out.

Watch exception handlers and HTTP client debug flags as well. Laravel's HTTP client documents a Guzzle `debug` option; leaving that on in production can print request and response bodies. And do not log the first 8 characters of a [password reset token](/lessons/2026-11-10-secure-random-tokens-php-laravel-random-bytes/) or an `Authorization` header "for debugging". If you need to correlate a token, store a hash of it, the way that lesson already recommends for the database.

Query logs deserve the same caution. A bound SQL value can be a password reset token or an access token. If you enable query logging in production, review what is being written, and turn it off when you are not actively investigating. The goal is a log you would be willing to hand to a support vendor: useful identifiers, no credentials.


## Quick audit checklist

- Search for `Log::`, `logger(`, `error_log(`, `dd(`, `dump(` and `Log::info($request` and look at the context you pass.
- Never log `$request->all()`, `$request->headers`, `$_COOKIE`, `$_POST` or `Authorization`.
- Put a request id in `Log::shareContext()`; put secrets in neither the message nor the context.
- Run context through a redaction helper, and extend the key list when you add a new secret field.
- Review every channel in `config/logging.php`, especially `slack`, and who can read those destinations.
- Restrict file permissions on `storage/logs` and rotate logs so old secrets do not live forever.

Related lessons: [Keeping Secrets Out of Git](/lessons/2026-11-21-laravel-secrets-env-app-key-debug-mode/) and [Session Security in PHP and Laravel](/lessons/2026-11-09-php-laravel-session-security-cookies-regeneration/).

## Sources

- [Laravel 13.x docs: Logging](https://laravel.com/docs/13.x/logging)
- [Laravel 13.x docs: Contextual Information](https://laravel.com/docs/13.x/logging#contextual-information)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [MITRE CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
