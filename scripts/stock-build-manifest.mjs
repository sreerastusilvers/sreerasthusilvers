/**
 * Build the stock-photo -> live-product mapping, for review before any upload.
 *
 * Reads the "ss web stock," folders (never `info/` for images - `info/` is
 * reference material only), matches each product folder to a Firestore product
 * by name, classifies each photo as product shot / model shot / original, and
 * writes scripts/stock-manifest.json.
 *
 * Nothing is uploaded and nothing is written to Firestore here. Review the
 * manifest, then run scripts/stock-upload.mjs.
 *
 *   node scripts/stock-build-manifest.mjs
 *   node scripts/stock-build-manifest.mjs --stock="C:/path/to/ss web stock,"
 *   node scripts/stock-build-manifest.mjs --firestore    read products from
 *       Firestore (~600 reads) instead of the free catalog snapshot - only
 *       needed if the snapshot is stale or a product is hidden from the store
 *
 * Photo order follows the storefront rule: product shot first (it becomes the
 * thumbnail), then model shot, then the original reference photo. A folder with
 * no product shot leads with its model shot instead.
 */
import 'dotenv/config';
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogProducts } from './lib/catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const STOCK = resolve(arg('stock') || join(__dirname, '..', '..', 'ss web stock,'));

if (!existsSync(STOCK)) {
  console.error(`Stock folder not found: ${STOCK}`);
  console.error('Pass --stock="<path to ss web stock,>"');
  process.exit(1);
}

// -- Name matching ----------------------------------------------------------

/** Words in almost every product name, so they carry no matching signal. */
const STOP = new Set([
  '92', '5', '925', 'pure', 'silver', 'sterling', 'the', 'with', 'and', 'for', 'in', 'a', 'of',
  'women', 'womens', 'woman', 'men', 'mens', '999', 'fine', 'polish', 'polished', 'plated', 'plating',
]);

/**
 * Folder names come in two shapes - spaced ("Ruby Red Center Stone...") and
 * CamelCase ("WhitePaveSunburstDial"). Split CamelCase first or the whole name
 * collapses into one meaningless token and never matches anything.
 */
const tokens = (s) =>
  new Set(
    String(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w && !STOP.has(w)),
  );

/** Containment similarity - tolerates one name carrying extra descriptive words. */
const similarity = (a, b) => {
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return { score: hit / Math.max(1, Math.min(a.size, b.size)), overlap: hit };
};

// -- Photo classification ---------------------------------------------------

const MODEL_RE = /woman|women|model|girl|lady|ladies|bride|actress|wearing|worn|portrait|smiling|showcasing|showing/i;
const ORIGINAL_RE = /^(original_reference|IMG_\d{8})/i;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

function classify(filename) {
  if (ORIGINAL_RE.test(filename)) return 'original';
  if (MODEL_RE.test(filename)) return 'model';
  return 'product';
}

/**
 * Which live categories a stock folder is allowed to match into.
 *
 * Without this a folder called "TraditionalSet" under mangalsutra/ happily
 * matched "Traditional Layered Step Anklets Set", because the two words it has
 * both appear there. Names alone are far too weak; the folder a photo sits in
 * is the strongest signal we have about what the piece actually is.
 *
 * Keys are matched against the start of the folder path. Values are lowercased
 * subSubcategory names; `sub` additionally pins Mens vs Womens.
 */
const CATEGORY_MAP = [
  ['ladies rings', { ssc: ['rings'], sub: 'womens' }],
  ['mangalsutra', { ssc: ['black beads', 'beads mala', 'beeds mala'] }],
  ['pendants', { ssc: ['pendent', 'pendent set', 'pendents'] }],
  ['rose gold and fancy necklaces', { ssc: ['rose gold necklace', 'necklace', 'stone necklace'] }],
  ['temple necklaces', { ssc: ['temple necklace', 'temple haram', 'necklace'] }],
  ['vaddanam', { ssc: ['vaddanam'] }],
  ['watches', { ssc: ['watches'] }],
  ['set2', { ssc: ['necklace', 'bridal set', 'temple necklace', 'stone necklace'] }],
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
];

const rulesFor = (rel) => {
  const hit = CATEGORY_MAP.find(([prefix]) => rel.toLowerCase().startsWith(prefix.toLowerCase() + '/'));
  return hit ? hit[1] : null;
};

const RANK = { product: 0, model: 1, original: 2 };
/** The site's own cap - see MEDIA_STORAGE.md and firestore.rules. */
const MAX_IMAGES = 5;

// -- Collect stock folders (everything except info/) -------------------------

function collectFolders(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'info' || entry.startsWith('.')) continue;
      const p = join(dir, entry);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;

      const files = readdirSync(p).filter((f) => {
        try {
          return statSync(join(p, f)).isFile() && IMAGE_RE.test(f);
        } catch {
          return false;
        }
      });

      if (files.length) {
        // Prefixes vary: "Ring_001_<name>", "Bangle_Product_01_<name>", "G_Bracelet_Product_01_<name>".
        const m = entry.match(/^(?:[A-Za-z]+_)+(\d+)(?:_(.+))?$/);
        out.push({
          dir: p,
          rel: p.slice(root.length + 1).replace(/\\/g, '/'),
          folder: entry,
          num: m ? Number(m[1]) : null,
          folderName: m && m[2] ? m[2].trim() : null,
          photos: files
            .map((f) => ({ file: f, kind: classify(f) }))
            .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.file.localeCompare(b.file)),
        });
      }
      walk(p);
    }
  })(root);
  return out;
}

const folders = collectFolders(STOCK);

const { products: catalog } = await loadCatalogProducts({ firestore: process.argv.includes('--firestore') });
const products = [];
catalog.forEach((p) => {
  const images = p.media?.images || [];
  products.push({
    id: p.id,
    name: p.name || '',
    tokens: tokens(p.name || ''),
    ssc: String(p.subSubcategory || '').toLowerCase().trim(),
    sub: String(p.subcategory || '').toLowerCase().trim(),
    category: [p.category, p.subcategory, p.subSubcategory].filter(Boolean).join(' / '),
    alreadyMigrated: images.length > 0 && images.every((u) => !String(u).includes('res.cloudinary.com')),
  });
});

// Score every named folder against every product, then assign best-first so one
// product is never claimed by two folders.
const scored = [];
for (const f of folders) {
  if (!f.folderName) continue;
  const ft = tokens(f.folderName);
  const rules = rulesFor(f.rel);
  const candidates = rules
    ? products.filter((p) => rules.ssc.includes(p.ssc) && (!rules.sub || p.sub === rules.sub))
    : products;

  let best = null;
  let bestScore = 0;
  let bestOverlap = 0;
  for (const p of candidates) {
    const { score, overlap } = similarity(ft, p.tokens);
    if (score > bestScore || (score === bestScore && overlap > bestOverlap)) {
      bestScore = score;
      bestOverlap = overlap;
      best = p;
    }
  }
  if (best) scored.push({ folder: f, product: best, score: bestScore, overlap: bestOverlap });
}
scored.sort((a, b) => b.score - a.score || b.overlap - a.overlap);

const claimed = new Set();
const assignment = new Map();
for (const s of scored) {
  if (s.score < 0.5 || claimed.has(s.product.id)) continue;
  // A short generic folder name ("TraditionalSet") can score 1.0 against any
  // product that happens to contain both words, so a high score alone is not
  // enough - demand several distinctive words in common before trusting it.
  const confidence = s.score >= 0.75 && s.overlap >= 3 ? 'high' : 'review';
  claimed.add(s.product.id);
  assignment.set(s.folder.rel, { product: s.product, score: s.score, overlap: s.overlap, confidence });
}

const entries = folders.map((f) => {
  const a = assignment.get(f.rel);
  const photos = f.photos.slice(0, MAX_IMAGES);
  return {
    folder: f.rel,
    folderName: f.folderName,
    matched: !!a,
    confidence: a ? a.confidence : 'unmatched',
    score: a ? Number(a.score.toFixed(3)) : 0,
    overlap: a ? a.overlap : 0,
    productId: a ? a.product.id : null,
    productName: a ? a.product.name : null,
    productCategory: a ? a.product.category : null,
    alreadyMigrated: a ? a.product.alreadyMigrated : false,
    counts: {
      product: f.photos.filter((p) => p.kind === 'product').length,
      model: f.photos.filter((p) => p.kind === 'model').length,
      original: f.photos.filter((p) => p.kind === 'original').length,
      dropped: Math.max(0, f.photos.length - MAX_IMAGES),
    },
    thumbnailKind: photos[0]?.kind ?? null,
    photos: photos.map((p) => ({ file: p.file, kind: p.kind })),
  };
});

const matchedIds = new Set(entries.filter((e) => e.productId).map((e) => e.productId));
const out = {
  generatedAt: new Date().toISOString(),
  stockRoot: STOCK,
  totals: {
    stockFolders: entries.length,
    liveProducts: products.length,
    matchedHigh: entries.filter((e) => e.confidence === 'high').length,
    matchedReview: entries.filter((e) => e.confidence === 'review').length,
    unmatchedFolders: entries.filter((e) => !e.matched).length,
    productsStillWithoutPhotos: products.filter((p) => !matchedIds.has(p.id)).length,
  },
  productsStillWithoutPhotos: products
    .filter((p) => !matchedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, category: p.category })),
  entries,
};

const path = join(__dirname, 'stock-manifest.json');
writeFileSync(path, JSON.stringify(out, null, 2));

console.log('Stock root :', STOCK);
console.table(out.totals);
console.log(`\nmanifest -> ${path}`);
console.log('Next: node scripts/stock-upload.mjs --dry-run');
process.exit(0);
