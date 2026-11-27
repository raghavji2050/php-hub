// Pure client-side composer.lock parser and SemVer advisory matcher.
// Runs 100% in the browser (or Node tests); never uploads lockfiles.

const PRE_RANK = { dev: 0, alpha: 1, a: 1, beta: 2, b: 2, rc: 3 };

export function parseVersion(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^v/i, '');
  if (!cleaned || /^dev-/i.test(cleaned) || /-dev$/i.test(cleaned)) return null;
  const m = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:[-.]?([a-zA-Z]+)\.?(\d+)?)?$/);
  if (!m) return null;
  const nums = [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0), Number(m[4] ?? 0)];
  let pre = null;
  if (m[5]) {
    const tag = m[5].toLowerCase();
    const rank = tag in PRE_RANK ? PRE_RANK[tag] : 2;
    pre = { rank, num: Number(m[6] ?? 0), raw: tag };
  }
  return { nums, pre, normalized: cleaned };
}

export function compareVersions(aRaw, bRaw) {
  const a = typeof aRaw === 'string' ? parseVersion(aRaw) : aRaw;
  const b = typeof bRaw === 'string' ? parseVersion(bRaw) : bRaw;
  if (!a || !b) return null;
  for (let i = 0; i < 4; i++) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] < b.nums[i] ? -1 : 1;
  }
  if (!a.pre && !b.pre) return 0;
  if (a.pre && !b.pre) return -1;
  if (!a.pre && b.pre) return 1;
  if (a.pre.rank !== b.pre.rank) return a.pre.rank < b.pre.rank ? -1 : 1;
  if (a.pre.num !== b.pre.num) return a.pre.num < b.pre.num ? -1 : 1;
  return 0;
}

function satisfiesComparator(ver, comp) {
  const m = comp.trim().match(/^(<=|>=|<|>|=)?\s*(.+)$/);
  if (!m) return false;
  const op = m[1] || '=';
  const target = parseVersion(m[2]);
  if (!target) return false;
  const cmp = compareVersions(ver, target);
  if (cmp === null) return false;
  if (op === '<') return cmp < 0;
  if (op === '<=') return cmp <= 0;
  if (op === '>') return cmp > 0;
  if (op === '>=') return cmp >= 0;
  return cmp === 0;
}

export function satisfiesRange(versionStr, rangeExpr) {
  const ver = parseVersion(versionStr);
  if (!ver || typeof rangeExpr !== 'string' || !rangeExpr.trim()) return false;
  const orBranches = rangeExpr.split('||');
  for (const branch of orBranches) {
    const parts = branch.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    if (parts.every((p) => satisfiesComparator(ver, p))) return true;
  }
  return false;
}

export function detectStackTags(packagesMap) {
  const tags = new Set(['am-i-affected']);
  const names = Object.keys(packagesMap);
  if (names.some((n) => n === 'laravel/framework' || n.startsWith('laravel/'))) tags.add('stack-laravel');
  if (names.some((n) => n.startsWith('symfony/'))) tags.add('stack-symfony');
  if (names.some((n) => n.startsWith('wordpress') || n.includes('wp-'))) tags.add('stack-wordpress');
  if (names.some((n) => n === 'phpunit/phpunit')) tags.add('stack-phpunit');
  return [...tags];
}

export function parseComposerLock(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'Paste your composer.lock JSON first.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { ok: false, error: 'Invalid JSON. Make sure you pasted the full composer.lock file.' };
  }
  if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.packages) && !Array.isArray(parsed['packages-dev']))) {
    return { ok: false, error: 'This JSON does not look like a composer.lock file (missing "packages" array).' };
  }
  const packages = {};
  const devNames = new Set();
  for (const entry of parsed.packages || []) {
    if (entry && typeof entry.name === 'string' && typeof entry.version === 'string') {
      packages[entry.name.toLowerCase()] = entry.version.trim();
    }
  }
  for (const entry of parsed['packages-dev'] || []) {
    if (entry && typeof entry.name === 'string' && typeof entry.version === 'string') {
      const k = entry.name.toLowerCase();
      if (!(k in packages)) packages[k] = entry.version.trim();
      devNames.add(k);
    }
  }
  // Extract exact PHP version if platform-overrides.php is pinned to an exact version
  let detectedPhp = '';
  const overridePhp = parsed?.['platform-overrides']?.php;
  if (typeof overridePhp === 'string' && parseVersion(overridePhp)) {
    detectedPhp = overridePhp.trim();
  }
  return {
    ok: true,
    packages,
    devNames: [...devNames],
    packageCount: Object.keys(packages).length,
    detectedPhp,
    stackTags: detectStackTags(packages),
  };
}

export function evaluateAdvisories(packagesMap, advisories, phpVersion = '') {
  const normMap = {};
  for (const [k, v] of Object.entries(packagesMap || {})) {
    normMap[k.toLowerCase()] = v;
  }
  const cleanPhp = typeof phpVersion === 'string' ? phpVersion.trim() : '';
  if (cleanPhp && parseVersion(cleanPhp)) {
    normMap['php'] = cleanPhp;
  }

  const affected = [];
  const safe = [];
  const briefMap = new Map();

  for (const adv of advisories) {
    if (!briefMap.has(adv.briefSlug)) {
      briefMap.set(adv.briefSlug, {
        briefSlug: adv.briefSlug,
        briefTitle: adv.briefTitle,
        briefDate: adv.briefDate,
        briefUrl: adv.briefUrl,
        affectedItems: [],
        safeItems: [],
        otherItems: [],
        status: 'not_in_stack',
      });
    }
    const brief = briefMap.get(adv.briefSlug);
    const pkgKey = adv.package.toLowerCase();
    const installed = normMap[pkgKey];

    if (!installed) {
      brief.otherItems.push(adv);
      continue;
    }

    const isAffected = satisfiesRange(installed, adv.affected);
    const record = { ...adv, installed };
    if (isAffected) {
      affected.push(record);
      brief.affectedItems.push(record);
    } else {
      safe.push(record);
      brief.safeItems.push(record);
    }
  }

  const byBrief = [...briefMap.values()].map((b) => {
    if (b.affectedItems.length > 0) b.status = 'affected';
    else if (b.safeItems.length > 0) b.status = 'safe';
    else b.status = 'not_in_stack';
    return b;
  });

  return {
    affected,
    safe,
    byBrief,
    summary: {
      totalPackages: Object.keys(normMap).length,
      affectedCount: affected.length,
      safeCount: safe.length,
      briefsAffected: byBrief.filter((b) => b.status === 'affected').length,
      briefsSafe: byBrief.filter((b) => b.status === 'safe').length,
      briefsTotal: byBrief.length,
    },
    stackTags: detectStackTags(normMap),
  };
}
