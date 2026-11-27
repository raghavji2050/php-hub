import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersion,
  compareVersions,
  satisfiesRange,
  parseComposerLock,
  evaluateAdvisories,
} from '../src/lib/composer-matcher.js';
import { BRIEF_ADVISORIES, SAMPLE_COMPOSER_LOCK } from '../src/data/brief-advisories.js';

test('parseVersion normalizes leading v and prereleases', () => {
  assert.equal(compareVersions('v12.70.0', '12.71.0'), -1);
  assert.equal(compareVersions('10.0.0-beta.1', '10.0.0-beta.4'), -1);
  assert.equal(compareVersions('10.0.0-beta.4', '10.0.0'), -1);
  assert.equal(compareVersions('7.0.0-rc1', '7.0.0-rc2'), -1);
  assert.equal(parseVersion('dev-main'), null);
});

test('satisfiesRange handles multi-branch OR and AND comparators', () => {
  const laravelRange = '< 12.71.0 || >= 13.0.0, < 13.40.0';
  assert.equal(satisfiesRange('v12.70.9', laravelRange), true);
  assert.equal(satisfiesRange('v12.71.0', laravelRange), false);
  assert.equal(satisfiesRange('13.39.0', laravelRange), true);
  assert.equal(satisfiesRange('13.40.0', laravelRange), false);

  const sharpRange = '< 9.23.0 || >= 10.0.0-beta.1, < 10.0.0-beta.4';
  assert.equal(satisfiesRange('10.0.0-beta.2', sharpRange), true);
  assert.equal(satisfiesRange('10.0.0-beta.4', sharpRange), false);
});

test('parseComposerLock handles valid lockfiles and rejects invalid input', () => {
  assert.equal(parseComposerLock('').ok, false);
  assert.equal(parseComposerLock('{not json').ok, false);
  assert.equal(parseComposerLock('{"name":"app"}').ok, false);

  const res = parseComposerLock(SAMPLE_COMPOSER_LOCK);
  assert.equal(res.ok, true);
  assert.equal(res.packageCount, 5);
  assert.equal(res.packages['laravel/framework'], 'v12.70.0');
  assert.equal(res.packages['phpunit/phpunit'], '13.4.2');
  assert.ok(res.stackTags.includes('stack-laravel'));
  assert.ok(res.stackTags.includes('stack-symfony'));
});

test('evaluateAdvisories flags affected and safe packages per brief accurately', () => {
  const parsed = parseComposerLock(SAMPLE_COMPOSER_LOCK);
  const res = evaluateAdvisories(parsed.packages, BRIEF_ADVISORIES, '8.4.26');

  const affectedPkgs = res.affected.map((a) => a.package);
  assert.ok(affectedPkgs.includes('laravel/framework'));
  assert.ok(affectedPkgs.includes('symfony/http-foundation'));
  assert.ok(affectedPkgs.includes('phpunit/phpunit'));
  assert.ok(affectedPkgs.includes('php'));

  // symfony/yaml 7.4.23 and phpoffice/phpspreadsheet 3.10.8 are patched -> safe
  const safePkgs = res.safe.map((a) => a.package);
  assert.ok(safePkgs.includes('symfony/yaml'));
  assert.ok(safePkgs.includes('phpoffice/phpspreadsheet'));

  const brief23 = res.byBrief.find((b) => b.briefSlug === '2026-11-23-php-security-this-week');
  assert.equal(brief23.status, 'not_in_stack');

  const brief16 = res.byBrief.find((b) => b.briefSlug === '2026-11-16-php-security-this-week');
  assert.equal(brief16.status, 'affected');

  // Upgraded PHP 8.4.27 should move PHP from affected to safe
  const resSafePhp = evaluateAdvisories(parsed.packages, BRIEF_ADVISORIES, '8.4.27');
  assert.equal(resSafePhp.affected.some((a) => a.package === 'php'), false);
  assert.equal(resSafePhp.safe.some((a) => a.package === 'php'), true);
});
