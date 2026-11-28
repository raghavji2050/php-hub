---
categories: [PHP, Laravel, Security]
title: "XXE in PHP: Parse Untrusted XML Safely with DOMDocument and SimpleXML"
date: 2026-11-28
description: "An XML upload or SOAP/XML API body can declare an external entity that reads files like .env from your server. On PHP 8 with libxml 2.9+ that is off by default, until someone adds LIBXML_NOENT or DTD flags. Learn which flags are dangerous, how LIBXML_NO_XXE and libxml_set_external_entity_loader() help, and why libxml_disable_entity_loader() is deprecated."
summary: "XXE (XML External Entity) lets an attacker's XML pull in a local file or URL. On PHP 8 with libxml 2.9.0+, DOMDocument and SimpleXML don't substitute entities by default, so plain loadXML() is safe. The risk comes back when code passes LIBXML_NOENT, LIBXML_DTDLOAD or LIBXML_DTDVALID for untrusted input. Don't use those flags on user XML, add LIBXML_NO_XXE (PHP 8.4+, libxml 2.13+) if you must, or set libxml_set_external_entity_loader() to block external loads. Drop old libxml_disable_entity_loader() calls: it is deprecated since PHP 8.0."
tags: ["php", "laravel", "security", "xxe", "xml"]
hero: "posts/php-xxe-libxml-hero.webp"
heroAlt: "Sealed paper envelope with a dark red wax seal and a small brass key on a dark slate desk with a faint amber circuit pattern"
---

*This lesson was drafted with AI assistance and reviewed for accuracy against the PHP manual (libxml functions and constants) and the OWASP XML External Entity Prevention Cheat Sheet. The snippets were run on PHP 8.4 with libxml 2.15.*

Quick answer: on PHP 8, `DOMDocument::loadXML()` and `simplexml_load_string()` with **default options** do not expand external entities. XXE comes back when someone adds `LIBXML_NOENT`, `LIBXML_DTDLOAD` or `LIBXML_DTDVALID` to "make entities work". Keep those flags away from untrusted XML.

## The attack: an XML body that reads your .env

Any endpoint that parses XML from outside is a target: invoice or feed imports, SOAP-style APIs, SVG or DOCX processing, payment or SMS callbacks that send XML.

```xml
<?xml version="1.0"?>
<!DOCTYPE r [
  <!ENTITY x SYSTEM "file:///var/www/app/.env">
]>
<r>&x;</r>
```

If the parser substitutes `&x;`, the file contents end up in the parsed document, and often in an error message or response that echoes the value back.

## The risky line

```php
// Laravel controller receiving an XML body
$dom = new DOMDocument();
$dom->loadXML($request->getContent(), LIBXML_NOENT); // substitutes entities -> reads the file
```

In our test on PHP 8.4, the same payload gave an **empty** value with `loadXML($xml)` and the **file contents** with `loadXML($xml, LIBXML_NOENT)`. The PHP manual's constants page carries the warning: "Enabling entity substitution may facilitate XML External Entity (XXE) attacks." It gives the same kind of caution for `LIBXML_DTDLOAD` and `LIBXML_DTDVALID`.

## Fix 1: use default flags for untrusted XML

```php
$dom = new DOMDocument();
$ok = $dom->loadXML($request->getContent()); // no NOENT, no DTDLOAD, no DTDVALID

$xml = simplexml_load_string($request->getContent()); // same rule for SimpleXML
```

The manual notes that as of libxml 2.9.0 entity substitution is disabled by default. Search your codebase for `LIBXML_NOENT`, `LIBXML_DTDLOAD` and `LIBXML_DTDVALID` and check whether any of them touch user input.

## Fix 2: if you really need those flags, add LIBXML_NO_XXE

Some formats need internal entities or DTD validation. On **PHP 8.4+ with libxml 2.13.0+**, add `LIBXML_NO_XXE`, which "disables XML External Entities (XXE) when performing entity substitution":

```php
$dom->loadXML($xml, LIBXML_NOENT | LIBXML_NO_XXE);
```

In our test this returned an empty value instead of the file.

## Fix 3: block external loads globally

`libxml_set_external_entity_loader()` replaces how libxml fetches external entities. The manual says it can stop XXE "even when LIBXML_NOENT has been set" and is usually preferable to `libxml_disable_entity_loader()`. Returning `null` makes every external lookup fail:

```php
// e.g. in a service provider's boot() method
libxml_set_external_entity_loader(static fn () => null);
```

Test this before rolling out: code that legitimately loads local DTDs, XSDs or WSDL files (for example `SoapClient`) will stop working, so you may need an allow-list that only returns known local files.

## Drop libxml_disable_entity_loader()

You will still see `libxml_disable_entity_loader(true)` in old tutorials. It has been **deprecated since PHP 8.0** "as external entity loading is disabled by default". On PHP 8 it only adds a deprecation notice; use the fixes above instead.

## Two related limits

- Don't pass `LIBXML_PARSEHUGE` for untrusted input. The manual says it raises built-in limits on depth, entity recursion and text size, and "should only be used with trusted data".
- If your format never needs a DOCTYPE, rejecting documents that contain one is a simple extra check (OWASP's general advice is to disable DTDs where you can).

## Checklist

- [ ] No `LIBXML_NOENT`, `LIBXML_DTDLOAD` or `LIBXML_DTDVALID` on user-supplied XML
- [ ] If those flags are needed: `LIBXML_NO_XXE` added (PHP 8.4+, libxml 2.13+)
- [ ] `libxml_set_external_entity_loader()` blocks or allow-lists external loads
- [ ] Old `libxml_disable_entity_loader()` calls removed on PHP 8
- [ ] No `LIBXML_PARSEHUGE` on untrusted data
- [ ] XML upload paths covered too: SVG, DOCX/XLSX and feed imports
- [ ] A feature test posts the `file://` payload above and asserts the file contents never appear

**How it's asked in interviews:** "What is XXE and how do you prevent it in PHP?" Explain external entities, why PHP 8 defaults are safe, which libxml flags reopen the hole, and how `LIBXML_NO_XXE` or a custom entity loader closes it.

**Where it applies in real work:** XML payment or SMS gateway callbacks, ERP or invoice imports, RSS/Atom feed readers, SVG avatar uploads and WordPress import plugins. It is a standard item in a PHP security audit.

## Sources

- PHP manual: [libxml constants](https://www.php.net/manual/en/libxml.constants.php) (LIBXML_NOENT, LIBXML_DTDLOAD, LIBXML_DTDVALID, LIBXML_NO_XXE, LIBXML_PARSEHUGE)
- PHP manual: [libxml_set_external_entity_loader()](https://www.php.net/manual/en/function.libxml-set-external-entity-loader.php)
- PHP manual: [libxml_disable_entity_loader()](https://www.php.net/manual/en/function.libxml-disable-entity-loader.php) (deprecated in 8.0)
- OWASP: [XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
