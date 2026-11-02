// Resolve an optional post `hero` frontmatter value.
//  - "posts/<file>" or "src/assets/posts/<file>" -> optimized via astro:assets
//  - "/images/posts/<file>" (in public/)          -> served as-is
import { getImage } from 'astro:assets';
const assets = import.meta.glob('./assets/posts/*.{png,jpg,jpeg,webp,avif}', { eager: true, import: 'default' });
export const DEFAULT_HERO = '/images/posts/default.svg';
export function heroSource(hero) {
  if (!hero) return null;
  const h = String(hero).trim();
  if (h.startsWith('/')) return { kind: 'public', src: h };
  const file = h.split('/').pop();
  const img = assets[`./assets/posts/${file}`];
  if (!img) throw new Error(`hero image not found in src/assets/posts: ${h}`);
  return { kind: 'asset', src: img };
}
// URL for og:image (path; Base.astro makes it absolute). Assets are resized to 1200px JPG.
export async function heroOg(hero) {
  const s = heroSource(hero);
  if (!s) return null;
  if (s.kind === 'public') return s.src;
  return (await getImage({ src: s.src, width: 1200, format: 'jpg' })).src;
}
