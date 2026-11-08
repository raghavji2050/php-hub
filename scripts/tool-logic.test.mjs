import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeComposer, buildCurl, checkPhpVersion, decodeBase64, decodeJwt, describeCron,
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
