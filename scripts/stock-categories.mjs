/**
 * Which live categories a stock folder is allowed to match into.
 *
 * Shared by stock-build-manifest.mjs and stock-temporal-match.mjs so the two
 * can never drift apart.
 *
 * Without this fence a folder called "TraditionalSet" under mangalsutra/
 * happily matched "Traditional Layered Step Anklets Set", because both words
 * appear there. The folder a photo sits in is the strongest signal we have
 * about what the piece actually is.
 *
 * Keys match the start of the folder path. Values are lowercased
 * subSubcategory names; `sub` additionally pins Mens vs Womens.
 */
export const CATEGORY_MAP = [
  ['ladies rings', { ssc: ['rings'], sub: 'womens' }],
  ['mangalsutra', { ssc: ['black beads'] }],
  ['pendants', { ssc: ['pendent', 'pendent set', 'pendents'] }],
  ['rose gold and fancy necklaces', { ssc: ['rose gold necklace', 'necklace', 'stone necklace'] }],
  ['temple necklaces', { ssc: ['temple necklace', 'temple haram'] }],
  ['vaddanam', { ssc: ['vaddanam'] }],
  ['watches', { ssc: ['watches'] }],
  ['set2', { ssc: ['necklace', 'bridal set', 'stone necklace'] }],
  ['Turkey', { ssc: ['necklace', 'rose gold necklace'] }],
  ['ss/earrings', { ssc: ['earrings', 'buttalu'] }],
  ['ss/anklets', { ssc: ['anklets'] }],
  ['ss/bangles', { ssc: ['bangles', 'kada', 'kadas'] }],
  ['ss/beads mala', { ssc: ['beads mala', 'beeds mala'] }],
  ['ss/charm chains', { ssc: ['chains'], sub: 'womens' }],
  ['ss/g chains', { ssc: ['chains'], sub: 'mens' }],
  ['ss/gents rings', { ssc: ['rings'], sub: 'mens' }],
  ['ss/g bracelet', { ssc: ['bracelets', 'bands'], sub: 'mens' }],
  ['ss/l bracelets', { ssc: ['bracelets', 'bands'], sub: 'womens' }],
  ['ss/kaan', { ssc: ['kaans'] }],
  ['ss/kante', { ssc: ['kante'] }],
  ['ss/champaswaralu', { ssc: ['champaswaralu'] }],
  ['ss/czs', { ssc: ['earrings', 'pendent'] }],
  ['ss/dia replica', { ssc: ['earrings', 'pendent', 'rings'] }],
];

/** The stock bucket a folder path belongs to, e.g. "ss/earrings". */
export const bucketOf = (rel) => {
  const hit = CATEGORY_MAP.find(([prefix]) => rel.toLowerCase().startsWith(prefix.toLowerCase() + '/'));
  return hit ? hit[0] : null;
};

export const rulesFor = (rel) => {
  const hit = CATEGORY_MAP.find(([prefix]) => rel.toLowerCase().startsWith(prefix.toLowerCase() + '/'));
  return hit ? hit[1] : null;
};

/** Does this product sit in the categories a bucket is allowed to fill? */
export const productAllowed = (rules, p) =>
  !!rules && rules.ssc.includes(p.ssc) && (!rules.sub || p.sub === rules.sub);
