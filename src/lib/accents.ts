/** Cycle the accent palette across categories, keyed by slug. */
const ACCENTS = ['#ff4b24', '#2743ff', '#ffb400'];

export function accentFor(categories: { slug: string }[]) {
  const map = new Map(categories.map((cat, i) => [cat.slug, ACCENTS[i % ACCENTS.length]]));
  return (slug: string | undefined) => (slug && map.get(slug)) || ACCENTS[0];
}

export { ACCENTS };
