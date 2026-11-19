---
categories: [PHP, WordPress, Security]
title: "WordPress Nonces and Capability Checks: CSRF Is Not Authorization"
date: 2026-11-19
description: "Use WordPress nonces to block CSRF and current_user_can() to decide who may act. Nonces are not one-time tokens and are never access control."
summary: "WordPress nonces help prevent CSRF, but they are not one-time tokens and they are not authorization. Verify a nonce with check_admin_referer() or wp_verify_nonce(), and separately call current_user_can() in the request handler. Official documentation says you should always assume a nonce can be compromised."
tags: ["php", "wordpress", "security", "nonces", "capabilities"]
hero: "posts/wordpress-nonces-capabilities-hero.webp"
heroAlt: "Leather tray holding a brass key, an iron key, and a blank card with a maroon wax seal, lit by a warm lamp with a green glass bottle nearby"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the WordPress Developer Handbook pages on nonces and on checking user capabilities, linked below.*

Quick answer: every form, admin link and AJAX action that changes data needs two checks: a nonce, to be sure the request came from your site, and a capability check, to be sure this user is allowed to do it. A WordPress nonce is not a permission, and it is not a one-time token.

## What a WordPress nonce is — and is not

The handbook is unusually direct about the name. A nonce is described as a "number used once", but WordPress nonces are a hash of numbers and letters, and they are **not** used only once. They have a limited lifetime, and during that lifetime the same nonce is generated for a given user in a given context.

They help against CSRF: a third-party page cannot reliably make the victim's browser submit a forged "trash this post" request, because it does not have the nonce WordPress issued to that user. They do **not** protect against replay during that lifetime, because the value is not checked for one-time use.

The same page says nonces should never be relied on for authentication, authorization or access control. Protect your functions with `current_user_can()`, and always assume nonces can be compromised.

Default lifetime is documented as one day, but the "lifetime" is not a single 24-hour window. WordPress uses two ticks of half that period and accepts a nonce from the current tick or the previous one. With the default settings, the practical lifetime is therefore variable, between 12 and 24 hours. When a nonce is valid, the verification functions return the tick number, `1` or `2`.

Guests share user ID `0`, so WordPress generates the same guest nonce for that action unless you hook `nonce_user_logged_out` and supply a better identifier. Nonces are also tied to the current session: if a user logs in or out, nonces already on the page stop being valid.

## Creating and verifying a nonce

Make the action string specific. Include the object id, not just a generic `'trash-post'`:

```php
$complete_url = wp_nonce_url($bare_url, 'trash-post_'.$post->ID);

wp_nonce_field('delete-comment_'.$comment_id);

$nonce = wp_create_nonce('my-action_'.$post->ID);
```

- `wp_nonce_url()` adds a `_wpnonce` query argument (the name is configurable).
- `wp_nonce_field()` echoes a hidden `_wpnonce` field and, by default, a referrer field.
- `wp_create_nonce()` returns the token for AJAX or a custom header.

Verify with the matching function:

```php
check_admin_referer('delete-comment_'.$comment_id);

check_ajax_referer('process-comment');

if (! wp_verify_nonce($_POST['my_nonce'], 'process-comment_'.$comment_id)) {
    wp_nonce_ays();
}
```

`check_admin_referer()` checks the nonce and the referrer, and on failure it terminates with a 403. `check_ajax_referer()` verifies the nonce and, by default, stops the request when verification fails. For any other context, `wp_verify_nonce()` returns a tick number or false; if it is false, stop and call `wp_nonce_ays()` or return a 403 yourself.

Nonce values are generated using `NONCE_KEY` and `NONCE_SALT` from `wp-config.php`. Those salts belong in the same secret-handling habits as Laravel's `APP_KEY`.

## Capability checks belong in the handler

`current_user_can('edit_others_posts')` (or a more specific capability such as `delete_post` for a given post id) is the authorization check. Roles are just groups of capabilities: on a single site an Administrator inherits the capabilities of Editor, Author, Contributor and Subscriber. Check the capability, not a role name, and not `is_admin()` — `is_admin()` only tells you that the request is in the admin area.

Run the check in the request handler, not only when you render a link. Hiding a button is not enforcement. The official "Checking User Capabilities" handbook example shows why an action without a capability check is unsafe: a public "Delete" link would let any visitor trash a post. Pair that lesson with a nonce: even an authenticated editor should not be tricked into the request from another site.

A complete handler looks like this:

```php
add_action('admin_post_wporg_delete', function () {
    if (! current_user_can('delete_post', (int) $_POST['post'])) {
        wp_die(__('Sorry, you are not allowed to do that.'), 403);
    }
    check_admin_referer('trash-post_'.(int) $_POST['post']);
    wp_trash_post((int) $_POST['post']);
    wp_safe_redirect(admin_url('edit.php'));
    exit;
});
```

Use `wp_safe_redirect()` rather than a raw `Location` header when you send the user on.

## Quick audit checklist

- Every state-changing admin URL, form and AJAX action has a nonce whose action string includes the object id.
- The handler calls `current_user_can()` *and* a nonce verifier. Neither check is optional.
- Capability names match the action (`delete_post`, `edit_others_posts`, `manage_options`), not a role slug.
- Guest-facing forms do not rely on the default shared user-ID `0` nonce for anything sensitive.
- `NONCE_KEY` and `NONCE_SALT` are unique to the site and not committed to a public repository.

Related lesson (CSRF in Laravel): [Laravel CSRF Protection: Tokens, Exceptions and SPA Pitfalls](/lessons/2026-11-05-laravel-csrf-protection-tokens-exceptions-spa/).

## Sources

- [WordPress Developer Handbook: Nonces](https://developer.wordpress.org/apis/security/nonces/)
- [WordPress Developer Handbook: Checking User Capabilities](https://developer.wordpress.org/plugins/security/checking-user-capabilities/)
- [WordPress Developer Resources: current_user_can](https://developer.wordpress.org/reference/functions/current_user_can/)
- [WordPress Developer Resources: wp_safe_redirect](https://developer.wordpress.org/reference/functions/wp_safe_redirect/)
