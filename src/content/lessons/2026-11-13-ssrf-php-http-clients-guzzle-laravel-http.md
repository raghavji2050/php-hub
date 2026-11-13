---
categories: [PHP, Laravel, Security]
title: "SSRF in PHP HTTP Clients: Don't Fetch User-Supplied URLs"
date: 2026-11-13
description: "Stop server-side request forgery in PHP and Laravel: never pass a user-supplied URL to file_get_contents, cURL or Http::get. Allow-list hosts, require HTTPS, and disable redirects."
summary: "SSRF happens when your server fetches a URL an attacker chose. Don't pass request input to file_get_contents(), cURL or Laravel's Http::get(). Allow-list the hosts you intend to call, require HTTPS, reject URLs with credentials, and disable redirects."
tags: ["php", "laravel", "security", "ssrf", "http-client"]
hero: "posts/php-ssrf-http-clients-hero.webp"
heroAlt: "Dark lantern on a wooden table sending a gold beam into a glowing emerald shield, with a circular vault door in the mist behind it"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual pages for `parse_url` and `filter_var`, the Laravel 13.x HTTP client documentation, and the OWASP and MITRE pages linked below. Helper behaviour was checked on PHP 8.4.23.*

Quick answer: if your app fetches a URL that came from the query string, a webhook field or a "preview this link" form, the request leaves *your* server, with *your* network privileges. That is server-side request forgery (CWE-918). Do not pass that value to `file_get_contents()`, cURL or Laravel's `Http::get()`. Call only hosts you have allow-listed.

## Why a user-supplied URL is unsafe

PHP will happily request whatever you hand to `file_get_contents()` or cURL, including `file://` paths and internal HTTP addresses, unless you have tightly configured wrappers and a deny-list that actually holds up. Laravel's HTTP client is a wrapper around Guzzle: `Http::get($url)` will request the URL you give it. There is no built-in "block private hosts" switch in the Laravel 13.x HTTP client docs.

`filter_var($url, FILTER_VALIDATE_URL)` is not a defence. It only asks whether the string looks like a URL. It does not check that the host is one you intended to call, and it does not stop the client following a redirect to a different address.

OWASP's advice is to avoid sending the server to a caller-controlled URL at all. When you must fetch something remote, prefer a mapping you control (`?provider=github` looks up `https://api.github.com` on the server) over accepting a raw URL.

## An allow-list helper

The helper below accepts only `https` URLs whose host is in an explicit list, on the default HTTPS port, with no userinfo. It is a gate before you call `Http::get()`, not a complete HTTP client.

```php
<?php
function allowed_http_url(?string $url, array $allowedHosts): ?string
{
    if ($url === null || $url === '') {
        return null;
    }
    if (preg_match('/[\x00-\x1F\x7F\\\\]/', $url)) {
        return null;
    }
    $parts = parse_url($url);
    if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
        return null;
    }
    if (strtolower($parts['scheme']) !== 'https') {
        return null;
    }
    if (isset($parts['user']) || isset($parts['pass'])) {
        return null;
    }
    $host = strtolower($parts['host']);
    if (!in_array($host, $allowedHosts, true)) {
        return null;
    }
    $port = $parts['port'] ?? 443;
    if ($port !== 443) {
        return null;
    }
    return $url;
}
```

The PHP manual is clear that `parse_url()` "is not meant to validate the given URL", which is why the scheme, host, port and credential checks come first and why the host is compared with `in_array(..., true)` rather than `str_ends_with`. A suffix check would treat `api.github.com.evil.example` as GitHub.

If the helper returns a URL, fetch it with redirects turned off and a short timeout. Laravel documents both:

```php
use Illuminate\Support\Facades\Http;

Http::globalOptions([
    'allow_redirects' => false,
]);

$hostAllowList = ['api.github.com', 'example.com'];
$url = allowed_http_url($request->query('src'), $hostAllowList);
if ($url === null) {
    abort(422, 'Unsupported URL.');
}

$response = Http::timeout(3)->connectTimeout(2)->get($url);
```

`Http::globalOptions(['allow_redirects' => false])` is the official example for disabling redirects in the Laravel 13.x HTTP client. Without that, a host you allow-listed can still respond with a redirect to an address you never intended to reach.

A private-IP block list is a weaker backup, not a replacement for an allow-list. DNS can change between the moment you resolve a host and the moment you connect, and a public host can redirect. On PHP 8.4.23, `filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)` rejected loopback and private IPv4 addresses, link-local `169.254.169.254`, and `::1`, and accepted public addresses such as `8.8.8.8`. Treat that only as an extra signal, and still prefer an allow-list of hosts you own or have a contract with.

## What the demo printed

We ran `allowed_http_url()` on PHP 8.4.23 with the allow-list `api.github.com` and `example.com`:

| Input | Result |
| --- | --- |
| `https://api.github.com/repos/php/php-src` | accepted |
| `https://example.com/ok` | accepted |
| `http://example.com/ok` | rejected |
| `https://evil.example/ok` | rejected |
| `https://api.github.com.evil.example/ok` | rejected |
| `https://user:pass@example.com/ok` | rejected |
| `file:///etc/passwd` | rejected |
| `//example.com/ok` | rejected |
| `https://example.com:8443/ok` | rejected |

## Quick audit checklist

- Search for `file_get_contents(`, `fopen(`, `curl_setopt`, `Http::get(`, `Http::post(` and Guzzle `request(` and check whether any URL comes from the request, a database field a user can edit, or a webhook payload.
- Replace raw URLs with a server-side map of provider names to fixed endpoints wherever you can.
- If you must accept a URL, run it through one allow-list helper, require HTTPS, reject userinfo, and disable redirects.
- Set connect and response timeouts so a stalled internal hop cannot hang a worker.
- Do not use `FILTER_VALIDATE_URL` as your only check.

Related lessons: [Open Redirects in PHP and Laravel](/lessons/2026-11-11-open-redirects-php-laravel-safe-next-url/).

## Sources

- [Laravel 13.x docs: HTTP Client](https://laravel.com/docs/13.x/http-client)
- [Laravel 13.x docs: HTTP Client, Guzzle Options](https://laravel.com/docs/13.x/http-client#guzzle-options)
- [PHP manual: parse_url](https://www.php.net/manual/en/function.parse-url.php)
- [PHP manual: filter_var](https://www.php.net/manual/en/function.filter-var.php)
- [OWASP Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MITRE CWE-918: Server-Side Request Forgery (SSRF)](https://cwe.mitre.org/data/definitions/918.html)
