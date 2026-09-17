/**
 * Remove the dead Cloudinary URLs from Firestore.
 *
 * The Cloudinary account is suspended (every asset URL returns HTTP 401), so
 * these URLs render as blank images. This strips them from the storefront
 * collections and leaves the fields empty, which makes the app fall back to its
 * placeholder instead of a broken image.
 *
 * A full backup of every field it touches is written to
 * scripts/cloudinary-backup.json BEFORE anything is changed. Keep that file:
 * it is the only remaining record of how many photos each product had and of
 * the Cloudinary upload order, both of which are used to match stock photos.
 *
 *   node scripts/clear-cloudinary.mjs --dry-run
 *   node scripts/clear-cloudinary.mjs
 *   node scripts/clear-cloudinary.mjs --collections=products,banners
 *
 * Restore is possible from the backup with --restore.
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const flag = (n) => process.argv.includes(`--${n}`);

const DRY = flag('dry-run');
const RESTORE = flag('restore');
const BACKUP = join(__dirname, 'cloudinary-backup.json');

/** Storefront collections only - order history keeps its record. */
const DEFAULT_COLLECTIONS = ['products', 'banners', 'homeBanners', 'homeCollections', 'showcases', 'testimonials'];
const COLLECTIONS = (arg('collections') || '').split(',').map((s) => s.trim()).filter(Boolean);
const TARGETS = COLLECTIONS.length ? COLLECTIONS : DEFAULT_COLLECTIONS;

const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
if (!b64) {
  console.error('FIREBASE_ADMIN_SDK_BASE64 missing from .env');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
const db = admin.firestore();

const isDead = (v) => typeof v === 'string' && v.includes('res.cloudinary.com');

/**
 * Walk a document and drop every Cloudinary string: removed from arrays,
 * emptied in place when it is a plain field. Returns null when nothing changed.
 */
function strip(value) {
  if (typeof value === 'string') return isDead(value) ? { changed: true, value: '' } : null;
  if (Array.isArray(value)) {
    const kept = value.filter((v) => !isDead(v));
    if (kept.length === value.length) {
      let changed = false;
      const mapped = value.map((v) => {
        const r = strip(v);
        if (r) changed = true;
        return r ? r.value : v;
      });
      return changed ? { changed: true, value: mapped } : null;
    }
    return { changed: true, value: kept };
  }
  if (value && typeof value === 'object' && !(value instanceof admin.firestore.Timestamp)) {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const r = strip(v);
      if (r) {
        changed = true;
        out[k] = r.value;
      } else out[k] = v;
    }
    return changed ? { changed: true, value: out } : null;
  }
  return null;
}

if (RESTORE) {
  if (!existsSync(BACKUP)) {
    console.error('No backup file to restore from.');
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8'));
  let n = 0;
  for (const [coll, docs] of Object.entries(backup.collections)) {
    for (const [id, data] of Object.entries(docs)) {
      if (!DRY) await db.collection(coll).doc(id).set(data, { merge: true });
      n++;
    }
  }
  console.log(`${DRY ? 'would restore' : 'restored'} ${n} documents`);
  process.exit(0);
}

const backup = { takenAt: new Date().toISOString(), collections: {} };
let scanned = 0;
let changed = 0;
const perCollection = {};

for (const coll of TARGETS) {
  const snap = await db.collection(coll).get();
  backup.collections[coll] = {};
  let hits = 0;
  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data();
    const result = strip(data);
    if (!result) continue;
    backup.collections[coll][doc.id] = data;
    hits++;
    changed++;
    // Update only the top-level fields that changed, so untouched fields (and
    // any concurrent edits to them) are never rewritten.
    const patch = {};
    for (const [k, v] of Object.entries(result.value)) {
      if (JSON.stringify(v) !== JSON.stringify(data[k])) patch[k] = v;
    }
    if (!DRY && Object.keys(patch).length) await doc.ref.update(patch);
  }
  perCollection[coll] = `${hits} of ${snap.size}`;
}

// Written even on a dry run so the record exists before any destructive step.
writeFileSync(BACKUP, JSON.stringify(backup, null, 2));

console.log(DRY ? 'DRY RUN - nothing written to Firestore\n' : 'LIVE\n');
console.table(perCollection);
console.log(`scanned ${scanned} documents, ${changed} contained dead Cloudinary URLs`);
console.log(`backup -> ${BACKUP}`);
process.exit(0);
