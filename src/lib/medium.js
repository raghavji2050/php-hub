// Latest posts from https://medium.com/@raghavji2050, read from the public RSS feed at
// build time. If Medium is slow or blocks the build server, the committed snapshot in
// src/data/medium-fallback.json is used, so the build never fails. Titles, URLs and dates
// always come from the feed; nothing is written by hand.
import fallback from '../data/medium-fallback.json' with { type: 'json' };

export const MEDIUM_PROFILE = 'https://medium.com/@raghavji2050';
const FEED = 'https://medium.com/feed/@raghavji2050';
// Posts tagged with any of these are picked first, because PHP Hub is a developer site;
// other posts only top the list up to the minimum. The final list is newest first.
const DEV_TAGS = ['php', 'laravel', 'wordpress', 'symfony', 'security', 'cybersecurity', 'web-development', 'programming', 'software-development', 'nodejs', 'javascript', 'devops'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const decode = (s = '') => s
  .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  .trim();
const tag = (xml, name) => decode((xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1] || '');

export function parseMediumFeed(xml) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const title = tag(body, 'title');
    const link = tag(body, 'link').split('?')[0];
    const pub = Date.parse(tag(body, 'pubDate'));
    const categories = [...body.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((c) => decode(c[1]).toLowerCase());
    if (!title || !/^https:\/\/medium\.com\/@raghavji2050\//.test(link) || Number.isNaN(pub)) continue;
    items.push({ title, url: link, published: new Date(pub).toISOString(), categories });
  }
  return items;
}

// Date in India time, because that is where the posts are written.
function istDate(iso) {
  const d = new Date(Date.parse(iso) + 330 * 60 * 1000);
  return { date: d.toISOString().slice(0, 10), dateLabel: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
}

export function selectMediumPosts(items, { min = 4, max = 6 } = {}) {
  const byDate = [...items].sort((a, b) => b.published.localeCompare(a.published));
  const isDev = (item) => item.categories.some((c) => DEV_TAGS.includes(c));
  const dev = byDate.filter(isDev);
  const rest = byDate.filter((item) => !isDev(item));
  const chosen = [...dev.slice(0, max), ...rest.slice(0, Math.max(0, min - dev.length))];
  return chosen
    .sort((a, b) => b.published.localeCompare(a.published))
    .map((item) => ({ ...item, ...istDate(item.published) }));
}

export async function getMediumPosts() {
  let items = [];
  let source = 'feed';
  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'php-hub-build (+https://php-hub-rj.vercel.app)' } });
    if (res.ok) items = parseMediumFeed(await res.text());
  } catch {
    items = [];
  }
  if (items.length === 0) { items = fallback.items; source = 'fallback'; }
  return { posts: selectMediumPosts(items), source };
}
