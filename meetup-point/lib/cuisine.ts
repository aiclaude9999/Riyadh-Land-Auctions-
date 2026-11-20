import type { Venue } from './venues';

/** Simple food groups for preferences; OSM cuisine tags are mapped onto them. */
export const CUISINE_GROUPS = ['coffee', 'arabic', 'italian', 'burger', 'asian', 'dessert', 'sandwich', 'grill'] as const;
export type CuisineGroup = (typeof CUISINE_GROUPS)[number];

const TAGS: Record<CuisineGroup, string[]> = {
  coffee: ['coffee shop', 'coffee', 'cafe', 'tea', 'v60', 'قهوة'],
  arabic: ['regional', 'arab', 'arabic', 'lebanese', 'middle eastern', 'turkish', 'kebab', 'shawarma', 'local', 'saudi', 'syrian', 'yemeni', 'egyptian', 'mandi'],
  italian: ['pizza', 'italian', 'pasta'],
  burger: ['burger', 'american', 'chicken', 'fried chicken', 'friture', 'tacos', 'mexican'],
  asian: ['japanese', 'indian', 'asian', 'pakistani', 'chinese', 'thai', 'korean', 'sushi', 'filipino', 'peruvian'],
  dessert: ['dessert', 'ice cream', 'donut', 'cake', 'waffle', 'وافل', 'crepe', 'chocolate', 'bakery'],
  sandwich: ['sandwich', 'breakfast', 'bagel', 'salad', 'healthy'],
  grill: ['barbecue', 'steak house', 'steak', 'seafood', 'grill', 'fish'],
};

/** Food groups a venue belongs to. Cafés with no cuisine tag count as coffee. */
export function venueGroups(v: Pick<Venue, 'kind' | 'cuisine'>): CuisineGroup[] {
  const tags = (v.cuisine ?? '').toLowerCase();
  const groups = CUISINE_GROUPS.filter((g) => TAGS[g].some((t) => tags.includes(t)));
  if (!groups.length && v.kind === 'cafe') return ['coffee'];
  return groups;
}
