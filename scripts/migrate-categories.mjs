/**
 * One-time category migration script.
 *
 * This script:
 *  1) Re-seeds the `categories` collection with the 8 canonical top-level
 *     categories (Jewellery, Furniture, Articles, Gifting, Pooja Items,
 *     Men's, Wedding, Others) — preserving any existing matching docs.
 *  2) Walks every doc in `products` and rewrites legacy `category` /
 *     `subcategory` values to the new canonical names.
 *
 * Usage:
 *   1) Place a service-account JSON at ./serviceAccount.json (or set
 *      GOOGLE_APPLICATION_CREDENTIALS env var to its path).
 *   2) `node scripts/migrate-categories.mjs --dry-run`  — preview only.
 *   3) `node scripts/migrate-categories.mjs`            — actually write.
 *
 * Safe to re-run; idempotent. No data is deleted.
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(__dirname, '..', 'serviceAccount.json');

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    `Missing service account JSON at ${SERVICE_ACCOUNT_PATH}\n` +
      `Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json at the repo root.`
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => console.log(DRY_RUN ? '[dry-run]' : '[live]', ...a);

// ── Canonical 8 top-level categories ────────────────────────────────────────
const CANONICAL = [
  { name: 'Jewellery', slug: 'jewellery' },
  { name: 'Furniture', slug: 'furniture' },
  { name: 'Articles', slug: 'articles' },
  { name: 'Gifting', slug: 'gifting' },
  { name: 'Pooja Items', slug: 'pooja-items' },
  { name: "Men's", slug: 'mens' },
  { name: 'Wedding', slug: 'wedding' },
  { name: 'Others', slug: 'others' },
];

// ── Legacy → canonical name map (lowercase keys) ────────────────────────────
const NAME_MAP = {
  'jewelry': 'Jewellery',
  'jewellery': 'Jewellery',
  'silver-jewelry': 'Jewellery',
  'silver jewellery': 'Jewellery',
  'furniture': 'Furniture',
  'articles': 'Articles',
  'silver articles': 'Articles',
  'gifts': 'Gifting',
  'gift': 'Gifting',
  'gifting': 'Gifting',
  'pooja': 'Pooja Items',
  'pooja-items': 'Pooja Items',
  'pooja items': 'Pooja Items',
  'puja': 'Pooja Items',
  'mens': "Men's",
  "men's": "Men's",
  'mens-jewelry': "Men's",
  'wedding': 'Wedding',
  'bridal': 'Wedding',
  'others': 'Others',
  'other-products': 'Others',
  'other products': 'Others',
  'baby-items': 'Others',
  'antique-silver': 'Articles',
};

const remap = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return NAME_MAP[key] || null;
};

// ── 1) Reseed categories ────────────────────────────────────────────────────
async function seedCategories() {
  console.log('\n── Seeding canonical categories ──');
  const snap = await db.collection('categories').get();
  const existing = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.slug) existing.set(String(data.slug).toLowerCase(), d.id);
  });

  for (const cat of CANONICAL) {
    if (existing.has(cat.slug)) {
      log(`  ✓ already present: ${cat.name}`);
      continue;
    }
    log(`  + adding: ${cat.name}`);
    if (!DRY_RUN) {
      await db.collection('categories').add({
        name: cat.name,
        slug: cat.slug,
        subcategories: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

// ── 2) Rewrite product category fields ──────────────────────────────────────
async function migrateProducts() {
  console.log('\n── Rewriting product category fields ──');
  const snap = await db.collection('products').get();
  let touched = 0;
  let writes = 0;
  let batch = db.batch();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const updates = {};
    const newCat = remap(data.category);
    const newSub = remap(data.subcategory);
    if (newCat && newCat !== data.category) updates.category = newCat;
    if (newSub && newSub !== data.subcategory) updates.subcategory = newSub;

    if (Object.keys(updates).length === 0) continue;
    touched++;
    log(`  ~ ${docSnap.id}: ${JSON.stringify(updates)}`);
    if (!DRY_RUN) {
      batch.update(docSnap.ref, {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      writes++;
      if (writes >= 400) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
  }
  if (!DRY_RUN && writes > 0) await batch.commit();
  console.log(`Migrated ${touched} product doc(s).`);
}

(async () => {
  try {
    await seedCategories();
    await migrateProducts();
    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
})();
