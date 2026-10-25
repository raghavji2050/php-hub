import rss from '@astrojs/rss';
import { allPosts, SITE } from '../lib.js';
export function GET(context) {
  return rss({ title: 'PHP Hub', description: SITE.description, site: context.site,
    items: allPosts().map(p => ({ title: p.title, link: p.url, description: p.summary, pubDate: p.date ? new Date(p.date + 'T00:00:00+05:30') : undefined, categories: p.tags })) });
}
