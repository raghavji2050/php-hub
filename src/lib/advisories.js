const SOURCES = [
  {
    id: 'php',
    name: 'PHP',
    page: 'https://github.com/php/php-src/security',
    url: 'https://api.github.com/repos/php/php-src/security-advisories?state=published&per_page=8',
    kind: 'github',
  },
  {
    id: 'laravel',
    name: 'Laravel framework',
    page: 'https://github.com/laravel/framework/security',
    url: 'https://api.github.com/repos/laravel/framework/security-advisories?state=published&per_page=8',
    kind: 'github',
  },
  {
    id: 'symfony',
    name: 'Symfony',
    page: 'https://github.com/symfony/symfony/security',
    url: 'https://api.github.com/repos/symfony/symfony/security-advisories?state=published&per_page=8',
    kind: 'github',
  },
  {
    id: 'wordpress',
    name: 'WordPress security news',
    page: 'https://wordpress.org/news/category/security/',
    url: 'https://wordpress.org/news/category/security/feed/',
    kind: 'rss',
  },
];

function textOf(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseRss(xml) {
  const items = [];
  for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = textOf(block, 'title');
    const href = textOf(block, 'link');
    const published = textOf(block, 'pubDate');
    if (!title || !/^https?:\/\//.test(href)) continue;
    items.push({ title, href, published, severity: '', packages: [] });
    if (items.length === 8) break;
  }
  return items;
}

function parseGithub(payload) {
  if (!Array.isArray(payload)) return [];
  const items = [];
  for (const row of payload) {
    const title = typeof row.summary === 'string' ? row.summary.trim() : '';
    const href = typeof row.html_url === 'string' ? row.html_url : '';
    if (!title || !/^https:\/\/github\.com\//.test(href)) continue;
    const packages = [];
    if (Array.isArray(row.vulnerabilities)) {
      for (const vuln of row.vulnerabilities) {
        const name = vuln?.package?.name;
        if (typeof name !== 'string' || !name) continue;
        packages.push({
          name,
          range: typeof vuln.vulnerable_version_range === 'string' ? vuln.vulnerable_version_range : '',
          patched: typeof vuln.patched_versions === 'string' ? vuln.patched_versions : '',
        });
      }
    }
    items.push({
      title,
      href,
      published: typeof row.published_at === 'string' ? row.published_at : '',
      severity: typeof row.severity === 'string' ? row.severity : '',
      cve: typeof row.cve_id === 'string' ? row.cve_id : '',
      ghsa: typeof row.ghsa_id === 'string' ? row.ghsa_id : '',
      packages,
    });
  }
  return items;
}

async function loadSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: source.kind === 'github'
        ? { Accept: 'application/vnd.github+json', 'User-Agent': 'PHP-Hub-Static-Site', 'X-GitHub-Api-Version': '2022-11-28' }
        : { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'PHP-Hub-Static-Site' },
    });
    if (!response.ok) {
      return { ...source, ok: false, error: `The source returned HTTP ${response.status}.`, items: [] };
    }
    const items = source.kind === 'github' ? parseGithub(await response.json()) : parseRss(await response.text());
    return { ...source, ok: true, error: '', items };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'The request timed out.' : 'The source could not be reached.';
    return { ...source, ok: false, error: message, items: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadExternalAdvisories() {
  const fetchedAt = new Date().toISOString();
  const sources = await Promise.all(SOURCES.map(loadSource));
  return { fetchedAt, sources };
}
