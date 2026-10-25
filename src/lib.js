const all = {
  briefs: import.meta.glob('./content/briefs/*.md', { eager: true }),
  articles: import.meta.glob('./content/articles/*.md', { eager: true }),
  lessons: import.meta.glob('./content/lessons/*.md', { eager: true }),
};
const raw = import.meta.glob('./content/*/*.md', { eager: true, query: '?raw', import: 'default' });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d) { const [y, m, day] = d.split('-'); return m ? `${+day} ${MONTHS[+m - 1]} ${y}` : d; }
// Summary = frontmatter `summary`, else first plain paragraph of the body (no invented text).
function summarize(src = '') {
  const body = src.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*$/gm, '');
  const para = body.split(/\n\s*\n/).map(s => s.trim()).find(s => s && !/^[#*>\-|`]/.test(s) && !/^\d+\./.test(s));
  if (!para) return '';
  const text = para.replace(/\*\*|\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
  return text.length > 200 ? text.slice(0, 197).replace(/\s+\S*$/, '') + '…' : text;
}
export function list(section) {
  return Object.entries(all[section]).map(([p, m]) => {
    const slug = p.split('/').pop().replace(/\.md$/, '');
    const fm = m.frontmatter || {};
    const h1 = (m.getHeadings?.() || []).find(h => h.depth === 1);
    const date = /^\d{4}-\d{2}-\d{2}/.test(slug) ? slug.slice(0, 10) : '';
    return { slug, title: fm.title || h1?.text || slug, date, dateLabel: date ? fmtDate(date) : '',
      summary: fm.summary || summarize(raw[p]), severity: fm.severity || '', status: fm.status || '', Content: m.Content };
  }).sort((a, b) => b.slug.localeCompare(a.slug));
}
