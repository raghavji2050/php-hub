// Checks that internal href/src links in dist/**/*.html resolve to files in dist.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist'; const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } };
walk(dist);
const ok = u => { let p = decodeURI(u.split(/[?#]/)[0]); if (!p || p === '/') p = '/index.html';
  const c = [join(dist, p), join(dist, p, 'index.html'), join(dist, p + '.html')]; return c.some(x => existsSync(x) && statSync(x).isFile()); };
let bad = 0;
for (const f of files) { const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(/(?:href|src)="(\/[^"\/][^"]*|\/)"/g)) { const u = m[1]; if (u.startsWith('/_vercel/')) continue; if (!ok(u)) { bad++; console.error(`BROKEN ${f} -> ${u}`); } } }
console.log(`Checked ${files.length} pages; broken internal links: ${bad}`); process.exit(bad ? 1 : 0);
