/**
 * Put a few images side by side at a readable size, for settling close calls
 * during visual matching.
 *
 *   node scripts/compare-images.mjs <out.jpg> <image> <image> [image ...]
 *
 * Each image is fitted into a 500px square; a numbered label sits under each.
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const [out, ...paths] = process.argv.slice(2);
if (!out || paths.length < 2) {
  console.error('usage: node scripts/compare-images.mjs <out.jpg> <image> <image> [image ...]');
  process.exit(1);
}
const S = 500;
const L = 28;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const comps = [];
for (const [i, p] of paths.entries()) {
  let buf;
  try {
    buf = await sharp(readFileSync(p)).rotate().resize(S, S, { fit: 'contain', background: { r: 20, g: 20, b: 20 } }).jpeg({ quality: 88 }).toBuffer();
  } catch (err) {
    console.warn(`cannot read ${p}: ${err.message}`);
    continue;
  }
  comps.push({ input: buf, left: i * S, top: 0 });
  comps.push({
    input: Buffer.from(
      `<svg width="${S}" height="${L}"><rect width="${S}" height="${L}" fill="#111"/><text x="6" y="20" font-size="15" fill="#ffd970" font-family="sans-serif">${i + 1}: ${esc(basename(p).slice(0, 58))}</text></svg>`,
    ),
    left: i * S,
    top: S,
  });
}
await sharp({ create: { width: paths.length * S, height: S + L, channels: 3, background: { r: 20, g: 20, b: 20 } } })
  .composite(comps)
  .jpeg({ quality: 85 })
  .toFile(out);
console.log(out);
