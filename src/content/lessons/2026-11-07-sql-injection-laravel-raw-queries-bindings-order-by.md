---
categories: [PHP, Laravel, Security]
title: "SQL Injection in Laravel: Raw Queries, Bindings and Safe ORDER BY"
date: 2026-11-07
description: "Where SQL injection still sneaks into Laravel apps: string-built DB::select and whereRaw calls, user-chosen column names and ORDER BY. Use ? or named bindings for values and an allow-list for columns."
summary: "Bind every value (?, named bindings, or the query builder), never interpolate request data into raw SQL, and allow-list column names and sort directions because PDO cannot bind them."
tags: ["php", "laravel", "security", "sql-injection", "database"]
level: intermediate
hero: "posts/laravel-sql-injection-hero.webp"
heroAlt: "Abstract emerald database cylinder on a dark background; green query blocks slot into marked sockets while a red jagged block is rejected at the gate"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the official Laravel database and query builder documentation, the PHP PDO manual, and the OWASP SQL Injection Prevention Cheat Sheet linked below.*

Quick answer: Laravel's query builder and Eloquent already bind your values through PDO, so `where('email', $request->email)` is safe. Injection comes back when you build SQL strings yourself: `DB::select("... '$input'")`, `whereRaw("... $input")`, `orderByRaw($request->sort)`, or letting the request choose a column name. Pass values as bindings, and pick columns and sort directions from a fixed allow-list in your code.

## What the framework protects (and what it doesn't)

The Laravel query builder docs say it "uses PDO parameter binding to protect your application against SQL injection attacks", so there is no need to clean strings you pass to it as bindings. The same page adds a warning that matters for real apps: **PDO does not support binding column names**, so you should never let user input decide which columns a query references, including "order by" columns.

For raw expressions the docs are blunt: raw statements are injected into the query as strings, and Laravel cannot guarantee that a query using raw expressions is protected against SQL injection.

So the safe zone is "values through bindings". Everything structural (table names, column names, `ASC`/`DESC`, SQL keywords) is your job.

## The classic mistake: interpolating into raw SQL

```php
// Unsafe: request data becomes part of the SQL text
$users = DB::select("SELECT * FROM users WHERE email = '{$request->email}'");
```

An input like `x' OR '1'='1` turns the `WHERE` clause into something that is always true. We ran the plain-PDO version of this against an in-memory SQLite table with two users: the concatenated query returned both rows, while the bound version returned none.

## Fix 1: use bindings in `DB::select` and friends

The first argument is the SQL, the second is the bindings. Laravel's database docs note that parameter binding provides protection against SQL injection:

```php
$users = DB::select('SELECT * FROM users WHERE email = ?', [$request->input('email')]);

// Named bindings work too
$users = DB::select('SELECT * FROM users WHERE id = :id', ['id' => $id]);
```

The same applies to `DB::insert`, `DB::update` and `DB::delete`.

## Fix 2: raw query builder methods take a bindings array

`selectRaw`, `whereRaw` / `orWhereRaw`, `havingRaw` and `orderByRaw` all accept bindings as a second argument. Put placeholders in the string and the values in the array:

```php
// Unsafe
$orders = DB::table('orders')
    ->whereRaw("price > IF(state = 'TX', {$request->min}, 100)")
    ->get();

// Safe
$orders = DB::table('orders')
    ->whereRaw("price > IF(state = 'TX', ?, 100)", [$request->input('min')])
    ->get();
```

Better still, ask whether you need raw SQL at all. `where`, `whereIn`, `whereBetween`, `whereDate` and the other builder methods bind for you.

## Fix 3: allow-list columns and sort direction

Sortable tables are where many Laravel apps slip, because a column name can't be a binding:

```php
// Unsafe: the request controls SQL structure
$posts = Post::orderByRaw($request->input('sort'))->get();
```

Map the user's choice to columns you own instead:

```php
$sortable = ['title', 'created_at', 'views'];

$column = in_array($request->input('sort'), $sortable, true)
    ? $request->input('sort')
    : 'created_at';

$direction = $request->input('dir') === 'asc' ? 'asc' : 'desc';

$posts = Post::orderBy($column, $direction)->paginate(20);
```

In current Laravel, `orderBy()` itself throws an `InvalidArgumentException` if the direction isn't `asc` or `desc`, which is a helpful backstop, but the column still needs your allow-list. You can enforce the same thing in validation with `Rule::in($sortable)` so bad values get a clean 422 instead of a silent fallback.

OWASP's cheat sheet gives the same advice in general terms: parameter markers represent data values, not table names, column names or keywords such as `ASC` and `DESC`, so map user selections to a small set of application-owned tokens and reject everything else.

## A runnable plain-PHP demo

You can see the difference without a Laravel app. This uses PDO with in-memory SQLite (we ran it on PHP 8.4):

```php
<?php
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, is_admin INTEGER)");
$pdo->exec("INSERT INTO users (email, is_admin) VALUES ('a@example.com', 0), ('root@example.com', 1)");

$input = "x' OR '1'='1";

// Unsafe: input concatenated into SQL
$unsafe = $pdo->query("SELECT email FROM users WHERE email = '$input'")->fetchAll(PDO::FETCH_COLUMN);
echo "unsafe rows: " . count($unsafe) . PHP_EOL;   // unsafe rows: 2

// Safe: placeholder + bound value
$stmt = $pdo->prepare('SELECT email FROM users WHERE email = ?');
$stmt->execute([$input]);
echo "bound rows: " . count($stmt->fetchAll(PDO::FETCH_COLUMN)) . PHP_EOL;   // bound rows: 0

// Column names cannot be bound: allow-list them
$allowed = ['email', 'id'];
$sort = 'email; DROP TABLE users';
$column = in_array($sort, $allowed, true) ? $sort : 'id';
$rows = $pdo->query("SELECT email FROM users ORDER BY $column DESC")->fetchAll(PDO::FETCH_COLUMN);
echo "sorted by $column: " . implode(',', $rows) . PHP_EOL;   // sorted by id: root@example.com,a@example.com
```

## Quick audit checklist

- Search your code for `DB::raw`, `selectRaw`, `whereRaw`, `havingRaw`, `orderByRaw` and `DB::select(` / `DB::statement(`. Any `$` variable or `{$...}` inside the SQL string is a red flag.
- Check every place a request value picks a column, table or sort direction, and add an allow-list.
- Prefer builder methods over raw SQL, and bindings when raw SQL is unavoidable.
- Don't rely on escaping or "sanitizing" input as your main defence; OWASP lists prepared statements and allow-list validation ahead of escaping.

## Sources

- [Laravel docs: Query Builder (introduction, raw expressions, raw methods)](https://laravel.com/docs/queries)
- [Laravel docs: Database, running raw SQL queries and named bindings](https://laravel.com/docs/database#running-queries)
- [Laravel framework source: Query Builder `orderBy` direction check](https://github.com/laravel/framework/blob/13.x/src/Illuminate/Database/Query/Builder.php)
- [PHP manual: PDO::prepare](https://www.php.net/manual/en/pdo.prepare.php)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
