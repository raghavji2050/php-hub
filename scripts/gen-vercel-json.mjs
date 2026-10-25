// Generates vercel.json security headers. Form/newsletter endpoint origins are read from env
// (PUBLIC_CONTACT_ENDPOINT, PUBLIC_NEWSLETTER_ENDPOINT) and allowed in form-action/connect-src.
import { writeFileSync } from 'node:fs';
const origin = (u) => { try { return u ? new URL(u).origin : ''; } catch { return ''; } };
const extra = [process.env.PUBLIC_CONTACT_ENDPOINT, process.env.PUBLIC_NEWSLETTER_ENDPOINT].map(origin).filter(Boolean);
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
  "upgrade-insecure-requests",
].join('; ');
const config = {
  headers: [{ source: '/(.*)', headers: [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  ] }],
};
writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log('vercel.json written; extra origins:', ext || '(none)');
