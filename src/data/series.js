export const LARAVEL_SECURITY_SERIES = [
  '2026-11-04-laravel-mass-assignment-fillable-guarded-validated',
  '2026-11-05-laravel-csrf-protection-tokens-exceptions-spa',
  '2026-11-06-xss-prevention-laravel-blade-echo-js-from',
  '2026-11-07-sql-injection-laravel-raw-queries-bindings-order-by',
];

export function seriesAround(slug, items) {
  const index = LARAVEL_SECURITY_SERIES.indexOf(slug);
  if (index < 0) return null;
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  return {
    title: 'Laravel security series',
    order: 'Mass assignment, CSRF, XSS, then SQL injection.',
    index,
    total: LARAVEL_SECURITY_SERIES.length,
    prev: bySlug.get(LARAVEL_SECURITY_SERIES[index - 1]) || null,
    next: bySlug.get(LARAVEL_SECURITY_SERIES[index + 1]) || null,
  };
}
