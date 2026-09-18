/**
 * Put real photos into the home-page content, and hide what has nothing behind it.
 *
 * The home page shipped with placeholder content: two showcase cards with no
 * image, one hotlinking a competitor's website, five collection tiles on
 * Unsplash stock photos, and a wide banner with an empty imageUrl. Everything
 * here is admin-editable afterwards - this is a one-time clean-up, not a
 * source of truth.
 *
 *   node scripts/fix-home-content.mjs --dry-run
 *   node scripts/fix-home-content.mjs
 *
 * Photos are catalog images (Cloudflare R2), chosen from scripts/home-image-sheet.mjs.
 */
import 'dotenv/config';
import admin from 'firebase-admin';

const DRY = process.argv.includes('--dry-run');
const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
if (!b64) {
  console.error('FIREBASE_ADMIN_SDK_BASE64 missing from .env');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
const db = admin.firestore();

const IMG = (id) => `https://images.sreerasthusilvers.com/products/2026/09/${id}.jpg`;

/** Model and still-life shots from our own catalog. */
const PHOTO = {
  templeNecklace: IMG('md09dafeb67165247c683344d'), // green saree, temple pendant
  czChoker: IMG('md35d12bd54152715549db90d'), // green velvet, CZ choker
  anklet: IMG('m79e5892e74f3013a838aad32'), // cream saree, dark ground - room for text
  bracelet: IMG('mcd37342c6010cbfc649f4ac8'), // still life, light marble
  blossomSet: IMG('m4099ab2d8fafc72c8c64ef5d'), // rose-gold floral set, gift-like
  bangles: IMG('mc0c412acfa253228ad7f18a6'), // green saree, gold-plated bangles
};

/** Wide hero-style banner under the product rows. */
const BANNERS = [
  { match: (d) => d.slot === 'collection-wide', set: { imageUrl: PHOTO.anklet } },
];

/** The three "Our Collections" cards. The third held test text. */
const SHOWCASES = [
  { title: 'NECKLACE', set: { imageUrl: PHOTO.templeNecklace } },
  { title: 'DIAMOND NECKALE', set: { title: 'DIAMOND NECKLACE', imageUrl: PHOTO.czChoker } },
  {
    title: 'title jewllery',
    set: {
      title: 'Everyday Silver',
      subtitle: 'BRACELETS',
      description: 'Light, wearable pieces for every day.',
      imageUrl: PHOTO.bracelet,
    },
  },
];

/**
 * "The Sreerasthu Edit" tiles. Pooja Items, Our Articles and Our Furniture are
 * switched off: there is not one product in those categories, so the tiles led
 * to empty pages. Turning them back on is one click in Admin > Home Collections.
 */
const COLLECTIONS = [
  { title: 'Our Jewellery Collection', set: { imageUrl: PHOTO.bangles } },
  { title: 'Gift Items', set: { imageUrl: PHOTO.blossomSet } },
  { title: 'Pooja Items', set: { active: false } },
  { title: 'Our Articles', set: { active: false } },
  { title: 'Our Furniture', set: { active: false } },
];

const norm = (s) => String(s || '').trim().toLowerCase();

async function applyByTitle(collection, plan) {
  const snap = await db.collection(collection).get();
  for (const { title, match, set } of plan) {
    const doc = snap.docs.find((d) => (match ? match(d.data()) : norm(d.get('title')) === norm(title)));
    if (!doc) {
      console.log(`  ! ${collection}: no document for "${title}" - skipped`);
      continue;
    }
    const changes = Object.entries(set)
      .filter(([k, v]) => JSON.stringify(doc.get(k)) !== JSON.stringify(v))
      .map(([k, v]) => `${k}=${String(v).slice(0, 58)}`);
    if (!changes.length) {
      console.log(`  = ${collection}/${doc.id} already set`);
      continue;
    }
    console.log(`  ${DRY ? '~' : '+'} ${collection}/${doc.id} ${changes.join('  ')}`);
    if (!DRY) {
      await doc.ref.update({ ...set, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
}

console.log(DRY ? 'DRY RUN - nothing is written\n' : 'Writing home-page content\n');
console.log('homeBanners');
await applyByTitle('homeBanners', BANNERS);
console.log('showcases');
await applyByTitle('showcases', SHOWCASES);
console.log('homeCollections');
await applyByTitle('homeCollections', COLLECTIONS);
console.log('\nDone.');
process.exit(0);
