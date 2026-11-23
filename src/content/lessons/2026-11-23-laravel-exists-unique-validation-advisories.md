---
categories: [PHP, Laravel, Security]
title: "Laravel exists and unique Rules: Two Advisories and How to Validate Safely"
date: 2026-11-23
description: "Two Laravel advisories from 18 Nov 2026 affect exists and unique validation rules. What they are, who is affected, how to upgrade, and safe validation patterns."
summary: "Laravel published two moderate advisories for laravel/framework on 18 Nov 2026: Rule::exists()/Rule::unique() fluent where() values can be read as predicates, and exists can be bypassed by integer or boolean JSON input on MySQL/MariaDB. Upgrade to 12.73.0 or 13.43.0, add string rules before exists/unique, and keep independent ownership checks."
tags: ["php", "laravel", "security", "validation", "advisory"]
hero: "posts/laravel-exists-unique-validation-hero.webp"
heroAlt: "Abstract illustration of two database cylinders connected through a gate with a green check mark"
---

*This lesson was drafted with AI assistance and checked against the two GitHub advisories linked in Sources on 23 Nov 2026. Neither advisory lists a CVE id, so none is stated here.*

Quick answer: if you run `laravel/framework` below **12.73.0** (12.x) or **13.43.0** (13.x), upgrade. Both advisories are rated Moderate. Until then, validate types before `exists`/`unique`, and never rely on a validation rule alone to prove a user owns a record.

## Advisory 1: fluent where() values read as predicates

[GHSA-ch34-gjmh-c4hp](https://github.com/laravel/framework/security/advisories/GHSA-ch34-gjmh-c4hp), Moderate, CVSS 4.8.

When `Rule::exists()` or `Rule::unique()` is scoped with the fluent `where()` method, the condition is turned into the string rule format and parsed again. A scalar value of `NULL`, `NOT_NULL`, or one starting with `!` could be evaluated as an `IS NULL`, `IS NOT NULL`, or not-equal predicate instead of a literal comparison.

The risk appears when an attacker can influence a scope value, such as a tenant key, and your app relies on the rule to verify ownership. Then validation can accept records from other scopes; for `unique`, the scope can be widened.

```php
// Risky pattern: scope value comes from the request
'project_id' => [
    'required',
    Rule::exists('projects', 'id')->where('team_id', $request->input('team_id')),
],
```

Per the advisory, apps with independent authorization checks, or closure-based `where()` conditions, are not affected in the same way.

## Advisory 2: exists bypass with integer or boolean JSON input (MySQL/MariaDB)

[GHSA-wwq3-m3j5-wv66](https://github.com/laravel/framework/security/advisories/GHSA-wwq3-m3j5-wv66), Moderate, CVSS 5.3.

The `exists` and `unique` rules passed integer and boolean request values unchanged to the query. On MySQL and MariaDB, comparing a string column with an integer casts the column to a number. So JSON input like `0`, `false` or `[0]` could satisfy a rule such as `required|exists:invites,code` on a non-numeric string column without a valid value. An unauthenticated attacker who can submit JSON could bypass "must reference an existing record" checks.

PostgreSQL and SQLite are not affected, and form-encoded input is always a string, so it is not affected.

## Who is affected, and the fix

Both advisories list affected versions `<12.73.0` and `<13.43.0`, patched in `>=12.73.0` and `>=13.43.0`:

```bash
composer show laravel/framework | grep versions
composer update laravel/framework
```

For advisory 1, the advisory describes the fix as making the validator read conditions from the rule object so `where()` values are compared literally. For advisory 2, `DatabasePresenceVerifier` now compares integers and booleans as strings.

## Safe patterns you can use today

The advisories' own workarounds, in code:

```php
// 1. Type-check before exists/unique
'code' => ['required', 'string', 'exists:invites,code'],

// 2. Or cast in prepareForValidation()
protected function prepareForValidation(): void
{
    if (is_scalar($this->code)) {
        $this->merge(['code' => (string) $this->code]);
    }
}

// 3. Don't pass user-influenced values to scalar where(); use a closure
Rule::exists('projects', 'id')->where(fn ($q) => $q->where('team_id', $this->user()->team_id));

// 4. Always authorize the record itself
$project = Project::findOrFail($request->validated('project_id'));
$this->authorize('update', $project);
```

The last line is the real lesson: `exists` answers "is there a row?", not "may this user touch it?".

## Interview angle and real work

Interviewers ask: "Is `exists:` enough to stop IDOR?" The answer is no; use policies or scoped queries. In real projects, grep your FormRequests for `Rule::exists`/`Rule::unique` with `where(` on request values, and for JSON APIs that accept ids or codes without a `string`/`integer` rule.

## Sources

- [GHSA-ch34-gjmh-c4hp: Fluent Rule::exists() and Rule::unique() where() values](https://github.com/laravel/framework/security/advisories/GHSA-ch34-gjmh-c4hp)
- [GHSA-wwq3-m3j5-wv66: Validation exists rule bypass with integer or boolean input](https://github.com/laravel/framework/security/advisories/GHSA-wwq3-m3j5-wv66)
