/**
 * Upload matched stock photos to Cloudflare R2 and point the live products at them.
 *
 * Reads scripts/stock-manifest.json (built by stock-build-manifest.mjs) and, for
 * every matched product folder:
 *   1. orders the photos product shot -> model shot -> original (max 5),
 *   2. compresses anything over the site's 500 KB image cap,
 *   3. uploads each photo plus its 600px `__w600.webp` preview to R2 under the
 *      same keys api/media.ts would have produced,
 *   4. rewrites that product's media.images and media.thumbnail in Firestore.
 *
 * The dead Cloudinary URLs are simply replaced. Nothing is deleted from
 * Cloudinary (that account is suspended and is not ours to touch).
 *
 * Safe to stop and re-run: every completed folder is recorded in
 * scripts/stock-upload-state.json and skipped next time.
 *
 *   node scripts/stock-upload.mjs --dry-run             # plan only, writes nothing
 *   node scripts/stock-upload.mjs --limit=5             # upload 5 products
 *   node scripts/stock-upload.mjs                       # upload all 'high' matches
 *   node scripts/stock-upload.mjs --confidence=all      # include 'review' matches too
 *   node scripts/stock-upload.mjs --redo                # ignore the resume state
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import sharp from 'sharp';
import { AwsClient } from 'aws4fetch';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const flag = (n) => process.argv.includes(`--${n}`);

const DRY = flag('dry-run');
const REDO = flag('redo');
const LIMIT = Number(arg('limit') || 0) || Infinity;
const CONFIDENCE = (arg('confidence') || 'high').toLowerCase();

// Same limits the browser and api/media.ts enforce.
const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_PREVIEW_BYTES = 200 * 1024;
const PREVIEW_SUFFIX = '__w600.webp';

const MANIFEST = join(__dirname, 'stock-manifest.json');
const STATE = join(__dirname, 'stock-upload-state.json');

if (!existsSync(MANIFEST)) {
  console.error('No manifest. Run: node scripts/stock-build-manifest.mjs');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const state = !REDO && existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { done: {} };

// -- R2 ---------------------------------------------------------------------

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL })) {
  if (!v) {
    console.error(`${k} missing from .env`);
    process.exit(1);
  }
}
const PUBLIC_BASE = R2_PUBLIC_URL.trim().replace(/\/+$/, '');
const BUCKET_URL = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

async function putObject(key, body, contentType) {
  const resp = await aws.fetch(`${BUCKET_URL}/${encodeKey(key)}`, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: {
      'Content-Type': contentType,
      // Keys are random and never overwritten, so they cache forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (!resp.ok) {
    throw new Error(`R2 rejected ${key} (HTTP ${resp.status}) ${(await resp.text().catch(() => '')).slice(0, 200)}`);
  }
}

/** Byte-sniff like api/media.ts does - the extension is not trusted. */
function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  return null;
}

/** Bring an oversized photo under the 500 KB cap without visibly hurting it. */
async function fitImage(buf) {
  if (buf.length <= MAX_IMAGE_BYTES) return { buf, recompressed: false };
  let out = buf;
  for (const quality of [88, 82, 76, 70, 62]) {
    out = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= MAX_IMAGE_BYTES) break;
  }
  return { buf: out, recompressed: true };
}

async function makePreview(buf) {
  for (const quality of [80, 70, 60]) {
    const out = await sharp(buf).rotate().resize({ width: 600, withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= MAX_PREVIEW_BYTES) return out;
  }
  return null; // a bad preview is not worth failing the upload
}

// -- Firestore --------------------------------------------------------------

const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
if (!b64) {
  console.error('FIREBASE_ADMIN_SDK_BASE64 missing from .env');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
const db = admin.firestore();

// -- Run --------------------------------------------------------------------

const SOURCE = (arg('source') || 'names').toLowerCase();
const KIND_RANK = { product: 0, model: 1, original: 2 };

/**
 * Upload candidates. `names` = the name-matched manifest. `visual` = decisions
 * from stock-visual-match.mjs, where --confidence takes a set of letters
 * (default "hm": high + medium; add "l" to include low-confidence fallbacks).
 */
function visualEntries() {
  const decisions = JSON.parse(readFileSync(join(__dirname, 'visual-matches.json'), 'utf8'));
  const allowed = new Set((arg('confidence') || 'hm').split(''));
  const byFolder = new Map(manifest.entries.map((e) => [e.folder, e]));
  const nameDone = new Set(Object.values(state.done).filter((r) => r.source !== 'visual').map((r) => r.productId));
  const rank = { h: 0, m: 1, l: 2 };

  // One folder per product: the most confident decision wins, earliest on a tie.
  const best = new Map();
  for (const [folder, d] of Object.entries(decisions)) {
    if (!d.productIds?.length || !allowed.has(d.confidence)) continue;
    const key = d.productIds[0];
    if (nameDone.has(key)) continue;
    const prev = best.get(key);
    if (!prev || rank[d.confidence] < rank[prev.d.confidence]) best.set(key, { folder, d });
  }

  const out = [];
  for (const { folder, d } of best.values()) {
    const m = byFolder.get(folder);
    if (!m) continue;
    const photos = m.photos
      .filter((p) => !(d.excludeKinds || []).includes(p.kind))
      .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.file.localeCompare(b.file))
      .slice(0, 5);
    if (!photos.length) continue;
    out.push({
      folder,
      productId: d.productIds[0],
      productIds: d.productIds,
      productName: d.productName,
      confidence: d.confidence,
      source: 'visual',
      photos,
      thumbnailKind: photos[0].kind,
    });
  }
  return out;
}

const wanted = (SOURCE === 'visual' ? visualEntries() : manifest.entries).filter((e) => {
  if (!e.matched && e.source !== 'visual') return false;
  if (!e.productId) return false;
  if (SOURCE !== 'visual' && CONFIDENCE === 'high' && e.confidence !== 'high') return false;
  if (!REDO && state.done[e.folder]) return false;
  return true;
});
const todo = wanted.slice(0, LIMIT === Infinity ? undefined : LIMIT);

console.log(`Stock root : ${manifest.stockRoot}`);
console.log(`Confidence : ${CONFIDENCE}`);
console.log(`Products   : ${todo.length} to process (${wanted.length} eligible, ${Object.keys(state.done).length} already done)`);
console.log(DRY ? 'MODE       : DRY RUN - nothing is uploaded or written\n' : 'MODE       : LIVE\n');

let okCount = 0;
let failCount = 0;
let bytesUp = 0;
let recompressed = 0;
const failures = [];

for (const [i, entry] of todo.entries()) {
  const label = `[${i + 1}/${todo.length}] ${entry.productName?.trim().slice(0, 58)}`;
  try {
    // Re-check live: a rebuilt manifest can point a different folder at a
    // product that is already on R2, and re-uploading would replace good
    // photos with a guess. Skip unless explicitly forced.
    // A visual match may replace an earlier, less confident visual match for the
    // same product (a later side-by-side check found the right folder). Name
    // matches are never replaced this way.
    const CONF_RANK = { h: 0, m: 1, l: 2 };
    const prior = Object.entries(state.done).find(
      ([f, r]) => f !== entry.folder && r.source === 'visual' && (r.productIds || [r.productId]).includes(entry.productId),
    );
    const supersedes =
      entry.source === 'visual' && prior && CONF_RANK[entry.confidence] < CONF_RANK[prior[1].confidence ?? 'l'];

    if (!DRY && !flag('force') && !supersedes) {
      const cur = await db.collection('products').doc(entry.productId).get();
      const curImgs = cur.data()?.media?.images || [];
      if (curImgs.length && curImgs.every((u) => String(u).includes(PUBLIC_BASE))) {
        console.log(`${label}\n     skipped: already on R2`);
        state.done[entry.folder] = { productId: entry.productId, urls: curImgs, at: new Date().toISOString(), skipped: true };
        writeFileSync(STATE, JSON.stringify(state, null, 2));
        continue;
      }
    }

    const urls = [];
    for (const photo of entry.photos) {
      const abs = join(manifest.stockRoot, ...entry.folder.split('/'), photo.file);
      const raw = readFileSync(abs);
      const fitted = await fitImage(raw);
      if (fitted.recompressed) recompressed++;
      const type = sniff(fitted.buf);
      if (!type) throw new Error(`unrecognised image bytes: ${photo.file}`);

      const now = new Date();
      const dir = `products/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const id = `m${randomBytes(12).toString('hex')}`;
      const key = `${dir}/${id}.${type.ext}`;

      if (!DRY) {
        await putObject(key, fitted.buf, type.contentType);
        const preview = await makePreview(fitted.buf);
        if (preview) await putObject(`${dir}/${id}${PREVIEW_SUFFIX}`, preview, 'image/webp');
        bytesUp += fitted.buf.length + (preview?.length || 0);
      }
      urls.push(`${PUBLIC_BASE}/${key}`);
    }

    if (!DRY) {
      // Duplicate product records of the same piece get the same photos.
      for (const pid of entry.productIds || [entry.productId]) {
        await db.collection('products').doc(pid).update({
          'media.images': urls,
          'media.thumbnail': urls[0],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      if (supersedes) {
        console.log(`     replaces less confident match from ${prior[0]}`);
        delete state.done[prior[0]];
      }
      state.done[entry.folder] = {
        productId: entry.productId,
        productIds: entry.productIds || [entry.productId],
        urls,
        source: entry.source || 'names',
        confidence: entry.confidence,
        at: new Date().toISOString(),
      };
      writeFileSync(STATE, JSON.stringify(state, null, 2));
    }

    okCount++;
    console.log(`${label}\n     ${entry.photos.length} photos (${entry.photos.map((p) => p.kind).join(', ')}) -> thumbnail: ${entry.thumbnailKind}`);
  } catch (err) {
    failCount++;
    failures.push({ folder: entry.folder, product: entry.productName, error: String(err.message || err) });
    console.error(`${label}\n     FAILED: ${err.message || err}`);
  }
}

console.log('\n--------------------------------------------');
console.log(`succeeded   : ${okCount}`);
console.log(`failed      : ${failCount}`);
console.log(`recompressed: ${recompressed} photos were over 500 KB`);
if (!DRY) console.log(`uploaded    : ${(bytesUp / 1024 / 1024).toFixed(1)} MB to R2`);
if (failures.length) {
  console.log('\nfailures:');
  failures.forEach((f) => console.log(`  ${f.product} (${f.folder}): ${f.error}`));
}
process.exit(failCount ? 1 : 0);
