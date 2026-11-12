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

test('only dev-tagged posts are shown, newest first, with India dates', () => {
  const posts = selectMediumPosts(parseMediumFeed(feed));
  assert.deepEqual(posts.map((p) => p.title), ['Dev post & more']);
  assert.equal(posts[0].dateLabel, '12 Nov 2026');
});

test('committed fallback snapshot holds only dev posts', () => {
  const posts = selectMediumPosts(fallback.items);
  assert.ok(posts.length >= 1 && posts.length <= 6);
  assert.equal(posts.length, fallback.items.length);
  for (const p of posts) assert.match(p.url, /^https:\/\/medium\.com\/@raghavji2050\//);
});
