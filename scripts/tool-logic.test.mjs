import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeComposer, buildCurl, checkCookies, checkPhpVersion, cookieKind, parseSetCookie, parseSetCookieInput, decodeBase64, decodeJwt, describeCron,
  digestHex, encodeBase64, formatJson, formatPhp, formatSql, JWT_EXAMPLE, maskPhp,
  nextCronRuns, testRegex, transformUrl, validatePhp,
} from '../src/lib/tool-logic.js';

const source = readFileSync(new URL('../src/lib/tool-logic.js', import.meta.url), 'utf8');

test('tool logic does not execute user code', () => {
  const codeOnly = source
    .replace(/`(?:\\`|[^`])*`/gs, '``')
    .replace(/'(?:\\'|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""');
  assert.doesNotMatch(codeOnly, /\beval\s*\(/);
  assert.doesNotMatch(codeOnly, /new Function/);
  assert.doesNotMatch(codeOnly, /child_process/);
  assert.doesNotMatch(codeOnly, /fetch\s*\(/);
});

test('PHP formatter reindents a function and ignores braces in strings', () => {
  const result = formatPhp('<?php\nfunction add($a, $b) {\nreturn $a + $b;\n}\n');
  assert.equal(result.ok, true);
  assert.match(result.output, /function add\(\$a, \$b\) \{\n {4}return \$a \+ \$b;\n\}/);
  const literal = formatPhp("<?php\n$s = '{ not code';\n$n = 1;\n");
  assert.equal(literal.ok, true);
  assert.match(literal.output, /^\$n = 1;$/m);
  assert.doesNotMatch(literal.output, /^ {4}\$n/m);
});

test('PHP mask hides code-like text inside strings and comments', () => {
  const { masked } = maskPhp("<?php\n$s = 'str_contains($a, $b)';\n// str_contains($a, $b)\nstr_contains($a, $b);\n");
  assert.equal((masked.match(/str_contains/g) || []).length, 1);
});

test('PHP validator reports unclosed braces and does not claim a real parse', () => {
  const bad = validatePhp('<?php\nfunction add() {\n');
  assert.equal(bad.passed, false);
  assert.ok(bad.issues.some((issue) => issue.level === 'error'));
  assert.match(bad.summary, /not a PHP parse/);
  const good = validatePhp('<?php\nfunction add($a) {\n  return $a;\n}\n');
  assert.equal(good.passed, true);
});

test('version guidance ignores strings and flags known features', () => {
  const hidden = checkPhpVersion("<?php\n$s = 'str_contains($a, $b)';\n", '8.0');
  assert.equal(hidden.findings.some((f) => f.id === 'str_contains'), false);
  const found = checkPhpVersion('<?php\nenum Role { case Admin; }\nstr_contains($a, "x");\n', '8.0');
  assert.ok(found.findings.some((f) => f.id === 'enum' && f.aboveTarget));
  assert.ok(found.findings.some((f) => f.id === 'str_contains' && !f.aboveTarget));
  const removed = checkPhpVersion('<?php\neach($a);\n', '8.2');
  assert.ok(removed.removed.some((item) => item.name === 'each()'));
  const pipe = checkPhpVersion('<?php\n$result = $a |> trim(...);\n', '8.4');
  assert.ok(pipe.findings.some((f) => f.id === 'pipe' && f.version === '8.5' && f.aboveTarget));
});

test('composer analysis stays local and redacts credentials', () => {
  const json = JSON.stringify({
    name: 'example/app',
    require: { php: '>=8.2', 'laravel/framework': '^11.0' },
    'require-dev': { 'phpunit/phpunit': '^11.0' },
    scripts: { 'post-install-cmd': 'curl https://user:ghp_exampleSecretValue@example.com/hook' },
    config: { 'github-oauth': { 'github.com': 'ghp_exampleSecretValue' } },
  });
  const lock = JSON.stringify({
    'content-hash': 'abc',
    packages: [{ name: 'laravel/framework', version: 'v11.0.0' }],
    'packages-dev': [{ name: 'phpunit/phpunit', version: '11.0.0' }],
  });
  const report = analyzeComposer(json, lock);
  assert.equal(report.ok, true);
  assert.equal(report.json.php, '>=8.2');
  assert.deepEqual(report.missingFromLock, []);
  assert.match(report.json.scripts[0].command, /\[redacted\]/);
  assert.doesNotMatch(JSON.stringify(report), /ghp_exampleSecretValue/);
  assert.match(report.warnings.join(' '), /does not run them/);
  const bad = analyzeComposer('{', '');
  assert.equal(bad.ok, false);
});

test('JSON formatter and minifier reject invalid input', () => {
  assert.equal(formatJson('{"a":1}', 2).output, '{\n  "a": 1\n}');
  assert.equal(formatJson(' { "a" : 1 } ', 0).output, '{"a":1}');
  assert.equal(formatJson('{', 2).ok, false);
});

test('SQL formatter is textual and keeps string contents', () => {
  const result = formatSql("select * from users where name = 'from home'");
  assert.equal(result.ok, true);
  assert.match(result.output, /^SELECT \*/m);
  assert.match(result.output, /^FROM users$/m);
  assert.match(result.output, /'from home'/);
  assert.doesNotMatch(result.output, /FROM home/);
});

test('JWT decode does not verify the signature', () => {
  const decoded = decodeJwt(JWT_EXAMPLE);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.signatureVerified, false);
  assert.equal(decoded.payloadJson.sub, 'example-user');
  assert.match(decoded.disclaimer, /does not verify the signature/i);
  assert.match(decoded.warnings.join(' '), /none/i);
  assert.equal(decodeJwt('not a token').ok, false);
});

test('hash, base64, and URL helpers round-trip without a password hash', async () => {
  const hash = await digestHex('SHA-256', 'abc');
  assert.equal(hash.output, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hash.passwordHash, false);
  assert.equal(decodeBase64(encodeBase64('PHP Hub').output).output, 'PHP Hub');
  assert.equal(decodeBase64('!!!!').ok, false);
  assert.equal(transformUrl(transformUrl('a b/c', 'encode', 'component').output, 'decode', 'component').output, 'a b/c');
});

test('regex tester uses JavaScript and reports an invalid pattern', () => {
  const found = testRegex('h(ell)o', 'g', 'hello hello');
  assert.equal(found.engine, 'javascript');
  assert.equal(found.matches.length, 2);
  assert.deepEqual(found.matches[0].groups, ['ell']);
  assert.equal(testRegex('(', '', 'a').ok, false);
});

test('cron preview describes fields and finds the next midnight', () => {
  const described = describeCron('*/15 * * * *');
  assert.equal(described.ok, true);
  assert.match(described.fields[0].matches, /0, 15, 30, 45/);
  const from = new Date(2026, 0, 1, 0, 0, 30);
  const runs = nextCronRuns('0 0 * * *', from, 1);
  assert.equal(runs.ok, true);
  assert.equal(runs.runs[0].getDate(), 2);
  assert.equal(runs.runs[0].getHours(), 0);
  assert.equal(describeCron('@daily').normalized, '0 0 * * *');
  assert.equal(describeCron('0 0 31 2 *').ok, true);
  assert.equal(nextCronRuns('0 0 31 2 *', from, 1).incomplete, true);
  assert.equal(parseBad('not cron'), false);
});

function parseBad(expr) {
  return describeCron(expr).ok;
}

test('curl builder quotes the command and does not accept non-http URLs', () => {
  const built = buildCurl({ method: 'POST', url: 'https://example.com/hook', headers: 'Accept: application/json', body: "a'b", follow: true });
  assert.equal(built.ok, true);
  assert.equal(built.sent, false);
  assert.match(built.output, /^curl -X POST -L -H '/);
  assert.match(built.output, /a'\\''b/);
  assert.doesNotMatch(built.output, /file:/);
  assert.equal(buildCurl({ method: 'GET', url: 'file:///etc/passwd' }).ok, false);
  assert.equal(buildCurl({ method: 'GET', url: 'https://user:pass@example.com' }).ok, false);
  assert.equal(buildCurl({ method: 'GET', url: 'https://example.com', headers: 'Bad Header' }).ok, false);
});

const NOW = Date.parse('2026-11-12T00:00:00Z');
const byLabel = (result, label) => result.checks.find((c) => c.label === label);

test('cookie parser reads curl -I output and ignores other headers', () => {
  const input = 'HTTP/2 200\ncontent-type: text/html\nset-cookie: a=1; Path=/; Secure\nSet-Cookie: b=2; HttpOnly\n< set-cookie: c=3';
  const cookies = parseSetCookieInput(input);
  assert.deepEqual(cookies.map((c) => c.name), ['a', 'b', 'c']);
});

test('cookie parser accepts bare cookie strings and attribute case', () => {
  const c = parseSetCookie('sid=x=y; SECURE; httponly; SameSite=Lax; Path=/app; DOMAIN=example.com; max-age=60; Expires=Thu, 12 Nov 2026 10:00:00 GMT; Priority=High');
  assert.equal(c.name, 'sid');
  assert.equal(c.value, 'x=y');
  assert.equal(c.attrs.secure, true);
  assert.equal(c.attrs.httponly, true);
  assert.equal(c.attrs.samesite, 'Lax');
  assert.equal(c.attrs.path, '/app');
  assert.equal(c.attrs.domain, 'example.com');
  assert.equal(c.attrs.maxAge, '60');
  assert.deepEqual(c.unknown, ['priority']);
});

test('session cookie names are recognised', () => {
  assert.equal(cookieKind('laravel_session'), 'session');
  assert.equal(cookieKind('my-app-session'), 'session');
  assert.equal(cookieKind('PHPSESSID'), 'session');
  assert.equal(cookieKind('wordpress_logged_in_0123abcd'), 'session');
  assert.equal(cookieKind('XSRF-TOKEN'), 'xsrf');
  assert.equal(cookieKind('theme'), 'other');
});

test('a hardened Laravel session cookie passes', () => {
  const r = checkCookies('set-cookie: laravel_session=v; path=/; secure; httponly; samesite=lax', NOW).results[0];
  assert.equal(r.status, 'pass');
  assert.equal(byLabel(r, 'Secure').status, 'pass');
  assert.equal(byLabel(r, 'Domain').status, 'pass');
});

test('missing Secure and HttpOnly fail on session cookies, warn on others', () => {
  const [sess, other] = checkCookies('PHPSESSID=v; path=/\ntheme=dark; path=/; samesite=lax', NOW).results;
  assert.equal(byLabel(sess, 'Secure').status, 'fail');
  assert.equal(byLabel(sess, 'HttpOnly').status, 'fail');
  assert.equal(byLabel(sess, 'SameSite').status, 'warn');
  assert.match(byLabel(sess, 'Secure').tip, /session\.cookie_secure/);
  assert.match(byLabel(sess, 'Secure').tip, /SESSION_SECURE_COOKIE/);
  assert.equal(byLabel(other, 'Secure').status, 'warn');
  assert.equal(byLabel(other, 'HttpOnly').status, 'warn');
});

test('XSRF-TOKEN without HttpOnly is informational', () => {
  const r = checkCookies('XSRF-TOKEN=v; path=/; secure; samesite=lax', NOW).results[0];
  assert.equal(byLabel(r, 'HttpOnly').status, 'info');
  assert.equal(r.status, 'pass');
});

test('SameSite=None needs Secure', () => {
  const [bad, ok] = checkCookies('w=1; SameSite=None\nw2=1; SameSite=None; Secure; HttpOnly', NOW).results;
  assert.equal(byLabel(bad, 'SameSite').status, 'fail');
  assert.equal(byLabel(ok, 'SameSite').status, 'warn');
});

test('__Host- and __Secure- prefix rules, matched case-insensitively', () => {
  const r = checkCookies([
    '__Host-a=1; Secure; Path=/',
    '__Host-b=1; Secure; Path=/; Domain=example.com',
    '__host-c=1; Path=/',
    '__Host-d=1; Secure',
    '__Secure-e=1; Domain=example.com',
    '__SECURE-f=1; Secure',
  ].join('\n'), NOW).results;
  assert.equal(byLabel(r[0], '__Host- prefix').status, 'pass');
  assert.equal(byLabel(r[1], '__Host- prefix').status, 'fail');
  assert.match(byLabel(r[1], '__Host- prefix').detail, /Domain/);
  assert.equal(byLabel(r[2], '__Host- prefix').status, 'fail');
  assert.equal(byLabel(r[3], '__Host- prefix').status, 'fail');
  assert.equal(byLabel(r[4], '__Secure- prefix').status, 'fail');
  assert.equal(byLabel(r[5], '__Secure- prefix').status, 'pass');
});

test('Max-Age and Expires handling', () => {
  const r = checkCookies([
    'a=1; Max-Age=7200; Expires=Thu, 12 Nov 2026 02:00:00 GMT',
    'b=1; Max-Age=0',
    'c=1; Max-Age=40000000',
    'd=1; Expires=not a date',
    'e=1; Expires=Wed, 11 Nov 2026 00:00:00 GMT',
    'f=1',
  ].join('\n'), NOW).results;
  assert.match(byLabel(r[0], 'Max-Age / Expires').detail, /Max-Age takes precedence/);
  assert.match(byLabel(r[1], 'Max-Age / Expires').detail, /deletes the cookie/);
  assert.equal(byLabel(r[2], 'Max-Age / Expires').status, 'warn');
  assert.equal(byLabel(r[3], 'Max-Age / Expires').status, 'warn');
  assert.match(byLabel(r[4], 'Max-Age / Expires').detail, /in the past/);
  assert.match(byLabel(r[5], 'Max-Age / Expires').detail, /browser-session cookie/);
});

test('cookie checker rejects empty input and lines without cookies', () => {
  assert.equal(checkCookies('').ok, false);
  assert.equal(checkCookies('HTTP/2 200\ncontent-type: text/html').ok, false);
  const r = checkCookies('justavalue', NOW).results[0];
  assert.equal(byLabel(r, 'Name').status, 'fail');
});
