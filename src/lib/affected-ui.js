import { BRIEF_ADVISORIES, SAMPLE_COMPOSER_LOCK } from '../data/brief-advisories.js';
import { parseComposerLock, evaluateAdvisories } from './composer-matcher.js';

const STORAGE_KEY = 'phphub_stack_v1';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadSavedStack() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.packages !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

function saveStack(packages, phpVersion) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ packages, phpVersion: phpVersion || '', savedAt: new Date().toISOString() })
    );
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function clearSavedStack() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function attachCopyButtons(root) {
  root.querySelectorAll('[data-copy-cmd]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cmd = btn.getAttribute('data-copy-cmd') || '';
      try {
        await navigator.clipboard.writeText(cmd);
        const orig = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      } catch {
        // Fallback ignored
      }
    });
  });
}

function syncNewsletterTags(stackTags) {
  const host = document.getElementById('stack-nl-tags');
  const preview = document.getElementById('stack-nl-tag-preview');
  if (!host) return;
  const tags = Array.isArray(stackTags) && stackTags.length ? stackTags : ['am-i-affected'];
  host.innerHTML = tags.map((t) => `<input type="hidden" name="tag" value="${esc(t)}" />`).join('');
  if (preview) {
    const readable = tags.filter((t) => t !== 'am-i-affected').map((t) => t.replace(/^stack-/, ''));
    preview.textContent = readable.length
      ? `Detected stack tags for your weekly alert: ${readable.join(', ')}.`
      : 'Paste your composer.lock above to attach your stack tags (e.g. Laravel, Symfony) to your weekly brief subscription.';
  }
}

function renderResults(container, res, phpVersion) {
  const { summary, affected, safe, byBrief, stackTags } = res;
  syncNewsletterTags(stackTags);

  const affectedHtml = affected.length
    ? `<div class="aff-group">
        <h2>Affected in your stack (${affected.length})</h2>
        <div class="aff-list">
          ${affected.map((item) => `
            <article class="aff-card is-affected">
              <div class="aff-head">
                <span class="aff-pill is-affected">Affected</span>
                <span class="aff-sev">${esc(item.severity)}</span>
                <strong><code>${esc(item.package)}</code></strong>
                <span class="aff-ver">installed <code>${esc(item.installed)}</code> · fixed in <code>${esc(item.fixed)}</code></span>
              </div>
              <p class="aff-desc">${esc(item.summary)} <small>(${esc(item.id)})</small></p>
              <div class="aff-fix">
                <code>${esc(item.fixCommand)}</code>
                <button type="button" class="btn secondary aff-copy" data-copy-cmd="${esc(item.fixCommand)}">Copy</button>
                <a class="aff-link" href="${esc(item.briefUrl)}">Read brief →</a>
              </div>
            </article>
          `).join('')}
        </div>
      </div>`
    : `<div class="notice aff-ok" role="status">
        <strong>No matched vulnerabilities in your stack.</strong> None of your ${summary.totalPackages} scanned package${summary.totalPackages === 1 ? '' : 's'}${phpVersion ? ` (plus PHP ${esc(phpVersion)})` : ''} matched an affected range in PHP Hub's briefs.
      </div>`;

  const safeHtml = safe.length
    ? `<div class="aff-group">
        <h2>Checked &amp; safe in your stack (${safe.length})</h2>
        <div class="aff-list">
          ${safe.map((item) => `
            <article class="aff-card is-safe">
              <div class="aff-head">
                <span class="aff-pill is-safe">Safe</span>
                <strong><code>${esc(item.package)}</code></strong>
                <span class="aff-ver">installed <code>${esc(item.installed)}</code> · fixed in <code>${esc(item.fixed)}</code></span>
              </div>
              <p class="aff-desc">${esc(item.summary)} <a href="${esc(item.briefUrl)}">Brief</a></p>
            </article>
          `).join('')}
        </div>
      </div>`
    : '';

  const feedHtml = `<div class="aff-group">
    <h2>Your personalized brief feed</h2>
    <ul class="aff-feed">
      ${byBrief.map((b) => {
        const label = b.status === 'affected'
          ? `Affected (${b.affectedItems.length})`
          : b.status === 'safe'
            ? `Safe (${b.safeItems.length} matched)`
            : 'Not in your stack';
        const cls = b.status === 'affected' ? 'is-affected' : b.status === 'safe' ? 'is-safe' : 'is-none';
        return `<li>
          <span class="aff-pill ${cls}">${label}</span>
          <a href="${esc(b.briefUrl)}">${esc(b.briefTitle)}</a>
          <time datetime="${esc(b.briefDate)}">${esc(b.briefDate)}</time>
        </li>`;
      }).join('')}
    </ul>
  </div>`;

  container.innerHTML = `
    <div class="aff-summary" role="status">
      <div><b>${summary.briefsAffected}</b><span>Briefs affecting you</span></div>
      <div><b>${summary.affectedCount}</b><span>Vulnerable packages</span></div>
      <div><b>${summary.safeCount}</b><span>Patched matches</span></div>
      <div><b>${summary.totalPackages}</b><span>Packages scanned</span></div>
    </div>
    ${affectedHtml}
    ${safeHtml}
    ${feedHtml}
  `;
  attachCopyButtons(container);
}

export function initAffectedPage() {
  const textarea = document.getElementById('lockfile-input');
  const fileInput = document.getElementById('lockfile-file');
  const phpInput = document.getElementById('php-version-input');
  const checkBtn = document.getElementById('check-stack-btn');
  const sampleBtn = document.getElementById('sample-stack-btn');
  const clearBtn = document.getElementById('clear-stack-btn');
  const errorBox = document.getElementById('lockfile-error');
  const resultsBox = document.getElementById('affected-results');
  if (!textarea || !resultsBox) return;

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }

  function runCheck(packages, phpVer, persist = true) {
    showError('');
    if (persist) saveStack(packages, phpVer);
    const res = evaluateAdvisories(packages, BRIEF_ADVISORIES, phpVer);
    renderResults(resultsBox, res, phpVer);
    if (clearBtn) clearBtn.hidden = false;
  }

  checkBtn?.addEventListener('click', () => {
    const parsed = parseComposerLock(textarea.value);
    if (!parsed.ok) {
      showError(parsed.error);
      return;
    }
    const phpVer = (phpInput?.value || parsed.detectedPhp || '').trim();
    if (phpInput && !phpInput.value && parsed.detectedPhp) phpInput.value = parsed.detectedPhp;
    runCheck(parsed.packages, phpVer, true);
  });

  sampleBtn?.addEventListener('click', () => {
    textarea.value = SAMPLE_COMPOSER_LOCK;
    if (phpInput && !phpInput.value) phpInput.value = '8.4.26';
    const parsed = parseComposerLock(SAMPLE_COMPOSER_LOCK);
    if (parsed.ok) runCheck(parsed.packages, phpInput?.value || '8.4.26', true);
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      textarea.value = text;
      const parsed = parseComposerLock(text);
      if (!parsed.ok) {
        showError(parsed.error);
        return;
      }
      const phpVer = (phpInput?.value || parsed.detectedPhp || '').trim();
      runCheck(parsed.packages, phpVer, true);
    } catch {
      showError('Could not read the selected file.');
    }
  });

  clearBtn?.addEventListener('click', () => {
    clearSavedStack();
    textarea.value = '';
    if (phpInput) phpInput.value = '';
    resultsBox.innerHTML = '';
    showError('');
    clearBtn.hidden = true;
    syncNewsletterTags([]);
  });

  const saved = loadSavedStack();
  if (saved) {
    if (phpInput && saved.phpVersion) phpInput.value = saved.phpVersion;
    runCheck(saved.packages, saved.phpVersion, false);
  } else {
    syncNewsletterTags([]);
  }
}

export function initBriefStatusBanner() {
  const el = document.getElementById('brief-stack-status');
  if (!el) return;
  const slug = el.getAttribute('data-brief-slug') || '';
  const saved = loadSavedStack();

  if (!saved) {
    el.innerHTML = `<div class="stack-bar">
      <span><strong>Am I affected?</strong> Paste your <code>composer.lock</code> (runs in your browser) to see if ${slug ? 'this brief affects' : 'these briefs affect'} your stack.</span>
      <a class="btn secondary" href="/am-i-affected">Check my stack</a>
    </div>`;
    return;
  }

  const res = evaluateAdvisories(saved.packages, BRIEF_ADVISORIES, saved.phpVersion);

  if (slug) {
    const brief = res.byBrief.find((b) => b.briefSlug === slug);
    if (!brief) {
      el.innerHTML = `<div class="stack-bar">
        <span>Saved stack loaded (${res.summary.totalPackages} packages). This brief has no Composer package ranges mapped yet.</span>
        <a href="/am-i-affected">View full feed</a>
      </div>`;
      return;
    }
    if (brief.status === 'affected') {
      const items = brief.affectedItems.map((i) => `<code>${esc(i.package)}</code> (${esc(i.installed)} → fix ${esc(i.fixed)})`).join(', ');
      el.innerHTML = `<div class="stack-bar is-affected" role="status">
        <span><span class="aff-pill is-affected">Affected</span> Your saved stack matches: ${items}.</span>
        <a class="btn secondary" href="/am-i-affected">See fix commands</a>
      </div>`;
    } else if (brief.status === 'safe') {
      el.innerHTML = `<div class="stack-bar is-safe" role="status">
        <span><span class="aff-pill is-safe">Safe</span> Your saved stack's matched package versions are outside the affected ranges in this brief.</span>
        <a href="/am-i-affected">Update stack</a>
      </div>`;
    } else {
      el.innerHTML = `<div class="stack-bar" role="status">
        <span><span class="aff-pill is-none">Not in your stack</span> None of the Composer packages in this brief appeared in your saved <code>composer.lock</code>.</span>
        <a href="/am-i-affected">Update stack</a>
      </div>`;
    }
    return;
  }

  // Index page (/briefs): summary bar + per-card badges
  el.innerHTML = `<div class="stack-bar ${res.summary.briefsAffected ? 'is-affected' : 'is-safe'}" role="status">
    <span><strong>Your stack (${res.summary.totalPackages} packages):</strong> ${res.summary.briefsAffected} brief${res.summary.briefsAffected === 1 ? '' : 's'} affecting you, ${res.summary.briefsSafe} safe.</span>
    <a class="btn secondary" href="/am-i-affected">Open full matcher</a>
  </div>`;
}
