---
categories: [PHP, Laravel, Security]
title: "Path Traversal in PHP and Laravel: Safe File Paths"
date: 2026-11-14
description: "Stop path traversal when PHP opens a user-supplied file name. Reject null bytes and absolute paths, resolve with realpath, and confirm the result stays inside your storage directory."
summary: "Never concatenate request input onto a filesystem path. Reject null bytes, backslashes and absolute paths, resolve the result with realpath(), and allow the file only when it stays inside a known base directory. realpath() returns false when the path does not exist, so new files need a parent-directory check."
tags: ["php", "laravel", "security", "path-traversal", "filesystem"]
hero: "posts/php-laravel-path-traversal-hero.webp"
heroAlt: "Antique wooden chest of drawers with open drawers, dusty footprints leading to a curved glowing emerald barrier"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual page for `realpath`, the OWASP path traversal page, and MITRE CWE-22. The helper below was run on PHP 8.4.23.*

Quick answer: if a download, preview or delete action builds a file path from a request parameter, an attacker can walk out of your uploads directory with `../`. That is path traversal (CWE-22). Keep user-supplied names inside one directory you choose, and verify that after the path is resolved.

## Why string concatenation is not enough

The PHP manual for `realpath()` shows how the function expands `/./` and `/../`. After changing the current directory to `/var/www/`, its own example of `realpath('./../../etc/passwd')` resolves to `/etc/passwd`. If you simply prepend `/var/www/uploads/` to `../../secret.txt`, you have not stayed in uploads.

Two more details from the same manual page matter in application code:

- `realpath()` returns `false` when the path does not exist, or when the process cannot traverse a directory on the way. A "create this file" flow cannot rely on `realpath()` of the final path alone.
- The function also refuses to work on a virtual path inside a Phar archive.

`basename()` is useful for a single filename ("save this upload as a generated name"), but it is the wrong tool when you want to allow a relative path such as `nested/note.txt`. You need a join against a base directory, then a containment check.

This is the same family of mistake as [unsafe file uploads](/lessons/2026-11-08-safe-file-uploads-php-laravel-validation-storage/): the client tells you a name, and you must not trust it as a location.

## A containment helper

The helper below allows a relative path only when the resolved location is the storage directory or a file inside it. Absolute paths, null bytes and backslashes are rejected up front. If `realpath()` fails because the file is new, the helper rejects any `.` or `..` segment and then checks the parent directory.

```php
<?php
function safe_storage_path(string $baseDir, string $userPath): ?string
{
    if ($userPath === '' || str_contains($userPath, "\0")) {
        return null;
    }
    if (str_contains($userPath, '\\') || str_starts_with($userPath, '/')) {
        return null;
    }

    $base = realpath($baseDir);
    if ($base === false) {
        return null;
    }

    $candidate = $base . DIRECTORY_SEPARATOR . $userPath;
    $real = realpath($candidate);

    if ($real === false) {
        foreach (explode('/', $userPath) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                return null;
            }
        }
        $parent = realpath(dirname($candidate));
        $name = basename($userPath);
        if ($parent === false || $name === '' || $name === '.' || $name === '..') {
            return null;
        }
        if ($parent !== $base && !str_starts_with($parent, $base . DIRECTORY_SEPARATOR)) {
            return null;
        }
        return $parent . DIRECTORY_SEPARATOR . $name;
    }

    if ($real !== $base && !str_starts_with($real, $base . DIRECTORY_SEPARATOR)) {
        return null;
    }
    return $real;
}
```

The prefix check uses `$base . DIRECTORY_SEPARATOR`, not a bare `$base`. Otherwise a directory named `/var/www/uploads-extra` would match a base of `/var/www/uploads`.

In Laravel, resolve the base with `Storage::disk('local')->path('')` (or a dedicated disk whose root sits outside the web root) and never pass the request value to `file_get_contents()` or `Storage::get()` until this helper has accepted it. Prefer a generated filename, as the file-upload lesson describes, whenever the client does not need to choose a path at all.

## What the demo printed

We created a temporary `store/` directory with `readme.txt` and `nested/note.txt`, and a `secret.txt` file *beside* that directory. Then we ran the helper on PHP 8.4.23:

| Input | Result |
| --- | --- |
| `readme.txt` | accepted (file inside `store/`) |
| `nested/note.txt` | accepted |
| `new-file.txt` | accepted (parent is `store/`) |
| `nested/../readme.txt` | accepted (realpath stays inside `store/`) |
| `../secret.txt` | rejected |
| `nested/../../secret.txt` | rejected |
| `/etc/passwd` | rejected |
| `readme.txt` + a null byte + `.jpg` | rejected |
| `..\secret.txt` | rejected |
| `(empty)` | rejected |

The `nested/../readme.txt` row is the useful one: `..` is not automatically evil. After `realpath()`, the path still pointed at a file inside `store/`, so the helper allowed it. The rows that walk out to `secret.txt` were rejected.

## Quick audit checklist

- Search for `file_get_contents`, `file_put_contents`, `fopen`, `unlink`, `readfile`, `Storage::get`, `Storage::download` and `response()->file(` and check whether any path segment comes from the request.
- Keep user files on a disk whose root is outside the public directory.
- Run every user-supplied relative path through one helper like `safe_storage_path()`.
- Do not test containment with `str_contains($path, $base)` alone; use a directory-separator prefix check after resolving.
- Add tests for `../`, nested `../`, a leading `/`, a null byte and a backslash, and expect a rejection.

Related lessons: [Safe File Uploads in PHP and Laravel](/lessons/2026-11-08-safe-file-uploads-php-laravel-validation-storage/).

## Sources

- [PHP manual: realpath](https://www.php.net/manual/en/function.realpath.php)
- [OWASP: Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [MITRE CWE-22: Improper Limitation of a Pathname to a Restricted Directory](https://cwe.mitre.org/data/definitions/22.html)
