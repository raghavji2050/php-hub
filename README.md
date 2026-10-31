# PHP Hub

English-only site with security briefs, lessons and articles for PHP, Laravel, Symfony and WordPress developers and site owners.

**Live:** https://php-hub-rj.vercel.app

## Features
- **SecureStack security briefs**, plus lessons and articles sections
- **SEO:** sitemap, RSS, meta tags and canonicals; Google Search Console verified
- **Performance & accessibility:** Lighthouse mobile 100, accessibility work, custom 404 page
- Services, About, Privacy and Terms pages
- Contact form via Formspree with honeypot spam protection
- Related posts and CTAs on posts; newsletter coming soon

## Tech stack
- [Astro](https://astro.build) (static site)
- Deployed on [Vercel](https://vercel.com)
- Formspree (contact form)

## Develop
`npm install && npm run build` → static output in `dist/`.

## Add content
Drop Markdown files into `src/content/briefs`, `src/content/articles` or `src/content/lessons`, named `YYYY-MM-DD-slug.md`. Title comes from frontmatter `title` or the first `# H1`.

## Related
- [PHP Security Checker](https://php-security-checker.vercel.app): check any PHP version for known CVEs, support status and the fixed version.

## License
[MIT](LICENSE)
