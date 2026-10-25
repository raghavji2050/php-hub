# PHP Hub

Static site for PHP security briefs, articles, lessons and tools. Site code lives on branch `site-v1` (PR).

## Develop
`npm install && npm run build` → static output in `dist/`.

## Add content
Drop Markdown files into `src/content/briefs`, `src/content/articles` or `src/content/lessons`, named `YYYY-MM-DD-slug.md`. Title comes from frontmatter `title` or the first `# H1`.
