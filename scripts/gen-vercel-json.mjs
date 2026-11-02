// Generates vercel.json security headers. Form/newsletter endpoint origins are read from env
// (PUBLIC_CONTACT_ENDPOINT, PUBLIC_NEWSLETTER_ENDPOINT) and allowed in form-action/connect-src.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONTACT_ENDPOINT = 'https://formspree.io/f/mzeeeojy';

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.production');

const origin = (u) => { try { return u ? new URL(u).origin : ''; } catch { return ''; } };
const contact = process.env.PUBLIC_CONTACT_ENDPOINT || DEFAULT_CONTACT_ENDPOINT;
const extra = [contact, process.env.PUBLIC_NEWSLETTER_ENDPOINT].map(origin).filter(Boolean);
const ext = [...new Set(extra)].join(' ');
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",          // Pagefind uses WebAssembly
  "style-src 'self' 'unsafe-inline'",               // Astro scoped styles are inlined
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${ext ? ' ' + ext : ''}`,
  `form-action 'self'${ext ? ' ' + ext : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join('; ');
const config = {
  redirects: [{ source: '/sitemap.xml', destination: '/sitemap-index.xml', permanent: true }],
  headers: [{ source: '/(.*)', headers: [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()' },
  ] }],
};
writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log('vercel.json written; extra origins:', ext || '(none)');
