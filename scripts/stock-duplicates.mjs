/**
 * Give duplicate product records the photos of their already-photographed twin.
 *
 * The catalogue holds many products listed more than once under the exact same
 * name (the same piece entered twice, often at a different price or size). Once
 * one record has photos, its twins can share them: the same R2 URLs are written
 * to both documents, nothing is re-uploaded, and the storage cleanup only
 * deletes a file when no other product still uses it (see MEDIA_STORAGE.md).
 *
 * Names that `info/` shows belong to more than one physical piece (e.g. two
 * different necklaces both called "Divine Grace in 92.5 Pure Silver Temple
 * Jewelry") are marked `shared-name` instead of `duplicate`, because the twin
 * may be a different piece.
 *
 *   node scripts/stock-duplicates.mjs            # dry run: list what would change
 *   node scripts/stock-duplicates.mjs --apply
 *   node scripts/stock-duplicates.mjs --apply --include-shared-name
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flag = (n) => process.argv.includes(`--${n}`);
const APPLY = flag('apply');
const WITH_SHARED = flag('include-shared-name');

const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
const db = admin.firestore();
const PUBLIC_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// How many physical pieces in info/ carry each name.
const manifest = JSON.parse(readFileSync(join(__dirname, 'stock-manifest.json'), 'utf8'));
const infoPieces = new Map();
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!e.endsWith(' 1.txt')) continue;
    const m = readFileSync(p, 'utf8').match(/product name\s*-\s*:?\s*(.*)/i);
    if (m) infoPieces.set(norm(m[1]), (infoPieces.get(norm(m[1])) || 0) + 1);
  }
})(join(manifest.stockRoot, 'info'));

const snap = await db.collection('products').get();
const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
const onR2 = (d) => {
  const imgs = d.data.media?.images || [];
  return imgs.length > 0 && imgs.every((u) => String(u).startsWith(PUBLIC_BASE));
};

const byName = new Map();
for (const d of docs) {
  const k = norm(d.data.name);
  if (!k) continue;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(d);
}

const plan = [];
for (const [k, group] of byName) {
  if (group.length < 2) continue;
  const donors = group.filter(onR2);
  const needy = group.filter((d) => !onR2(d));
  if (!donors.length || !needy.length) continue;
  const pieces = infoPieces.get(k) || 1;
  const kind = pieces > 1 ? 'shared-name' : 'duplicate';
  // Prefer the donor whose price is closest, so a size variant gets its own look-alike.
  for (const n of needy) {
    const donor = [...donors].sort(
      (a, b) => Math.abs((a.data.price || 0) - (n.data.price || 0)) - Math.abs((b.data.price || 0) - (n.data.price || 0)),
    )[0];
    plan.push({ kind, pieces, target: n, donor });
  }
}

const RESULT = join(__dirname, 'stock-duplicates-applied.json');
const applied = existsSync(RESULT) ? JSON.parse(readFileSync(RESULT, 'utf8')) : {};
let done = 0;
for (const p of plan) {
  const go = p.kind === 'duplicate' || WITH_SHARED;
  console.log(
    `${go ? (APPLY ? 'COPY ' : 'would') : 'skip '} [${p.kind}${p.pieces > 1 ? ' x' + p.pieces : ''}] ` +
      `${p.target.data.name.trim().slice(0, 70)}  (Rs ${p.target.data.price} <- Rs ${p.donor.data.price})`,
  );
  if (!go || !APPLY) continue;
  const media = p.donor.data.media;
  await p.target.ref.update({
    'media.images': media.images,
    'media.thumbnail': media.thumbnail || media.images[0],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  applied[p.target.id] = { from: p.donor.id, kind: p.kind, name: p.target.data.name, at: new Date().toISOString() };
  done++;
}
if (APPLY) writeFileSync(RESULT, JSON.stringify(applied, null, 2));
console.log(`\n${plan.filter((p) => p.kind === 'duplicate').length} duplicate, ${plan.filter((p) => p.kind === 'shared-name').length} shared-name` + (APPLY ? `; copied ${done}` : ' (dry run)'));
process.exit(0);
