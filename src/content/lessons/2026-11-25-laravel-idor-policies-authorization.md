---
categories: [PHP, Laravel, Security]
title: "Stop IDOR in Laravel: Policies, Scoped Queries and 404s"
date: 2026-11-25
description: "Logged in is not the same as allowed. Prevent insecure direct object references (IDOR) in Laravel with policies, Gate::authorize, the can middleware, user-scoped queries and scoped route bindings."
summary: "Changing /invoices/41 to /invoices/42 should never show someone else's invoice. Look records up through the current user's relationships, write a policy per model, call Gate::authorize (or the can middleware / #[Authorize] attribute) on every action, use scopeBindings for nested routes, consider denyAsNotFound, and test with two users. UUIDs help, but they are not access control."
tags: ["php", "laravel", "security", "authorization", "idor"]
hero: "posts/laravel-idor-policies-hero.webp"
heroAlt: "Row of old wooden mailboxes on a weathered wall, each with its own small brass lock, one key in a lock, in warm morning light"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the Laravel 13.x authorization and routing docs and the OWASP IDOR Prevention and Authorization cheat sheets.*

Quick answer: authentication tells you *who* the user is; authorization decides *what* they may touch. An insecure direct object reference (IDOR) happens when your app takes an ID from the URL or request body and loads that record without checking it belongs to the current user. OWASP lists broken access control as A01 in its 2021 Top 10. In Laravel the fix is a policy plus a check on every action.

## The bug in one route

```php
// Any logged-in user can read any invoice by changing the number.
Route::get('/invoices/{invoice}', function (Invoice $invoice) {
    return view('invoices.show', ['invoice' => $invoice]);
})->middleware('auth');
```

The `auth` middleware only proves the user is logged in. Route model binding happily loads invoice `42` for user A even if it belongs to user B.

## Fix 1: look records up through the user

OWASP's IDOR cheat sheet recommends searching only the records the user has access to. In Eloquent that means going through the relationship:

```php
// Vulnerable: searches every invoice
$invoice = Invoice::findOrFail($id);

// Safer: searches only this user's invoices (404 for anyone else's)
$invoice = $request->user()->invoices()->findOrFail($id);
```

The same applies to lists, exports and bulk actions: `$request->user()->invoices()->...`, never `Invoice::whereIn('id', $request->ids)`.

## Fix 2: a policy for each model

Generate one with Artisan. With `--model` it includes stub methods for viewing, creating, updating and deleting:

```bash
php artisan make:policy InvoicePolicy --model=Invoice
```

```php
namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function view(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id;
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id;
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id;
    }
}
```

Laravel discovers policies automatically when the model and policy follow its naming conventions (for example `App\Models\Invoice` and `App\Policies\InvoicePolicy`).

## Fix 3: actually call it, on every action

A policy does nothing until you check it. Pick one style and use it everywhere.

In a controller, with the `Gate` facade (a denial becomes a 403 automatically):

```php
use Illuminate\Support\Facades\Gate;

public function update(Request $request, Invoice $invoice)
{
    Gate::authorize('update', $invoice);

    // ...validate and save
}
```

On the route, with the `can` middleware:

```php
Route::put('/invoices/{invoice}', [InvoiceController::class, 'update'])
    ->can('update', 'invoice');
```

Or, if you use controller middleware attributes, with `#[Authorize]`:

```php
use Illuminate\Routing\Attributes\Controllers\Authorize;

#[Authorize('update', 'invoice')]
public function update(Request $request, Invoice $invoice) { /* ... */ }
```

In Blade, `@can('update', $invoice)` only hides the button. It is not protection. The server-side check above is what stops the request.

## Nested routes: use scopeBindings

For `/users/{user}/posts/{post}`, plain `{post}` binding does not check that the post belongs to that user. Laravel scopes nested bindings automatically only when you use a custom key such as `{post:slug}`; otherwise ask for it with `scopeBindings()`:

```php
Route::get('/users/{user}/posts/{post}', function (User $user, Post $post) {
    return $post;
})->scopeBindings();
```

With scoped bindings, Laravel resolves `{post}` through the parent's relationship, so a post from another user returns 404. You still need a policy check to decide whether the *current* user may see `{user}`'s posts at all.

## 403 or 404?

A 403 tells an attacker the record exists. If you'd rather hide that, return a 404 from the policy:

```php
use Illuminate\Auth\Access\Response;

public function view(User $user, Invoice $invoice): Response
{
    return $user->id === $invoice->user_id
        ? Response::allow()
        : Response::denyAsNotFound();
}
```

## UUIDs are a bonus, not the fix

Random IDs (Eloquent's `HasUuids` or `HasUlids` traits) make guessing harder. OWASP calls them defense in depth only: IDs leak through logs, emails and shared links, so the access check must still be there.

## Test it with two users

OWASP's testing advice is simple: create User A and User B, give each their own records, log in as A and try B's IDs on every read, update, delete and export route. A Laravel feature test makes it permanent:

```php
public function test_user_cannot_view_someone_elses_invoice(): void
{
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $invoice = Invoice::factory()->for($owner)->create();

    $this->actingAs($other)
        ->get("/invoices/{$invoice->id}")
        ->assertNotFound(); // or assertForbidden() if you return 403
}
```

## Quick checklist

- Every route that takes a record ID has a policy check (`Gate::authorize`, `can` middleware or `#[Authorize]`).
- Queries for lists, exports and bulk actions go through `$request->user()->relation()`.
- Nested routes use `scopeBindings()`.
- Blade `@can` is for UI only.
- Two-user feature tests for read, update, delete and export.
- UUIDs/ULIDs as extra protection, never instead of checks.

Related lessons: [Laravel Mass Assignment](/lessons/2026-11-04-laravel-mass-assignment-fillable-guarded-validated/) and [Signed URLs in Laravel](/lessons/2026-11-17-laravel-signed-urls-temporary-signature/).

## Sources

- [Laravel 13.x docs: Authorization](https://laravel.com/docs/13.x/authorization)
- [Laravel 13.x docs: Routing (scoped implicit model binding)](https://laravel.com/docs/13.x/routing)
- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Top 10 (2021): A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
