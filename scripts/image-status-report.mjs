/**
 * Photo status of every product, for the team that uploads content.
 *
 * Reads the published catalog (no Firestore reads) and checks each product's
 * photos on the storage side: how many there are, how large the first one is,
 * and whether anything looks wrong. Writes a CSV to work through and a JSON
 * summary used by the written report.
 *
 *   node scripts/image-status-report.mjs              # full check
 *   node scripts/image-status-report.mjs --quick      # skip measuring photos
 *
 * Nothing is modified. Safe to re-run.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogProducts } from './lib/catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUICK = process.argv.includes('--quick');
const CONCURRENCY = 12;
/** Below this, a photo looks like a screenshot or a web grab rather than a shoot. */
const SMALL_EDGE = 900;
const ADMIN = 'https://www.sreerasthusilvers.com/admin/products';

const { products } = await loadCatalogProducts();

/** Width and height from the first bytes of a JPEG/PNG/WebP, without downloading it all. */
function readSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 12, 16) === 'JFIF') { /* fall through to scan */ }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  if (buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    if (buf.toString('ascii', 12, 16) === 'VP8X') {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  }
  return null;
}

async function measure(url) {
  try {
    const resp = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    if (!resp.ok && resp.status !== 206) return { error: `HTTP ${resp.status}` };
    const buf = Buffer.from(await resp.arrayBuffer());
    const total = Number(
      (resp.headers.get('content-range') || '').split('/')[1] || resp.headers.get('content-length') || 0,
    );
    return { ...(readSize(buf) || {}), bytes: total };
  } catch (err) {
    return { error: err.message.slice(0, 40) };
  }
}

async function mapLimited(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next;
        next += 1;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// Products sharing a name are usually the same physical piece entered twice.
const byName = new Map();
for (const p of products) {
  const key = String(p.name || '').trim().toLowerCase();
  byName.set(key, (byName.get(key) || 0) + 1);
}

const rows = products.map((p) => {
  const images = p.media?.images || [];
  return {
    id: p.id,
    name: String(p.name || '').trim(),
    category: [p.category, p.subcategory, p.subSubcategory].filter(Boolean).join(' / '),
    price: p.price ?? '',
    photos: images.length,
    first: images[0] || '',
    duplicateName: byName.get(String(p.name || '').trim().toLowerCase()) > 1,
  };
});

if (!QUICK) {
  const measured = await mapLimited(
    rows.filter((r) => r.first),
    async (r) => ({ id: r.id, ...(await measure(r.first)) }),
  );
  const sizes = new Map(measured.map((m) => [m.id, m]));
  for (const r of rows) Object.assign(r, sizes.get(r.id) || {});
}

const statusOf = (r) => {
  if (!r.photos) return ['No photo', 'Shoot and upload: product shot, model shot, original'];
  if (r.error) return ['Photo will not load', 'Re-upload the photo'];
  if (r.width && Math.min(r.width, r.height) < SMALL_EDGE) {
    return ['Low resolution', `Only ${r.width}x${r.height} - replace with a full-size shot`];
  }
  if (r.photos === 1) return ['One photo only', 'Add the model shot, then the original'];
  if (r.photos === 2) return ['Two photos', 'Add the third photo if one exists'];
  return ['Complete', ''];
};

for (const r of rows) {
  const [status, action] = statusOf(r);
  r.status = status;
  r.action = action;
  if (r.duplicateName && r.action === '') r.action = 'Same name as another product - check they are two different pieces';
}

const order = ['No photo', 'Photo will not load', 'Low resolution', 'One photo only', 'Two photos', 'Complete'];
rows.sort(
  (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
);

const csv = [
  ['Status', 'Action needed', 'Product', 'Category', 'Photos', 'Price', 'Size of first photo', 'Edit link'].join(','),
  ...rows.map((r) =>
    [
      r.status,
      r.action,
      r.name,
      r.category,
      r.photos,
      r.price,
      r.width ? `${r.width}x${r.height}` : '',
      `${ADMIN}/${r.id}`,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  ),
].join('\r\n');

const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
const byCategory = {};
for (const r of rows) {
  const cat = r.category || '(none)';
  byCategory[cat] = byCategory[cat] || { total: 0, noPhoto: 0, complete: 0 };
  byCategory[cat].total += 1;
  if (r.status === 'No photo') byCategory[cat].noPhoto += 1;
  if (r.status === 'Complete') byCategory[cat].complete += 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalProducts: rows.length,
  counts,
  byCategory,
  duplicateNames: rows.filter((r) => r.duplicateName).length,
  rows,
};

writeFileSync(join(__dirname, 'image-status.csv'), csv, 'utf8');
writeFileSync(join(__dirname, 'image-status.json'), JSON.stringify(summary, null, 1), 'utf8');

console.log(`products      : ${rows.length}`);
for (const s of order) if (counts[s]) console.log(`${s.padEnd(14)}: ${counts[s]}`);
console.log(`duplicate name: ${summary.duplicateNames}`);
console.log('\ncsv  -> scripts/image-status.csv');
console.log('json -> scripts/image-status.json');
