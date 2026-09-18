/**
 * Contact sheets of catalog photos, to choose home-page artwork by eye.
 *
 * The home page (hero collections, showcases, the wide banner) was built with
 * stock photos and placeholders. This renders candidates from our own catalog
 * so a real photo can be picked for each slot.
 *
 *   node scripts/home-image-sheet.mjs                  # model shots (index 1)
 *   node scripts/home-image-sheet.mjs --index=0        # product shots
 *   node scripts/home-image-sheet.mjs --match=necklace # only matching names
 *   node scripts/home-image-sheet.mjs --page=2         # next 24
 *
 * Writes scripts/sheets/home-<index>-<page>.jpg with numbered cells and prints
 * the URL behind each number.
 */
import 'dotenv/config';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogProducts } from './lib/catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const INDEX = Number(arg('index') ?? 1);
const MATCH = (arg('match') || '').toLowerCase();
const PAGE = Number(arg('page') ?? 1);
const COLS = 6;
const ROWS = 4;
const CELL = 300;
const PER_PAGE = COLS * ROWS;

const { products } = await loadCatalogProducts();

const candidates = products
  .filter((p) => (p.media?.images || []).length > INDEX)
  .filter((p) => !MATCH || `${p.name} ${p.subcategory} ${p.subSubcategory}`.toLowerCase().includes(MATCH))
  .map((p) => ({ id: p.id, name: p.name, url: p.media.images[INDEX] }));

const start = (PAGE - 1) * PER_PAGE;
const slice = candidates.slice(start, start + PER_PAGE);
if (!slice.length) {
  console.log(`No candidates on page ${PAGE} (have ${candidates.length}).`);
  process.exit(0);
}

const label = async (text, width) => {
  const safe = text.replace(/[<&>]/g, ' ').slice(0, 46);
  const svg = `<svg width="${width}" height="34"><rect width="100%" height="100%" fill="#111"/>
    <text x="8" y="23" font-family="sans-serif" font-size="15" fill="#fff">${safe}</text></svg>`;
  return Buffer.from(svg);
};

const cells = [];
for (const [i, c] of slice.entries()) {
  const n = start + i + 1;
  const resp = await fetch(c.url);
  const buf = Buffer.from(await resp.arrayBuffer());
  const img = await sharp(buf).resize(CELL, CELL, { fit: 'cover' }).toBuffer();
  const tile = await sharp(img)
    .composite([{ input: await label(`${n}. ${c.name}`, CELL), top: CELL - 34, left: 0 }])
    .jpeg({ quality: 82 })
    .toBuffer();
  cells.push(tile);
  console.log(`${String(n).padStart(3)}  ${c.url}`);
  console.log(`     ${c.name.slice(0, 70)}`);
}

const sheet = sharp({
  create: { width: COLS * CELL, height: ROWS * CELL, channels: 3, background: '#000' },
}).composite(
  cells.map((input, i) => ({ input, top: Math.floor(i / COLS) * CELL, left: (i % COLS) * CELL })),
);

const dir = join(__dirname, 'sheets');
mkdirSync(dir, { recursive: true });
const out = join(dir, `home-${INDEX}${MATCH ? `-${MATCH}` : ''}-${PAGE}.jpg`);
writeFileSync(out, await sheet.jpeg({ quality: 80 }).toBuffer());
console.log(`\nsheet -> ${out}   (${candidates.length} candidates, page ${PAGE})`);
