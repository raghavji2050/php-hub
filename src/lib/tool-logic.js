import { PHP_FEATURES, PHP_REMOVED, PHP_VERSIONS } from '../data/php-features.js';

export function lineAt(src, index) {
  if (index <= 0) return 1;
  return src.slice(0, index).split('\n').length;
}

export function cmpVer(a, b) {
  const pa = String(a).split('.').map((n) => Number(n) || 0);
  const pb = String(b).split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace strings, comments, and heredoc/nowdoc with spaces. Length and newlines stay aligned. */
export function maskPhp(src) {
  const s = String(src).replace(/\r\n/g, '\n');
  let out = '';
  let i = 0;
  let mode = 'code';
  let heredocId = '';
  let unclosed = null;
  while (i < s.length) {
    const c = s[i];
    const next = s[i + 1];
    if (mode === 'code') {
      if (c === '/' && next === '/') { out += '  '; i += 2; mode = 'line'; continue; }
      if (c === '/' && next === '*') { out += '  '; i += 2; mode = 'block'; continue; }
      if (c === '#' && next !== '[') { out += ' '; i += 1; mode = 'line'; continue; }
      if (c === "'") { out += ' '; i += 1; mode = 'sq'; continue; }
      if (c === '"') { out += ' '; i += 1; mode = 'dq'; continue; }
      if (c === '<' && s.startsWith('<<<', i)) {
        const m = /^<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(s.slice(i));
        if (m) {
          out += ' '.repeat(m[0].length);
          i += m[0].length;
          mode = 'heredoc';
          heredocId = m[2];
          continue;
        }
      }
      out += c;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') { out += '\n'; i += 1; mode = 'code'; continue; }
      out += ' ';
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') { out += '  '; i += 2; mode = 'code'; continue; }
      out += c === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (mode === 'sq' || mode === 'dq') {
      const q = mode === 'sq' ? "'" : '"';
      if (c === '\\') {
        out += ' ';
        i += 1;
        if (i < s.length) { out += s[i] === '\n' ? '\n' : ' '; i += 1; }
        continue;
      }
      if (c === q) { out += ' '; i += 1; mode = 'code'; continue; }
      out += c === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (c === '\n') {
      const rest = s.slice(i + 1);
      const endRe = new RegExp('^[ \\t]*' + escapeRegExp(heredocId) + ';?(?:\\r)?(?=\\n|$)');
      if (endRe.test(rest)) {
        out += '\n';
        i += 1;
        const line = /^[^\n]*/.exec(s.slice(i))[0];
        out += ' '.repeat(line.length);
        i += line.length;
        mode = 'code';
        heredocId = '';
        continue;
      }
      out += '\n';
      i += 1;
      continue;
    }
    out += ' ';
    i += 1;
  }
  if (mode === 'sq' || mode === 'dq') unclosed = 'string';
  else if (mode === 'block') unclosed = 'comment';
  else if (mode === 'heredoc') unclosed = 'heredoc';
  return { masked: out, unclosed };
}

function countChar(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n += 1;
  return n;
}

function leadingClosers(maskLine) {
  const t = maskLine.trimStart();
  let n = 0;
  for (const c of t) {
    if (c === '}' || c === ']') n += 1;
    else if (c === ' ' || c === '\t') continue;
    else break;
  }
  return n;
}

export function formatPhp(src) {
  if (!String(src).trim()) return { ok: false, error: 'Paste some PHP first.' };
  const text = String(src).replace(/\r\n/g, '\n').replace(/\t/g, '    ');
  const { masked } = maskPhp(text);
  if (masked.length !== text.length) return { ok: false, error: 'Could not format this snippet safely.' };
  const lines = text.split('\n');
  const mlines = masked.split('\n');
  let depth = 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const mask = mlines[i] || '';
    if (!raw.trim()) { out.push(''); continue; }
    const t = mask.trim();
    const altClose = /^(endif|endforeach|endfor|endwhile|endswitch)\b/.test(t) ? 1 : 0;
    const altOpen = /^(if|foreach|for|while|switch)\b/.test(t) && /:\s*$/.test(t) ? 1 : 0;
    const isElse = /^(else|elseif)\b/.test(t) && /:\s*$/.test(t) ? 1 : 0;
    const opens = countChar(mask, '{') + countChar(mask, '[');
    const closes = countChar(mask, '}') + countChar(mask, ']');
    const level = Math.max(0, depth - leadingClosers(mask) - altClose - isElse);
    out.push(`${'    '.repeat(level)}${raw.trim()}`);
    depth = Math.max(0, depth + opens - closes + altOpen - altClose);
  }
  const output = `${out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim()}\n`;
  return { ok: true, output };
}

const ALT_CLOSE = { endif: 'if', endforeach: 'foreach', endfor: 'for', endwhile: 'while', endswitch: 'switch' };

export function validatePhp(src) {
  if (!String(src).trim()) return { ok: false, error: 'Paste some PHP first.', issues: [] };
  const text = String(src).replace(/\r\n/g, '\n');
  const { masked, unclosed } = maskPhp(text);
  const issues = [];
  if (unclosed === 'string') issues.push({ level: 'error', line: lineAt(masked, Math.max(0, masked.length - 1)), message: 'A string is still open at the end of the input.' });
  if (unclosed === 'comment') issues.push({ level: 'error', line: 1, message: 'A /* comment is still open at the end of the input.' });
  if (unclosed === 'heredoc') issues.push({ level: 'error', line: 1, message: 'A heredoc or nowdoc is still open at the end of the input.' });
  const stack = [];
  let lineNo = 1;
  for (const ch of masked) {
    if (ch === '\n') { lineNo += 1; continue; }
    if (ch === '{' || ch === '(' || ch === '[') stack.push({ ch, line: lineNo });
    else if (ch === '}' || ch === ')' || ch === ']') {
      const want = ch === '}' ? '{' : ch === ')' ? '(' : '[';
      if (!stack.length || stack[stack.length - 1].ch !== want) issues.push({ level: 'error', line: lineNo, message: `Unexpected '${ch}'.` });
      else stack.pop();
    }
  }
  for (const open of stack) issues.push({ level: 'error', line: open.line, message: `'${open.ch}' is not closed.` });
  const alt = [];
  lineNo = 1;
  for (const line of masked.split('\n')) {
    const t = line.trim();
    const close = /^(endif|endforeach|endfor|endwhile|endswitch)\b/.exec(t);
    if (close) {
      const want = ALT_CLOSE[close[1]];
      if (!alt.length || alt[alt.length - 1].kind !== want) issues.push({ level: 'error', line: lineNo, message: `\`${close[1]}\` does not match an open ${want}.` });
      else alt.pop();
    } else if (/^(if|foreach|for|while|switch)\b/.test(t) && /:\s*$/.test(t)) {
      alt.push({ kind: t.match(/^(if|foreach|for|while|switch)/)[1], line: lineNo });
    }
    lineNo += 1;
  }
  for (const open of alt) issues.push({ level: 'error', line: open.line, message: `\`${open.kind} (...):\` is missing its end keyword.` });
  if (!/<\?(php|=)/.test(text)) issues.push({ level: 'warning', line: 1, message: 'No <?php or <?= tag. A snippet can still be checked; this does not prove the file is valid PHP.' });
  const evalRe = new RegExp(`\\b${'eval'}\\s*\\(`);
  const evalAt = masked.search(evalRe);
  if (evalAt >= 0) issues.push({ level: 'warning', line: lineAt(masked, evalAt), message: 'eval() is present in the text. This page does not run it. Do not pass untrusted input to eval.' });
  const errors = issues.filter((i) => i.level === 'error');
  return {
    ok: true,
    static: true,
    passed: errors.length === 0,
    issues,
    summary: errors.length
      ? `${errors.length} structural problem${errors.length === 1 ? '' : 's'} found. This is static text analysis, not a PHP parser and not a security test.`
      : 'No unbalanced braces, brackets, quotes, or comments stood out. This is not a PHP parse and not a security review.',
  };
}

function evidenceLine(code, masked, index) {
  const line = lineAt(masked, index);
  const text = String(code).replace(/\r\n/g, '\n').split('\n')[line - 1] || '';
  return { line, evidence: text.trim().slice(0, 160) };
}

export function checkPhpVersion(code, target) {
  if (!String(code).trim()) return { ok: false, error: 'Paste some PHP first.' };
  if (!PHP_VERSIONS.includes(target)) return { ok: false, error: 'Choose a PHP version from 8.0 through 8.5.' };
  const { masked } = maskPhp(code);
  const findings = [];
  for (const feature of PHP_FEATURES) {
    const match = new RegExp(feature.pattern, 'g').exec(masked);
    if (!match) continue;
    const where = evidenceLine(code, masked, match.index);
    findings.push({
      id: feature.id,
      name: feature.name,
      version: feature.version,
      url: feature.url,
      line: where.line,
      evidence: where.evidence,
      aboveTarget: cmpVer(feature.version, target) > 0,
    });
  }
  const removed = [];
  for (const item of PHP_REMOVED) {
    if (cmpVer(target, item.version) < 0) continue;
    const match = new RegExp(item.pattern, 'g').exec(masked);
    if (!match) continue;
    const where = evidenceLine(code, masked, match.index);
    removed.push({ name: item.name, version: item.version, url: item.url, note: item.note, line: where.line, evidence: where.evidence });
  }
  const highest = findings.reduce((max, f) => (!max || cmpVer(f.version, max) > 0 ? f.version : max), '');
  return { ok: true, target, findings, removed, highest, guidance: true };
}

const SECRET_KEY = /token|password|secret|passwd|api[-_]?key|authorization|private[-_]?key|bearer/i;
const SECRET_PARENT = /^(github-oauth|gitlab-token|gitlab-oauth|http-basic|bearer|auth)$/i;

function redactTree(node, force = false) {
  if (Array.isArray(node)) return node.map((v) => redactTree(v, force));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = redactTree(value, force || SECRET_PARENT.test(key) || SECRET_KEY.test(key));
    }
    return out;
  }
  if (typeof node === 'string' && force) return '[redacted]';
  if (typeof node === 'string') return node.replace(/(https?:\/\/)[^/\s@]+@/gi, '$1[redacted]@');
  return node;
}

function scrubCommand(cmd) {
  return String(cmd)
    .replace(/(https?:\/\/)[^/\s@]+@/gi, '$1[redacted]@')
    .replace(/\b(?:ghp_|github_pat_|ghs_|xox[baprs]-)[A-Za-z0-9_-]+/g, '[redacted]');
}

function asDeps(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([name, constraint]) => ({ name, constraint: String(constraint) }));
}

function parseJson(text, label) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `${label} is not valid JSON. ${error.message}` };
  }
}

export function analyzeComposer(jsonText, lockText) {
  const rawJson = String(jsonText || '').trim();
  const rawLock = String(lockText || '').trim();
  if (!rawJson && !rawLock) return { ok: false, error: 'Paste a composer.json, a composer.lock, or both.' };
  let json = null;
  let lock = null;
  let redacted = false;
  if (rawJson) {
    const parsed = parseJson(rawJson, 'composer.json');
    if (!parsed.ok) return parsed;
    const clean = redactTree(parsed.value);
    redacted = JSON.stringify(clean) !== JSON.stringify(parsed.value);
    json = clean;
  }
  if (rawLock) {
    const parsed = parseJson(rawLock, 'composer.lock');
    if (!parsed.ok) return parsed;
    const clean = redactTree(parsed.value);
    if (JSON.stringify(clean) !== JSON.stringify(parsed.value)) redacted = true;
    lock = clean;
  }
  const warnings = [];
  if (redacted) warnings.push('Some values looked like credentials or URLs with passwords. They are shown as [redacted] and were not sent anywhere.');
  const result = { ok: true, warnings, json: null, lock: null, missingFromLock: [] };
  if (json) {
    if (typeof json !== 'object' || Array.isArray(json)) return { ok: false, error: 'composer.json must be a JSON object.' };
    const require = asDeps(json.require);
    const requireDev = asDeps(json['require-dev']);
    const scripts = [];
    if (json.scripts && typeof json.scripts === 'object') {
      for (const [event, command] of Object.entries(json.scripts)) {
        const list = Array.isArray(command) ? command : [command];
        for (const item of list) scripts.push({ event, command: scrubCommand(item) });
      }
      if (scripts.length) warnings.push('Scripts are listed only. This page does not run them.');
    }
    const repositories = [];
    if (Array.isArray(json.repositories)) {
      for (const repo of json.repositories) {
        if (!repo || typeof repo !== 'object') continue;
        repositories.push({ type: String(repo.type || ''), url: typeof repo.url === 'string' ? repo.url : '' });
      }
      if (repositories.length) warnings.push('Custom repositories are listed. This page did not contact them.');
    }
    const stability = typeof json['minimum-stability'] === 'string' ? json['minimum-stability'] : '';
    if (stability && stability !== 'stable') warnings.push(`minimum-stability is "${stability}". Composer may allow unstable package versions.`);
    result.json = {
      name: typeof json.name === 'string' ? json.name : '',
      description: typeof json.description === 'string' ? json.description : '',
      type: typeof json.type === 'string' ? json.type : '',
      license: json.license == null ? '' : Array.isArray(json.license) ? json.license.map(String).join(', ') : String(json.license),
      php: require.find((d) => d.name === 'php')?.constraint || '',
      require: require.filter((d) => d.name !== 'php'),
      requireDev: requireDev.filter((d) => d.name !== 'php'),
      scripts,
      repositories,
      stability,
    };
  }
  if (lock) {
    if (typeof lock !== 'object' || Array.isArray(lock)) return { ok: false, error: 'composer.lock must be a JSON object.' };
    const packages = [];
    for (const [list, dev] of [[lock.packages, false], [lock['packages-dev'], true]]) {
      if (!Array.isArray(list)) continue;
      for (const pkg of list) {
        if (!pkg || typeof pkg !== 'object' || typeof pkg.name !== 'string') continue;
        packages.push({ name: pkg.name, version: typeof pkg.version === 'string' ? pkg.version : '', dev });
      }
    }
    const platformPhp = lock.platform && typeof lock.platform.php === 'string' ? lock.platform.php : '';
    result.lock = {
      contentHash: typeof lock['content-hash'] === 'string' ? lock['content-hash'] : '',
      php: platformPhp,
      count: packages.length,
      packages: packages.slice(0, 200),
      truncated: packages.length > 200,
    };
    if (result.json) {
      const locked = new Set(packages.map((p) => p.name));
      const wanted = [...result.json.require, ...result.json.requireDev].filter((d) => !d.name.startsWith('ext-') && d.name !== 'php');
      result.missingFromLock = wanted.filter((d) => !locked.has(d.name)).map((d) => d.name);
      if (result.missingFromLock.length) warnings.push('Some required packages are not in the pasted lock file. That can be normal for a platform-only package, or it can mean the lock is out of date.');
    }
  } else if (result.json) {
    warnings.push('No composer.lock was pasted, so this report cannot show installed versions.');
  }
  return result;
}

export function formatJson(text, space) {
  if (!String(text).trim()) return { ok: false, error: 'Paste JSON first.' };
  try {
    const value = JSON.parse(text);
    return { ok: true, output: JSON.stringify(value, null, space) };
  } catch (error) {
    return { ok: false, error: `Invalid JSON. ${error.message}` };
  }
}

function splitSql(sql) {
  const parts = [];
  let buf = '';
  let i = 0;
  let mode = 'code';
  while (i < sql.length) {
    const c = sql[i];
    if (mode === 'code') {
      if (c === "'" || c === '"' || c === '`') {
        if (buf) parts.push({ type: 'code', text: buf });
        buf = c;
        mode = c;
        i += 1;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }
    buf += c;
    if (c === '\\' && mode !== '`') {
      if (i + 1 < sql.length) { buf += sql[i + 1]; i += 2; continue; }
    }
    if (c === mode) {
      if (mode === "'" && sql[i + 1] === "'") { buf += sql[i + 1]; i += 2; continue; }
      parts.push({ type: 'str', text: buf });
      buf = '';
      mode = 'code';
    }
    i += 1;
  }
  if (buf) parts.push({ type: mode === 'code' ? 'code' : 'str', text: buf });
  if (mode !== 'code') return null;
  return parts;
}

const SQL_CLAUSES = ['UNION ALL', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'GROUP BY', 'ORDER BY', 'INSERT INTO', 'DELETE FROM', 'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'VALUES', 'UPDATE', 'JOIN', 'SET', 'UNION', 'WITH'];

export function formatSql(sql) {
  if (!String(sql).trim()) return { ok: false, error: 'Paste a SQL statement first.' };
  const parts = splitSql(String(sql));
  if (!parts) return { ok: false, error: 'A quote looks unclosed. Nothing was executed.' };
  const clauses = [...SQL_CLAUSES].sort((a, b) => b.length - a.length);
  const formatted = parts.map((part) => {
    if (part.type !== 'code') return part.text;
    let s = part.text.replace(/\s+/g, ' ');
    const tokens = [];
    for (const kw of clauses) {
      const re = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      s = s.replace(re, () => {
        const id = `\u0000${tokens.length}\u0000`;
        tokens.push(kw);
        return `\n${id}`;
      });
    }
    return s.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[Number(n)]);
  }).join('');
  const output = formatted.replace(/^\n+/, '').split('\n').map((line) => line.trim()).filter((line, i, arr) => line || arr[i - 1]).join('\n').trim();
  return { ok: true, output: `${output}\n` };
}

export function testRegex(pattern, flags, text) {
  const source = String(pattern || '');
  const sample = String(text || '');
  if (!source) return { ok: false, error: 'Enter a pattern.' };
  if (source.length > 300) return { ok: false, error: 'Pattern is limited to 300 characters here.' };
  if (sample.length > 20000) return { ok: false, error: 'Test text is limited to 20,000 characters here.' };
  const cleanFlags = [...new Set(String(flags || '').split(''))].filter((f) => 'gimsuy'.includes(f)).join('');
  let re;
  try {
    re = new RegExp(source, cleanFlags);
  } catch (error) {
    return { ok: false, error: error.message || 'Invalid regular expression.' };
  }
  const matches = [];
  const limit = 100;
  if (cleanFlags.includes('g')) {
    let match;
    let guard = 0;
    while ((match = re.exec(sample)) && matches.length < limit && guard < 10000) {
      matches.push({ index: match.index, value: match[0], groups: match.slice(1) });
      if (match[0] === '') re.lastIndex += 1;
      guard += 1;
    }
  } else {
    const match = re.exec(sample);
    if (match) matches.push({ index: match.index, value: match[0], groups: match.slice(1) });
  }
  return { ok: true, matches, truncated: matches.length >= limit, engine: 'javascript' };
}

const CRON_NICK = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};
const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DOW_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function resolveName(token, names) {
  const key = token.toLowerCase();
  if (names && Object.prototype.hasOwnProperty.call(names, key)) return names[key];
  if (!/^\d+$/.test(token)) return NaN;
  return Number(token);
}

export function parseCronField(field, min, max, names) {
  if (field === '*') {
    const values = [];
    for (let n = min; n <= max; n++) values.push(n);
    return { ok: true, all: true, values };
  }
  const values = new Set();
  for (const part of field.split(',')) {
    if (!part) return { ok: false, error: `Empty list item in "${field}".` };
    const [base, stepToken, extra] = part.split('/');
    if (extra !== undefined) return { ok: false, error: `Too many slashes in "${part}".` };
    const step = stepToken === undefined ? 1 : Number(stepToken);
    if (!Number.isInteger(step) || step <= 0) return { ok: false, error: `Invalid step in "${part}".` };
    let start;
    let end;
    if (base === '*') {
      start = min;
      end = max;
    } else if (base.includes('-')) {
      const [a, b, more] = base.split('-');
      if (more !== undefined) return { ok: false, error: `Invalid range "${part}".` };
      start = resolveName(a, names);
      end = resolveName(b, names);
    } else {
      start = resolveName(base, names);
      end = stepToken === undefined ? start : max;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return { ok: false, error: `"${part}" is outside ${min}-${max}.` };
    }
    for (let n = start; n <= end; n += step) values.add(names === DOW_NAMES && n === 7 ? 0 : n);
  }
  return { ok: true, all: false, values: [...values].sort((a, b) => a - b) };
}

export function parseCron(expr) {
  let text = String(expr || '').trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, error: 'Enter a cron expression.' };
  const nick = CRON_NICK[text.toLowerCase()];
  if (nick) text = nick;
  if (text.startsWith('@')) return { ok: false, error: 'That nickname is not supported. Use five fields, or one of @yearly, @monthly, @weekly, @daily, @hourly.' };
  const parts = text.split(' ');
  if (parts.length !== 5) return { ok: false, error: 'Use five fields: minute hour day-of-month month day-of-week.' };
  const minute = parseCronField(parts[0], 0, 59);
  if (!minute.ok) return minute;
  const hour = parseCronField(parts[1], 0, 23);
  if (!hour.ok) return hour;
  const dom = parseCronField(parts[2], 1, 31);
  if (!dom.ok) return dom;
  const month = parseCronField(parts[3], 1, 12, MONTH_NAMES);
  if (!month.ok) return month;
  const dow = parseCronField(parts[4], 0, 7, DOW_NAMES);
  if (!dow.ok) return dow;
  const dowValues = [...new Set(dow.values.map((n) => (n === 7 ? 0 : n)))].sort((a, b) => a - b);
  const dowAll = dow.all || dowValues.length === 7;
  return {
    ok: true,
    normalized: parts.join(' '),
    parts,
    minute,
    hour,
    dom,
    month,
    dow: { ...dow, all: dowAll, values: dowAll ? [0, 1, 2, 3, 4, 5, 6] : dowValues },
    bothDaysRestricted: !dom.all && !dowAll,
  };
}

export function describeCron(expr) {
  const parsed = parseCron(expr);
  if (!parsed.ok) return parsed;
  const list = (field) => (field.all ? 'every' : field.values.join(', '));
  return {
    ok: true,
    normalized: parsed.normalized,
    fields: [
      { name: 'Minute', raw: parsed.parts[0], matches: list(parsed.minute) },
      { name: 'Hour', raw: parsed.parts[1], matches: list(parsed.hour) },
      { name: 'Day of month', raw: parsed.parts[2], matches: list(parsed.dom) },
      { name: 'Month', raw: parsed.parts[3], matches: list(parsed.month) },
      { name: 'Day of week', raw: parsed.parts[4], matches: parsed.dow.all ? 'every' : parsed.dow.values.map((n) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n]).join(', ') },
    ],
    note: parsed.bothDaysRestricted ? 'Both day-of-month and day-of-week are restricted. This preview treats a date as a match when either day matches, which is the usual cron rule.' : '',
  };
}

function cronMatches(date, parsed) {
  if (!parsed.minute.all && !parsed.minute.values.includes(date.getMinutes())) return false;
  if (!parsed.hour.all && !parsed.hour.values.includes(date.getHours())) return false;
  if (!parsed.month.all && !parsed.month.values.includes(date.getMonth() + 1)) return false;
  const domOk = parsed.dom.all || parsed.dom.values.includes(date.getDate());
  const dowOk = parsed.dow.all || parsed.dow.values.includes(date.getDay());
  if (parsed.dom.all && parsed.dow.all) return true;
  if (parsed.dom.all) return dowOk;
  if (parsed.dow.all) return domOk;
  return domOk || dowOk;
}

export function nextCronRuns(expr, now = new Date(), count = 5) {
  const parsed = parseCron(expr);
  if (!parsed.ok) return parsed;
  const runs = [];
  const cursor = new Date(now.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = cursor.getTime() + 366 * 24 * 60 * 60 * 1000;
  let steps = 0;
  while (cursor.getTime() < limit && runs.length < count && steps < 600000) {
    if (cronMatches(cursor, parsed)) runs.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1);
    steps += 1;
  }
  return { ok: true, runs, incomplete: runs.length < count };
}

function b64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(seg) {
  if (!/^[A-Za-z0-9_-]+$/.test(seg)) throw new Error('bad');
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export const JWT_EXAMPLE = `${b64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64urlEncode(JSON.stringify({ sub: 'example-user', admin: false }))}.example-signature-not-verified`;

export function decodeJwt(token) {
  const disclaimer = 'Decoding does not verify the signature. Anyone can edit an unverified payload. Do not use this result to grant access.';
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false, error: 'Paste a JWT first.', signatureVerified: false, disclaimer };
  const parts = trimmed.split('.');
  if (parts.length < 2 || parts.length > 3) return { ok: false, error: 'A JWT looks like header.payload.signature.', signatureVerified: false, disclaimer };
  let headerText = '';
  let payloadText = '';
  try { headerText = b64urlDecode(parts[0]); } catch { return { ok: false, error: 'The header is not valid base64url.', signatureVerified: false, disclaimer }; }
  try { payloadText = b64urlDecode(parts[1]); } catch { return { ok: false, error: 'The payload is not valid base64url.', signatureVerified: false, disclaimer }; }
  let headerJson = null;
  let payloadJson = null;
  try { headerJson = JSON.parse(headerText); } catch { headerJson = null; }
  try { payloadJson = JSON.parse(payloadText); } catch { payloadJson = null; }
  const algorithm = headerJson && typeof headerJson === 'object' && headerJson.alg != null ? String(headerJson.alg) : '';
  const warnings = [disclaimer];
  if (!headerJson) warnings.push('The header is not JSON.');
  if (!payloadJson) warnings.push('The payload is not JSON.');
  if (algorithm.toLowerCase() === 'none') warnings.push('The header says alg "none". Treat the payload as untrusted.');
  if (!parts[2]) warnings.push('There is no signature segment.');
  return {
    ok: true,
    signatureVerified: false,
    disclaimer,
    headerText,
    payloadText,
    headerJson,
    payloadJson,
    signature: parts[2] || '',
    algorithm,
    warnings,
  };
}

export async function digestHex(algorithm, text) {
  const value = String(text ?? '');
  if (!value) return { ok: false, error: 'Enter the text to hash.' };
  if (!['SHA-256', 'SHA-384', 'SHA-512'].includes(algorithm)) return { ok: false, error: 'Choose SHA-256, SHA-384, or SHA-512.' };
  if (!globalThis.crypto?.subtle) return { ok: false, error: 'This browser cannot compute a digest locally.' };
  const buf = await crypto.subtle.digest(algorithm, new TextEncoder().encode(value));
  const output = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { ok: true, output, algorithm, passwordHash: false };
}

export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(String(text));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { ok: true, output: btoa(bin) };
}

export function decodeBase64(text) {
  const clean = String(text || '').trim().replace(/\s+/g, '');
  if (!clean) return { ok: false, error: 'Paste a Base64 string.' };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) return { ok: false, error: 'That is not standard Base64.' };
  try {
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, output: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: 'Could not decode that as UTF-8 Base64.' };
  }
}

export function transformUrl(text, action, scope) {
  const value = String(text ?? '');
  if (!value) return { ok: false, error: 'Enter some text.' };
  try {
    if (action === 'encode') return { ok: true, output: scope === 'component' ? encodeURIComponent(value) : encodeURI(value) };
    return { ok: true, output: scope === 'component' ? decodeURIComponent(value) : decodeURI(value) };
  } catch {
    return { ok: false, error: 'Could not decode that value. It may be truncated or not percent-encoded.' };
  }
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildCurl(input) {
  const method = String(input.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) return { ok: false, error: 'Choose a common HTTP method.' };
  const rawUrl = String(input.url || '').trim();
  let url;
  try { url = new URL(rawUrl); } catch { return { ok: false, error: 'Enter a full URL, including http:// or https://.' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Only http and https URLs can be written into the command. This page does not send a request.' };
  if (url.username || url.password) return { ok: false, error: 'Remove the username and password from the URL before building a command.' };
  const parts = ['curl'];
  if (method !== 'GET') parts.push('-X', method);
  if (input.follow) parts.push('-L');
  if (input.include) parts.push('-i');
  if (input.compressed) parts.push('--compressed');
  if (input.insecure) parts.push('--insecure');
  const headerLines = String(input.headers || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of headerLines) {
    const colon = line.indexOf(':');
    if (colon <= 0) return { ok: false, error: `Header must look like Name: value (${line}).` };
    const name = line.slice(0, colon).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) return { ok: false, error: `That header name is not valid (${name}).` };
    parts.push('-H', shellQuote(line));
  }
  const body = String(input.body || '');
  if (body && method !== 'GET' && method !== 'HEAD') parts.push('--data-raw', shellQuote(body));
  parts.push(shellQuote(rawUrl));
  return { ok: true, output: parts.join(' '), sent: false };
}
