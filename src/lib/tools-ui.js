import {
  analyzeComposer, buildCurl, checkCookies, checkPhpVersion, decodeBase64, decodeJwt, describeCron,
  digestHex, encodeBase64, formatJson, formatPhp, formatSql, nextCronRuns, transformUrl, validatePhp,
} from './tool-logic.js';

function field(root, name) {
  return root.querySelector(`[data-field="${name}"]`);
}
function value(root, name) {
  return field(root, name)?.value ?? '';
}
function setError(root, message) {
  const node = root.querySelector('[data-error]');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || '';
}
function setOutput(root, text) {
  const node = root.querySelector('[data-output]');
  if (!node) return;
  node.hidden = !text;
  node.textContent = text || '';
  root.dataset.copyText = text || '';
}
function clearStructured(root) {
  const node = root.querySelector('[data-structured]');
  if (node) node.replaceChildren();
}
async function copyText(text, button) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = previous; }, 1400);
    return true;
  } catch {
    return false;
  }
}
function add(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  parent.appendChild(node);
  return node;
}
function link(parent, href, text) {
  const node = document.createElement('a');
  node.href = href;
  node.textContent = text;
  if (/^https?:\/\//.test(href)) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  parent.appendChild(node);
  return node;
}

function bindChrome(root) {
  root.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
    root.querySelectorAll('[data-field]').forEach((input) => {
      if (input.type === 'checkbox') input.checked = false;
      else if (input.tagName === 'SELECT') input.selectedIndex = 0;
      else input.value = '';
    });
    setError(root, '');
    setOutput(root, '');
    clearStructured(root);
    delete root.dataset.copyText;
  });
  root.querySelector('[data-action="example"]')?.addEventListener('click', () => {
    const sample = root.querySelector('[data-example]');
    const input = field(root, 'input') || field(root, 'json');
    if (sample && input) input.value = sample.value;
    const lockSample = root.querySelector('[data-example-lock]');
    const lock = field(root, 'lock');
    if (lockSample && lock) lock.value = lockSample.value;
    setError(root, '');
  });
  root.querySelector('[data-action="copy"]')?.addEventListener('click', async (event) => {
    const text = root.dataset.copyText || root.querySelector('[data-output]')?.textContent || '';
    if (!text.trim()) {
      setError(root, 'Nothing to copy yet.');
      return;
    }
    const ok = await copyText(text, event.currentTarget);
    if (!ok) setError(root, 'Could not copy automatically. Select the result and copy it from there.');
  });
  root.querySelector('[data-action="run"]')?.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('tool-run'));
  });
}

function showPhpFormat(root) {
  root.addEventListener('tool-run', () => {
    const result = formatPhp(value(root, 'input'));
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, result.output);
  });
}

function showPhpValidate(root) {
  root.addEventListener('tool-run', () => {
    const result = validatePhp(value(root, 'input'));
    const box = root.querySelector('[data-structured]');
    setOutput(root, '');
    if (!result.ok) { setError(root, result.error); clearStructured(root); return; }
    setError(root, '');
    box.replaceChildren();
    add(box, 'p', result.summary);
    if (!result.issues.length) add(box, 'p', 'No issues to list.');
    const list = add(box, 'ul');
    for (const issue of result.issues) {
      add(list, 'li', `Line ${issue.line}: ${issue.level === 'warning' ? 'Warning' : 'Error'}. ${issue.message}`);
    }
    root.dataset.copyText = [result.summary, ...result.issues.map((issue) => `Line ${issue.line}: ${issue.message}`)].join('\n');
  });
}

function showVersion(root) {
  root.addEventListener('tool-run', () => {
    const result = checkPhpVersion(value(root, 'input'), value(root, 'target'));
    const box = root.querySelector('[data-structured]');
    if (!result.ok) { setError(root, result.error); clearStructured(root); return; }
    setError(root, '');
    box.replaceChildren();
    const lines = [];
    add(box, 'p', result.highest
      ? `Highest listed feature in this snippet: PHP ${result.highest}. Target: PHP ${result.target}.`
      : `None of the listed features were found. Target: PHP ${result.target}. That is not proof the code runs on that version.`);
    lines.push(box.firstChild.textContent);
    if (result.removed.length) {
      add(box, 'h3', 'Removed calls');
      const list = add(box, 'ul');
      for (const item of result.removed) {
        const li = add(list, 'li', `Line ${item.line}: ${item.name}. ${item.note} `);
        link(li, item.url, 'php.net');
        if (item.evidence) add(li, 'div', item.evidence, 'meta');
        lines.push(`${item.name} line ${item.line}`);
      }
    }
    add(box, 'h3', 'Features noticed');
    if (!result.findings.length) add(box, 'p', 'No listed features.');
    const list = add(box, 'ul');
    for (const item of result.findings) {
      const li = add(list, 'li', `Line ${item.line}: ${item.name} needs PHP ${item.version}. ${item.aboveTarget ? 'Newer than the target.' : 'Within the target.'} `);
      link(li, item.url, 'php.net');
      if (item.evidence) add(li, 'div', item.evidence, 'meta');
      lines.push(`${item.name} PHP ${item.version} line ${item.line}`);
    }
    root.dataset.copyText = lines.join('\n');
  });
}

function showComposer(root) {
  root.addEventListener('tool-run', () => {
    const result = analyzeComposer(value(root, 'json'), value(root, 'lock'));
    const box = root.querySelector('[data-structured]');
    if (!result.ok) { setError(root, result.error); clearStructured(root); return; }
    setError(root, '');
    box.replaceChildren();
    const lines = [];
    if (result.warnings.length) {
      const list = add(box, 'ul');
      for (const warning of result.warnings) add(list, 'li', warning);
      lines.push(...result.warnings);
    }
    if (result.json) {
      add(box, 'h3', result.json.name || 'composer.json');
      if (result.json.description) add(box, 'p', result.json.description);
      if (result.json.php) add(box, 'p', `PHP constraint: ${result.json.php}`);
      const deps = add(box, 'ul');
      for (const dep of [...result.json.require, ...result.json.requireDev]) {
        add(deps, 'li', `${dep.name}: ${dep.constraint}`);
        lines.push(`${dep.name} ${dep.constraint}`);
      }
      if (result.json.scripts.length) {
        add(box, 'h3', 'Scripts (not run)');
        const scripts = add(box, 'ul');
        for (const script of result.json.scripts) add(scripts, 'li', `${script.event}: ${script.command}`);
      }
    }
    if (result.lock) {
      add(box, 'h3', `Lock file (${result.lock.count} packages${result.lock.truncated ? ', showing 200' : ''})`);
      if (result.lock.php) add(box, 'p', `Locked platform PHP: ${result.lock.php}`);
      const packages = add(box, 'ul');
      for (const pkg of result.lock.packages) add(packages, 'li', `${pkg.name} ${pkg.version}${pkg.dev ? ' (dev)' : ''}`);
    }
    if (result.missingFromLock.length) {
      add(box, 'h3', 'Required packages missing from the lock file');
      const missing = add(box, 'ul');
      for (const name of result.missingFromLock) add(missing, 'li', name);
    }
    root.dataset.copyText = lines.join('\n');
  });
}

function showHash(root) {
  root.addEventListener('tool-run', async () => {
    const result = await digestHex(value(root, 'algorithm'), value(root, 'input'));
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, `${result.algorithm}\n${result.output}\n\nThis is not password_hash() output.`);
  });
}

function showJson(root, space) {
  root.addEventListener('tool-run', () => {
    const result = formatJson(value(root, 'input'), space);
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, result.output);
  });
}

function showJwt(root) {
  root.addEventListener('tool-run', () => {
    const result = decodeJwt(value(root, 'input'));
    const box = root.querySelector('[data-structured]');
    setOutput(root, '');
    if (!result.ok) { setError(root, result.error); clearStructured(root); return; }
    setError(root, '');
    box.replaceChildren();
    for (const warning of result.warnings) add(box, 'p', warning, 'notice');
    add(box, 'h3', 'Header');
    add(box, 'pre', result.headerJson ? JSON.stringify(result.headerJson, null, 2) : result.headerText);
    add(box, 'h3', 'Payload (not verified)');
    add(box, 'pre', result.payloadJson ? JSON.stringify(result.payloadJson, null, 2) : result.payloadText);
    add(box, 'h3', 'Signature segment');
    add(box, 'pre', result.signature || '(empty)');
    root.dataset.copyText = `Signature not verified.\n${result.headerText}\n${result.payloadText}`;
  });
}

function showSql(root) {
  root.addEventListener('tool-run', () => {
    const result = formatSql(value(root, 'input'));
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, result.output);
  });
}

function showRegex(root) {
  root.addEventListener('tool-run', () => {
    const pattern = value(root, 'pattern');
    const flags = value(root, 'flags');
    const text = value(root, 'input');
    const box = root.querySelector('[data-structured]');
    setError(root, '');
    clearStructured(root);
    let worker;
    try { worker = new Worker('/regex-worker.js'); }
    catch { setError(root, 'Could not start the local regex worker.'); return; }
    const timer = setTimeout(() => {
      worker.terminate();
      setError(root, 'Stopped: the pattern took too long. It was not sent anywhere.');
    }, 800);
    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker.terminate();
      const result = event.data || {};
      if (!result.ok) { setError(root, result.error); return; }
      add(box, 'p', result.matches.length ? `${result.matches.length} match${result.matches.length === 1 ? '' : 'es'} with JavaScript RegExp.` : 'No matches.');
      const list = add(box, 'ul');
      for (const match of result.matches) {
        add(list, 'li', `Index ${match.index}: ${match.value}${match.groups?.length ? ` (groups: ${match.groups.join(', ')})` : ''}`);
      }
      if (result.truncated) add(box, 'p', 'Only the first 100 matches are shown.');
      root.dataset.copyText = result.matches.map((match) => `${match.index}: ${match.value}`).join('\n');
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      setError(root, 'The regex worker failed before it finished.');
    };
    worker.postMessage({ pattern, flags, text });
  });
}

function showCron(root) {
  root.addEventListener('tool-run', () => {
    const preset = value(root, 'preset');
    const custom = value(root, 'custom').trim();
    const built = [value(root, 'minute'), value(root, 'hour'), value(root, 'dom'), value(root, 'month'), value(root, 'dow')].join(' ');
    const expr = custom || (preset && preset !== 'custom' ? preset : built);
    const described = describeCron(expr);
    const box = root.querySelector('[data-structured]');
    if (!described.ok) { setError(root, described.error); clearStructured(root); return; }
    const upcoming = nextCronRuns(expr, new Date(), 5);
    setError(root, '');
    box.replaceChildren();
    add(box, 'p', `Expression: ${described.normalized}`);
    const list = add(box, 'ul');
    for (const item of described.fields) add(list, 'li', `${item.name} (${item.raw}): ${item.matches}`);
    if (described.note) add(box, 'p', described.note);
    add(box, 'h3', 'Next times on this computer');
    if (!upcoming.runs?.length) add(box, 'p', 'No matching time in the next year. Check the day and month.');
    else {
      const times = add(box, 'ol');
      for (const date of upcoming.runs) add(times, 'li', date.toLocaleString());
    }
    root.dataset.copyText = described.normalized;
  });
  field(root, 'preset')?.addEventListener('change', () => {
    const preset = value(root, 'preset');
    const custom = field(root, 'custom');
    if (custom && preset && preset !== 'custom') custom.value = preset;
  });
}

function showBase64(root) {
  root.addEventListener('tool-run', () => {
    const result = value(root, 'mode') === 'decode' ? decodeBase64(value(root, 'input')) : encodeBase64(value(root, 'input'));
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, result.output);
  });
}

function showUrl(root) {
  root.addEventListener('tool-run', () => {
    const result = transformUrl(value(root, 'input'), value(root, 'mode'), value(root, 'scope'));
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    setOutput(root, result.output);
  });
}

function showCurl(root) {
  root.addEventListener('tool-run', () => {
    const result = buildCurl({
      method: value(root, 'method'),
      url: value(root, 'url'),
      headers: value(root, 'headers'),
      body: value(root, 'body'),
      follow: field(root, 'follow')?.checked,
      include: field(root, 'include')?.checked,
      compressed: field(root, 'compressed')?.checked,
      insecure: field(root, 'insecure')?.checked,
    });
    if (!result.ok) { setError(root, result.error); setOutput(root, ''); return; }
    setError(root, '');
    const note = result.output.includes('--insecure') ? '\n\nNote: --insecure tells curl to skip TLS verification. The request was not sent.' : '';
    setOutput(root, result.output + note);
  });
}

function showArtisan(root) {
  const input = field(root, 'query');
  const empty = root.querySelector('[data-empty]');
  const apply = () => {
    const query = value(root, 'query').trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('[data-command]').forEach((card) => {
      const visible = !query || card.dataset.command.includes(query) || card.textContent.toLowerCase().includes(query);
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
  };
  input?.addEventListener('input', apply);
  root.querySelectorAll('[data-copy-command]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await copyText(button.dataset.copyCommand, button);
      if (!ok) setError(root, 'Could not copy automatically.');
    });
  });
}

function showStatus(root) {
  const input = field(root, 'query');
  const empty = root.querySelector('[data-empty]');
  input?.addEventListener('input', () => {
    const query = value(root, 'query').trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('[data-status]').forEach((row) => {
      const visible = !query || row.dataset.status.includes(query) || row.textContent.toLowerCase().includes(query);
      row.hidden = !visible;
      if (visible) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
  });
}

const COOKIE_STATUS = { pass: 'Pass', warn: 'Warn', fail: 'Fail', info: 'Info' };
function showCookies(root) {
  root.addEventListener('tool-run', () => {
    const result = checkCookies(value(root, 'input'));
    const box = root.querySelector('[data-structured]');
    setOutput(root, '');
    if (!result.ok) { setError(root, result.error); clearStructured(root); return; }
    setError(root, '');
    box.replaceChildren();
    const lines = [];
    const counts = { pass: 0, warn: 0, fail: 0 };
    for (const r of result.results) counts[r.status] += 1;
    add(box, 'p', `${result.results.length} cookie${result.results.length === 1 ? '' : 's'} checked: ${counts.fail} fail, ${counts.warn} warn, ${counts.pass} pass.`, 'cookie-summary');
    for (const r of result.results) {
      const head = add(box, 'h3', r.name || '(no name)', 'cookie-name');
      add(head, 'span', COOKIE_STATUS[r.status], `cookie-badge is-${r.status}`);
      if (r.kind === 'session') add(box, 'p', 'Likely a session cookie. Treat it like a password.', 'cookie-note');
      if (r.kind === 'xsrf') add(box, 'p', 'Laravel CSRF cookie. It is meant to be readable by JavaScript.', 'cookie-note');
      const wrap = add(box, 'div', null, 'cookie-table-wrap');
      const table = add(wrap, 'table', null, 'cookie-table');
      const hrow = add(add(table, 'thead'), 'tr');
      for (const h of ['Check', 'Result', 'What it means and how to fix it']) add(hrow, 'th', h).scope = 'col';
      const body = add(table, 'tbody');
      lines.push(`${r.name || '(no name)'}: ${COOKIE_STATUS[r.status]}`);
      for (const c of r.checks) {
        const tr = add(body, 'tr');
        add(tr, 'th', c.label).scope = 'row';
        add(add(tr, 'td'), 'span', COOKIE_STATUS[c.status], `cookie-badge is-${c.status}`);
        const td = add(tr, 'td', c.detail);
        if (c.tip) add(td, 'div', `Fix: ${c.tip}`, 'cookie-tip');
        lines.push(`  ${c.label}: ${COOKIE_STATUS[c.status]}. ${c.detail}${c.tip ? ` Fix: ${c.tip}` : ''}`);
      }
      if (r.unknown.length) add(box, 'p', `Other attributes not checked: ${r.unknown.join(', ')}.`, 'meta');
    }
    root.dataset.copyText = lines.join('\n');
  });
}

const runners = {
  'php-formatter': showPhpFormat,
  'php-code-validator': showPhpValidate,
  'php-version-compat': showVersion,
  'composer-analyzer': showComposer,
  'php-hash-generator': showHash,
  'json-formatter': (root) => showJson(root, 2),
  'json-minifier': (root) => showJson(root, 0),
  'jwt-decoder': showJwt,
  'sql-formatter': showSql,
  'regex-tester': showRegex,
  'cron-generator': showCron,
  base64: showBase64,
  'url-encoder': showUrl,
  'curl-builder': showCurl,
  'laravel-artisan-reference': showArtisan,
  'http-status-codes': showStatus,
  'session-cookie-checker': showCookies,
};

export function bootTools(root = document) {
  const app = root.querySelector('[data-tool]');
  if (!app || app.dataset.ready === '1') return;
  app.dataset.ready = '1';
  bindChrome(app);
  runners[app.dataset.tool]?.(app);
}
