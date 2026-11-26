---
categories: [PHP, Laravel, Security]
title: "Verify Webhook Signatures in PHP and Laravel (HMAC, Raw Body, Replays)"
date: 2026-11-26
description: "A webhook URL is public, so anyone can POST to it. Verify the HMAC signature over the raw body with hash_hmac and hash_equals, reject old timestamps, skip duplicate event IDs, and exempt only the webhook route from CSRF in Laravel."
summary: "Never trust a webhook just because it hit your URL. Read the raw body, recompute the HMAC with your shared secret, compare with hash_equals (never ==), reject stale timestamps, store event IDs so a replay or retry runs only once, and exempt just the webhook path from CSRF. For Stripe, let the official SDK do the check."
tags: ["php", "laravel", "security", "webhooks", "hmac"]
hero: "posts/php-webhook-signature-hero.webp"
heroAlt: "Kraft paper envelope closed with a dark red wax seal pressed with a leaf pattern, beside a brass letter opener on a dark wooden desk"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual, the Laravel 13.x CSRF docs, GitHub's "Validating webhook deliveries" guide and Stripe's webhook signature docs.*

Quick answer: your webhook endpoint is a public URL, so anyone who finds it can send a fake "payment succeeded" or "push to main" event. Providers sign each delivery with a secret only you and they know. Recompute that signature over the **raw** request body, compare it in constant time with `hash_equals()`, and drop the request if it doesn't match.

## The bug: trusting the POST

```php
// Anyone can call this with {"type":"payment.succeeded","order_id":42}
Route::post('/webhooks/payments', function (Request $request) {
    Order::find($request->input('order_id'))->markPaid();
    return response()->noContent();
});
```

Nothing here proves the request came from your payment provider.

## Fix 1: recompute the HMAC over the raw body

Most providers send an HMAC-SHA256 of the body. GitHub, for example, sends it in the `X-Hub-Signature-256` header, and the value always starts with `sha256=`. PHP's `hash_hmac()` returns lowercase hex by default, which matches that format.

```php
$payload   = $request->getContent();          // raw body, exactly as sent
$secret    = config('services.github.webhook_secret');
$expected  = 'sha256=' . hash_hmac('sha256', $payload, $secret);
$signature = (string) $request->header('X-Hub-Signature-256');

if (! hash_equals($expected, $signature)) {
    abort(403);
}
```

Two details matter:

- **Use the raw body.** `$request->getContent()` (from Symfony's Request, which Laravel's extends) gives the bytes that were signed. Re-encoding `$request->all()` with `json_encode()` can change spacing, key order or escaping, and the signature will never match. Stripe's docs say the same: don't format or modify the payload before verifying.
- **Use `hash_equals()`, not `==` or `===`.** The PHP manual describes it as a "timing attack safe string comparison", available since PHP 5.6. GitHub's guide also warns against a plain `==` for the same reason. Put the value you computed first and the user-supplied value second.

Keep the secret in `.env` and read it through `config/services.php`, never hard-coded in the controller.

## Fix 2: reject old deliveries (replay attacks)

A valid, signed request can be captured and re-sent later. Stripe handles this by putting a timestamp inside the signed data: its `Stripe-Signature` header carries `t=` (timestamp) and `v1=` (signature), and the signed string is the timestamp, a `.`, and the raw body. Because the timestamp is signed, an attacker can't change it. Stripe's libraries use a **default tolerance of 5 minutes**, and Stripe recommends keeping your server clock in sync with NTP.

If you design your own webhooks (say, between two of your services), copy that idea:

```php
$timestamp = (int) $request->header('X-Webhook-Timestamp');
$expected  = hash_hmac('sha256', $timestamp . '.' . $request->getContent(), $secret);

if (abs(time() - $timestamp) > 300) {          // 5 minutes
    abort(403, 'Stale webhook');
}
if (! hash_equals($expected, (string) $request->header('X-Webhook-Signature'))) {
    abort(403);
}
```

## Fix 3: handle each event once

Providers retry when you time out or return an error, so the same event can arrive twice even without an attacker. Stripe's docs suggest tracking event IDs to spot duplicate deliveries. A unique column does the job:

```php
// migration: $table->string('event_id')->unique();
$event = json_decode($request->getContent(), true);

$fresh = WebhookEvent::firstOrCreate(['event_id' => $event['id']])->wasRecentlyCreated;

if (! $fresh) {
    return response()->noContent();            // already processed, just say OK
}

ProcessPaymentEvent::dispatch($event);          // do slow work in a queued job
return response()->noContent();
```

Answer quickly with a 2xx and push slow work to a queue, so the provider doesn't time out and retry.

## Fix 4: exempt only the webhook path from CSRF

Webhooks don't carry your CSRF token, so Laravel will reject them on `web` routes. Exempt only that path, not your whole app. In Laravel 13.x this goes in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->preventRequestForgery(except: [
        'webhooks/*',
    ]);
})
```

Turning CSRF off is safe here only because the signature check replaces it. If you skip the signature check, this exemption leaves the route wide open. (Routes in `routes/api.php` don't use the CSRF middleware at all.)

## For Stripe, use the SDK

Don't hand-parse `Stripe-Signature`. The official `stripe/stripe-php` library verifies the signature and timestamp for you:

```php
try {
    $event = \Stripe\Webhook::constructEvent(
        $request->getContent(),
        $request->header('Stripe-Signature'),
        config('services.stripe.webhook_secret'),
    );
} catch (\Stripe\Exception\UnexpectedValueException | \Stripe\Exception\SignatureVerificationException $e) {
    abort(400);
}
```

If you use Laravel Cashier, it includes a middleware that validates incoming Stripe webhook signatures once `STRIPE_WEBHOOK_SECRET` is set in your `.env`.

## Checklist

- [ ] Signature recomputed over `$request->getContent()`, never re-encoded JSON
- [ ] Compared with `hash_equals()`
- [ ] Timestamp checked (about 5 minutes) when the provider sends one
- [ ] Event IDs stored with a unique index; duplicates return 2xx and do nothing
- [ ] Only the webhook path is exempt from CSRF
- [ ] Secret in `.env`, rotated if it ever leaks
- [ ] A feature test that posts a badly signed payload and expects 403

**How it's asked in interviews:** "How do you know a webhook really came from Stripe or GitHub?" Answer with HMAC over the raw body, constant-time compare, timestamp tolerance and idempotent processing.

**Where it applies in real work:** payment gateways (Stripe, Razorpay), GitHub deploy hooks, and any service-to-service callback you build yourself.

## Sources

- PHP manual: [hash_hmac()](https://www.php.net/manual/en/function.hash-hmac.php) and [hash_equals()](https://www.php.net/manual/en/function.hash-equals.php)
- GitHub Docs: [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- Stripe Docs: [Check webhook signatures](https://docs.stripe.com/webhooks/signature)
- Laravel 13.x: [CSRF protection, excluding URIs](https://laravel.com/docs/13.x/csrf)
- Laravel 13.x: [Cashier (Stripe), verifying webhook signatures](https://laravel.com/docs/13.x/billing#verifying-webhook-signatures)
