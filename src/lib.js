const all = {
  briefs: import.meta.glob('./content/briefs/*.md', { eager: true }),
  articles: import.meta.glob('./content/articles/*.md', { eager: true }),
  lessons: import.meta.glob('./content/lessons/*.md', { eager: true }),
};
export function list(section) {
  return Object.entries(all[section]).map(([p, m]) => {
    const slug = p.split('/').pop().replace(/\.md$/, '');
    const h1 = (m.getHeadings?.() || []).find(h => h.depth === 1);
    return { slug, title: m.frontmatter?.title || h1?.text || slug, date: slug.slice(0, 10), Content: m.Content };
  }).sort((a, b) => b.slug.localeCompare(a.slug));
}
