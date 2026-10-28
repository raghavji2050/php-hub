const all = {
  briefs: import.meta.glob('./content/briefs/*.md', { eager: true }),
  articles: import.meta.glob('./content/articles/*.md', { eager: true }),
  lessons: import.meta.glob('./content/lessons/*.md', { eager: true }),
};
const raw = import.meta.glob('./content/*/*.md', { eager: true, query: '?raw', import: 'default' });
export const SITE = { url: 'https://php-hub-rj.vercel.app', name: 'PHP Hub', description: 'Practical PHP and WordPress security briefs, articles, lessons and tools.' };
export const SECTIONS = ['briefs', 'articles', 'lessons'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d) { const [y, m, day] = d.split('-'); return m ? `${+day} ${MONTHS[+m - 1]} ${y}` : d; }
const stripFm = (s = '') => s.replace(/^---[\s\S]*?---\s*/, '');
// Summary = frontmatter `summary`, else first plain paragraph of the body (no invented text).
function summarize(src = '') {
  const body = stripFm(src).replace(/^#.*$/gm, '');
  const para = body.split(/\n\s*\n/).map(s => s.trim()).find(s => s && !/^[#*>\-|`]/.test(s) && !/^\d+\./.test(s));
  if (!para) return '';
  const text = para.replace(/\*\*|\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
  return text.length > 200 ? text.slice(0, 197).replace(/\s+\S*$/, '') + '…' : text;
}
export const slugify = (t) => String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function list(section) {
  return Object.entries(all[section]).map(([p, m]) => {
    const slug = p.split('/').pop().replace(/\.md$/, '');
    const fm = m.frontmatter || {};
    const headings = m.getHeadings?.() || [];
    const h1 = headings.find(h => h.depth === 1);
    const date = /^\d{4}-\d{2}-\d{2}/.test(slug) ? slug.slice(0, 10) : (fm.date ? String(fm.date).slice(0, 10) : '');
    const words = stripFm(raw[p]).split(/\s+/).filter(Boolean).length;
    const tags = [...(Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : []), ...(fm.category ? [fm.category] : [])].map(String);
    return { section, slug, url: `/${section}/${slug}`, title: fm.title || h1?.text || slug, date, dateLabel: date ? fmtDate(date) : '',
      summary: fm.summary || fm.description || summarize(raw[p]), canonical: fm.canonical || '', severity: fm.severity || '', status: fm.status || '', tags,
      readingTime: Math.max(1, Math.round(words / 220)), headings: headings.filter(h => h.depth === 2 || h.depth === 3), Content: m.Content };
  }).sort((a, b) => b.slug.localeCompare(a.slug));
}
export const allPosts = () => SECTIONS.flatMap(list).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
export function allTags() {
  const map = new Map();
  for (const p of allPosts()) for (const t of p.tags) { const k = slugify(t); if (!map.has(k)) map.set(k, { slug: k, name: t, posts: [] }); map.get(k).posts.push(p); }
  return [...map.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}
export function related(post, n = 3) {
  return allPosts().filter(p => p.url !== post.url)
    .map(p => ({ p, score: p.tags.filter(t => post.tags.includes(t)).length + (p.section === post.section ? 0.5 : 0) }))
    .filter(x => x.score >= 1).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.p);
}
