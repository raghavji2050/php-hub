import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMediumFeed, selectMediumPosts } from '../src/lib/medium.js';
import fallback from '../src/data/medium-fallback.json' with { type: 'json' };

const feed = `<rss><channel>
<item><title><![CDATA[Dev post &amp; more]]></title><link>https://medium.com/@raghavji2050/dev-1?source=rss</link><category><![CDATA[laravel]]></category><pubDate>Wed, 11 Nov 2026 20:00:00 GMT</pubDate></item>
<item><title><![CDATA[Money post]]></title><link>https://medium.com/@raghavji2050/money-1?source=rss</link><category><![CDATA[budgeting]]></category><pubDate>Thu, 12 Nov 2026 05:00:00 GMT</pubDate></item>
<item><title><![CDATA[Elsewhere]]></title><link>https://example.com/x</link><pubDate>Thu, 12 Nov 2026 05:00:00 GMT</pubDate></item>
</channel></rss>`;

test('Medium feed parser keeps only real Medium links and strips tracking', () => {
  const items = parseMediumFeed(feed);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Dev post & more');
  assert.equal(items[0].url, 'https://medium.com/@raghavji2050/dev-1');
});

test('dev posts are picked first, others top up to the minimum, newest first, India dates', () => {
  const items = parseMediumFeed(feed);
  assert.deepEqual(selectMediumPosts(items, { min: 1, max: 6 }).map((p) => p.title), ['Dev post & more']);
  const posts = selectMediumPosts(items, { min: 2, max: 6 });
  assert.deepEqual(posts.map((p) => p.title), ['Money post', 'Dev post & more']);
  assert.equal(posts[1].dateLabel, '12 Nov 2026');
});

test('committed fallback snapshot is valid and yields 4 to 6 posts', () => {
  const posts = selectMediumPosts(fallback.items);
  assert.ok(posts.length >= 4 && posts.length <= 6);
  for (const p of posts) assert.match(p.url, /^https:\/\/medium\.com\/@raghavji2050\//);
});
