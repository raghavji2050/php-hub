---
categories: [PHP, Laravel, Security]
title: "Safe File Uploads in PHP and Laravel: Validation, Storage and Serving"
date: 2026-11-08
description: "Don't trust the client filename, extension or Content-Type. Validate uploads from file contents, store them under a generated name outside the web root, and serve private files through your app."
summary: "Treat the client filename, extension and Content-Type as untrusted, detect the type from file contents, store under a generated name on a non-public disk, and never let the web server execute an upload as PHP."
tags: ["php", "laravel", "security", "file-uploads", "validation"]
hero: "posts/php-laravel-file-uploads-hero.webp"
heroAlt: "Abstract emerald file document accepted at a glass gate on a dark background; a red jagged file is rejected while a shield with a lock stands on the right"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the official Laravel file storage and validation documentation, the PHP manuals for `move_uploaded_file`, `is_uploaded_file`, `finfo_file` and `mime_content_type`, and the OWASP File Upload Cheat Sheet linked below.*

Quick answer: the browser-supplied filename, extension and `Content-Type` are just claims. Detect the type from the file's contents (`finfo` / `mime_content_type`, or Laravel's `mimes` / `mimetypes` / `File::types()` rules, which read the file), store it under a name your application generates, keep private files off the public disk, and never put uploads in a directory the web server will execute as PHP.

## Why the client filename and Content-Type are not enough

OWASP's File Upload Cheat Sheet is blunt: do not trust the `Content-Type` header (it can be spoofed), validate the file type, change the filename to something the application generates, set a size limit, and store files outside the web root — on a different server if you can.

Laravel says the same thing in framework terms. `getClientOriginalName()` and `getClientOriginalExtension()` are considered unsafe because a malicious user can tamper with the name and extension. Prefer `hashName()` (a unique, random name) and `extension()` (derived from the file's MIME type). The docs also warn you not to derive the filename argument of `storeAs` or `putFileAs` from user input: if that file ends up web-accessible under an executable extension, the web server may run it as PHP. Persist the original name in your database if you need to display it.

So these are conceptual mistakes, not "clever sanitizing":

```php
// Unsafe: the original client name is interpolated into a public path
$path = public_path('uploads/' . $request->file('photo')->getClientOriginalName());

// Also unsafe: storeAs on the public disk using the client filename
$request->file('photo')->storeAs(
    'uploads',
    $request->file('photo')->getClientOriginalName(),
    'public'
);
```

Even `basename()` only strips directory components. PHP's own `move_uploaded_file` example uses `basename()` and notes that further validation of the filename may still be appropriate. A name like `../../public/uploads/user photo.png` becomes `user photo.png` — the path is gone, but you are still keeping a client-chosen name.

## PHP primitives: confirm the upload, then move it

`is_uploaded_file()` returns `true` only if the path was uploaded via HTTP POST. The PHP manual says this helps stop a script being tricked into working on a file it should not touch, and that you must pass the temporary path (`$_FILES['userfile']['tmp_name']`), not the original client name.

`move_uploaded_file($from, $to)` does that same upload check, then moves the file to `$to`. If `$from` is not a valid HTTP POST upload, it does nothing and returns `false`. Use it instead of a plain `rename()` or `copy()` on `$_FILES` data.

A defensive plain-PHP outline:

```php
$tmp = $_FILES['photo']['tmp_name'] ?? '';

if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
    // reject: not a successful HTTP POST upload
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $tmp);
finfo_close($finfo);

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

if (!isset($allowed[$mime])) {
    // reject: contents are not an allowed type
}

$name = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
$destination = '/path/outside/the/document-root/' . $name;

move_uploaded_file($tmp, $destination);
```

Pick a real directory that lives outside the document root. OWASP lists that as the fallback when you cannot store uploads on a separate host.

## Detect the type from contents, not the header

`finfo_file()` returns information about a file. Open the database with `FILEINFO_MIME_TYPE` and it reports a MIME type from the contents — the PHP manual's example prints values such as `text/html` and `image/gif`. `mime_content_type()` does a similar job using the `magic.mime` file and, in the manual's example, reports `image/gif` for a GIF and `text/plain` for a `.php` source file.

A client can still send `Content-Type: image/png` with a file named `avatar.png`. That header is not a detection result.

## Laravel: validate, then `store()`

Laravel's `file` rule requires a successfully uploaded file. `image` requires an image of type jpg, jpeg, png, bmp, gif, webp, avif, heic or heif; SVG is rejected by default because of XSS risk (`image:allow_svg`, or `File::image(allowSvg: true)`, if you deliberately allow it). `max` uses the same sizing rules as `size`: for files, the value is in kilobytes.

`mimes:jpg,bmp,png` looks like an extension list, but Laravel reads the file contents and guesses the MIME type. `mimetypes:video/avi,video/mpeg,video/quicktime` (or `image/*`) does the same and may disagree with the client's provided MIME type. `extensions:jpg,png` checks only the *user-assigned* extension — the docs say you should never rely on that alone, and should typically combine it with `mimes` or `mimetypes`. `mimes:png` will accept PNG content even if the client named the file `photo.txt`.

There is also a fluent builder:

```php
use Illuminate\Validation\Rules\File;

$validated = $request->validate([
    'photo' => [
        'required',
        File::image()->max('2mb'),
    ],
    'cv' => [
        'required',
        File::types(['pdf'])->max('5mb'),
    ],
]);
```

`File::types()` also guesses the MIME type from contents. The string form is equivalent in spirit:

```php
$request->validate([
    'photo' => [
        'required',
        'file',
        'image',
        'mimes:jpg,jpeg,png,webp',
        'extensions:jpg,jpeg,png,webp',
        'max:2048', // kilobytes for files
    ],
]);
```

Then store it. `store()` takes a directory, not a filename: Laravel generates a unique ID, picks the extension from the MIME type, and returns the path so you can save it in the database. `store($directory, $disk)` selects a disk. `hashName()` is the explicit random name if you need it yourself.

```php
// Safe: generated name, extension from MIME type, default disk
$path = $request->file('photo')->store('photos');

// Same idea via the Storage facade
$path = Storage::putFile('photos', $request->file('photo'));

$file = $request->file('photo');
$name = $file->hashName();
$extension = $file->extension();
```

If you must call `storeAs` / `putFileAs`, pass a name your code generated — not `$file->getClientOriginalName()`.

## The public disk pitfall

Laravel's `public` disk is meant for files that should be web-accessible. By default it stores them in `storage/app/public`. `php artisan storage:link` creates a symbolic link from `public/storage` to `storage/app/public`. After that, `asset('storage/file.txt')` (or `Storage::url(...)`, which on the local driver typically prepends `/storage`) is a public URL.

The `local` disk, by contrast, defaults to `storage/app/private`. Private user files — identity documents, invoices, anything that is not supposed to be world-readable — belong on a non-public disk. Serve them through your application after you have checked authorization:

```php
return Storage::disk('local')->download($path, $downloadName);
```

`download()` builds a response that forces a browser download. The optional second argument is the filename the user sees, so you can show the original name without storing the file under it.

## Never execute an uploaded file

Do not put uploads in a directory the web server will run as PHP, and do not execute them yourself. OWASP recommends storing files outside the web root (and disabling per-directory config overrides on any upload directory, so an uploaded server config file cannot remapped how that folder runs). Laravel's validation docs add that passing `image` / `mimes` checks does not stop a file being executed as PHP if you then store it with a `.php` extension — always use a system-generated filename such as `hashName()`, and configure the web server to deny PHP execution inside storage directories.

## A runnable plain-PHP demo

This does not perform an HTTP upload. It shows why a `.png` name and a claimed `image/png` type are not proof, and what `is_uploaded_file()` does with an ordinary local file. We ran it on PHP 8.4.23:

```php
<?php
$dir = sys_get_temp_dir() . '/upload-demo-' . bin2hex(random_bytes(4));
mkdir($dir);

$pngPath = $dir . '/real.png';
$im = imagecreatetruecolor(1, 1);
imagefilledrectangle($im, 0, 0, 1, 1, imagecolorallocate($im, 4, 120, 87));
imagepng($im, $pngPath);
imagedestroy($im);

$textNamedPng = $dir . '/avatar.png';
file_put_contents($textNamedPng, "just some notes\n");

$clientClaimedType = 'image/png';
$finfo = new finfo(FILEINFO_MIME_TYPE);

echo "png bytes via finfo: " . finfo_file($finfo, $pngPath) . PHP_EOL;
echo "text named .png via finfo: " . finfo_file($finfo, $textNamedPng) . PHP_EOL;
echo "png bytes via mime_content_type: " . mime_content_type($pngPath) . PHP_EOL;
echo "text named .png via mime_content_type: " . mime_content_type($textNamedPng) . PHP_EOL;
echo "client claim matches text file: " . ($clientClaimedType === finfo_file($finfo, $textNamedPng) ? 'yes' : 'no') . PHP_EOL;

$clientName = '../../public/uploads/user photo.png';
echo "basename of client name: " . basename($clientName) . PHP_EOL;
echo "generated stored name length: " . strlen(bin2hex(random_bytes(16))) . PHP_EOL;
echo "is_uploaded_file on local png: " . (is_uploaded_file($pngPath) ? 'true' : 'false') . PHP_EOL;
echo "file size of png bytes: " . filesize($pngPath) . PHP_EOL;
```

Output from that run:

```
png bytes via finfo: image/png
text named .png via finfo: text/plain
png bytes via mime_content_type: image/png
text named .png via mime_content_type: text/plain
client claim matches text file: no
basename of client name: user photo.png
generated stored name length: 32
is_uploaded_file on local png: false
file size of png bytes: 90
```

The 1×1 PNG was detected as `image/png` (90 bytes). The text file named `avatar.png` was `text/plain`, so the claimed `image/png` type did not match. `basename()` kept `user photo.png`. `is_uploaded_file()` returned `false` because this file never arrived through PHP's HTTP POST upload mechanism — which is the check `move_uploaded_file()` also performs.

## Quick audit checklist

- Search for `getClientOriginalName`, `getClientOriginalExtension` and `storeAs` / `putFileAs` that take request data as the filename.
- Require `file` (or `File::image()` / `File::types(...)`), pair `extensions` with `mimes` or `mimetypes`, and set a `max` size.
- Confirm private files use a non-public disk (the `local` disk's default root is `storage/app/private`) and are served with `Storage::download` (or an equivalent authorized response), not a public URL.
- Keep the `public` disk and `php artisan storage:link` for files that are *supposed* to be world-readable.
- Store uploads outside the document root in plain PHP, and do not let the web server execute PHP in upload or storage directories.
- Restrict uploads to authorized users and keep libraries that parse files up to date (OWASP).

Want a review of upload handling, storage layout or validation across a Laravel or PHP app? See [PHP Hub services](/services) (contact for quote) or run a quick pass with the [PHP Security Checker](https://php-security-checker.vercel.app).

For a related real-world case, see the brief on [unauthenticated arbitrary file upload leading to remote code execution in the WordPress Bricksforge plugin](/briefs/2026-10-24-bricksforge-file-upload-rce) (CVE-2026-85097). The brief's Patchstack source reports it as actively exploited.

## Sources

- [Laravel docs: File Storage](https://laravel.com/docs/filesystem) (current docs, also at the 13.x URL) — local disk root `storage/app/private`, public disk and `storage:link`, `store` / `storeAs` / `putFile` / `putFileAs`, `hashName` / `extension`, unsafe client name methods, `Storage::download`
- [Laravel docs: Validation](https://laravel.com/docs/validation) — `file`, `image`, `mimes`, `mimetypes`, `extensions`, `max` / `size` (files in kilobytes), Validating Files (`File::types`, `File::image`)
- [PHP manual: move_uploaded_file](https://www.php.net/manual/en/function.move-uploaded-file.php)
- [PHP manual: is_uploaded_file](https://www.php.net/manual/en/function.is-uploaded-file.php)
- [PHP manual: finfo_file](https://www.php.net/manual/en/function.finfo-file.php)
- [PHP manual: mime_content_type](https://www.php.net/manual/en/function.mime-content-type.php)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
