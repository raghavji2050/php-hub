---
categories: [PHP, Laravel, Security]
title: "Command Injection in PHP and Laravel: Pass Arrays, Not Shell Strings"
date: 2026-11-27
description: "Building a shell command with user input lets an attacker add ; rm -rf or $(curl ...). Prefer a PHP library over a shell call, pass commands as arrays to Laravel's Process facade, Symfony Process or proc_open, validate the value, and use escapeshellarg only when a string is unavoidable."
summary: "If user input ends up inside a shell string, the shell will run whatever the attacker adds. First ask if you need a shell at all. If you do, pass the command as an array (Laravel Process::run([...]), new Symfony Process([...]), proc_open([...]) on PHP 7.4+) so no shell parses it, validate the value with a strict rule, set a timeout, and keep escapeshellarg() for the rare string-only case. Never use escapeshellcmd() to make a single value safe."
tags: ["php", "laravel", "security", "command-injection", "symfony"]
hero: "posts/php-command-injection-hero.webp"
heroAlt: "Worn brass padlock resting on a coiled black cable beside a dark compact keyboard on a dark slate surface"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual, the Laravel 13.x Processes docs and framework source, the Symfony Process docs and the OWASP OS Command Injection Defense Cheat Sheet.*

Quick answer: never glue user input into a command string. When you hand a string to `exec()`, `shell_exec()`, `system()`, backticks or `Process::run('...')`, a shell parses it, and characters like `;`, `|`, `&&` and `$( )` start new commands. Pass the command as an **array** of arguments instead, so the program runs directly with no shell in between.

## The bug: a "harmless" ping tool

```php
// GET /tools/ping?host=8.8.8.8;cat%20.env
Route::get('/tools/ping', function (Request $request) {
    $host = $request->query('host');
    return shell_exec("ping -c 1 $host");   // shell runs "cat .env" too
});
```

The same thing happens with `Process::run("ping -c 1 {$host}")`. Laravel's Process facade wraps the Symfony Process component, and a **string** command goes through `Process::fromShellCommandline()`, which means a shell.

## Fix 0: do you need a shell at all?

OWASP's first defense is to avoid calling OS commands. Resizing an image? Use GD, Imagick or Intervention Image. Zipping files? Use `ZipArchive`. Checking DNS? Use `dns_get_record()`. A PHP function can't be tricked into running a second program.

## Fix 1: pass an array in Laravel

`Process::run()` accepts `array|string`. In the 13.x framework source, an iterable command is turned into `new Symfony\Component\Process\Process($command)`, and only a string goes to `fromShellCommandline()`.

```php
use Illuminate\Support\Facades\Process;

$host = $request->validate([
    'host' => ['required', 'ip'],        // strict allow-list, not a blocklist
])['host'];

$result = Process::timeout(10)->run(['ping', '-c', '1', $host]);

return $result->successful()
    ? $result->output()
    : response('Ping failed', 422);
```

Each array item reaches `ping` as one argument, so `8.8.8.8;cat .env` would be a single (invalid) host name, not two commands. Laravel's default timeout is 60 seconds; set a shorter one for anything a user can trigger.

## Fix 2: the same in plain PHP and Symfony

```php
// Symfony Process: the array form is the recommended way
use Symfony\Component\Process\Process;

$process = new Process(['ping', '-c', '1', $host]);
$process->setTimeout(10);
$process->run();
```

```php
// Plain PHP 7.4+: proc_open() with an array skips the shell
$proc = proc_open(['ping', '-c', '1', $host], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
$out  = stream_get_contents($pipes[1]);
proc_close($proc);
```

The PHP manual says that since PHP 7.4.0 an array command "will be opened directly (without going through a shell) and PHP will take care of any necessary argument escaping."

## Fix 3: escapeshellarg() when you must use a string

Some old code or hosting setups only give you `exec()`. Then escape **every** user value on its own:

```php
exec('ping -c 1 ' . escapeshellarg($host), $lines, $code);
```

`escapeshellarg()` wraps the value in single quotes and escapes any quotes inside, so it stays one argument. Don't reach for `escapeshellcmd()` here: the manual warns it is meant for a whole command string and "still allows the attacker to pass arbitrary number of arguments."

## Watch for argument injection

An array stops new commands, but a value that starts with `-` can still be read as an option by the program you call (OWASP calls this argument injection). Validate the value with a strict rule (like `ip`, a regex or an `in:` list), and for commands that support it, put `--` before user values to end option parsing.

## Checklist

- [ ] No user input concatenated into `exec`, `shell_exec`, `system`, `passthru`, backticks or string `Process::run()`
- [ ] A PHP library used instead of a shell call where one exists
- [ ] Commands passed as arrays (Laravel Process, Symfony Process, `proc_open` on PHP 7.4+)
- [ ] Every user value validated with an allow-list rule
- [ ] `--` before user values when the program supports it
- [ ] `escapeshellarg()` on each value if a string command is unavoidable; never `escapeshellcmd()` for that
- [ ] Short timeout on user-triggered processes
- [ ] A feature test that sends `;id` or `$(id)` and expects a 422, not output

**How it's asked in interviews:** "How would you safely run a system command with user input in PHP?" Mention avoiding the shell, array arguments, allow-list validation, argument injection and why `escapeshellcmd()` is not enough.

**Where it applies in real work:** PDF and image conversion, backups with `mysqldump`, git or deploy hooks in admin panels, and WordPress plugins that call `exec()`. These are common things to check in a security audit.

## Sources

- PHP manual: [proc_open()](https://www.php.net/manual/en/function.proc-open.php), [escapeshellarg()](https://www.php.net/manual/en/function.escapeshellarg.php), [escapeshellcmd()](https://www.php.net/manual/en/function.escapeshellcmd.php)
- Laravel 13.x: [Processes](https://laravel.com/docs/13.x/processes) and [PendingProcess source](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Process/PendingProcess.php)
- Symfony: [The Process Component](https://symfony.com/doc/current/components/process.html)
- OWASP: [OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
