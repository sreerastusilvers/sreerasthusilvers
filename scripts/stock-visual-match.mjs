/**
 * Visual matching of unnamed stock folders ("Ring_005") to products.
 *
 * Why this works: every product in `info/` is a real photo plus a sidecar .txt
 * holding its name, and the stock folders were generated working through those
 * photos in order. So a stock folder's position in its bucket tells us roughly
 * which `info/` piece it came from. This tool narrows each unnamed folder to a
 * small window of candidate pieces around that position, then renders the
 * folder's photo beside the candidates so the match can be made by eye.
 *
 * Name-confirmed matches (stock-upload-state.json) and every visual decision
 * already made (visual-matches.json) are anchors: the more folders are decided,
 * the tighter the windows get.
 *
 *   node scripts/stock-visual-match.mjs --bucket="ss/bangles" --validate
 *       leave-one-out check of how well position predicts the piece
 *   node scripts/stock-visual-match.mjs --bucket="ss/bangles" --next=3
 *       render the next 3 undecided folders to scripts/sheets/vm-*.jpg
 *   node scripts/stock-visual-match.mjs --decide 1=C/h 2=none 3=A/m
 *       record decisions for the blocks of the last rendered sheet
 *       (h = high, m = medium, l = low confidence)
 *   node scripts/stock-visual-match.mjs --status
 *
 * Products are cached in scripts/.products-cache.json; pass --refresh to re-read
 * them (free - from the catalog snapshot), or --refresh --firestore to re-read
 * from Firestore itself (~600 metered reads).
 */
import 'dotenv/config';
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const flag = (n) => argv.includes(`--${n}`);

const MANIFEST = join(__dirname, 'stock-manifest.json');
const STATE = join(__dirname, 'stock-upload-state.json');
const DECISIONS = join(__dirname, 'visual-matches.json');
const CACHE = join(__dirname, '.products-cache.json');
const SHEETS = join(__dirname, 'sheets');
const PENDING = join(SHEETS, 'vm-pending.json');
if (!existsSync(SHEETS)) mkdirSync(SHEETS, { recursive: true });

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const ROOT = manifest.stockRoot;
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { done: {} };
const decisions = existsSync(DECISIONS) ? JSON.parse(readFileSync(DECISIONS, 'utf8')) : {};
const saveDecisions = () => writeFileSync(DECISIONS, JSON.stringify(decisions, null, 2));

/** Which info/ folders each stock bucket was generated from (derived from name-confirmed matches). */
export const BUCKET_INFO = {
  'ladies rings': ['Rings'],
  pendants: ['pendent', 'pendent set'],
  'rose gold and fancy necklaces': ['rose gold naklace', 'silver nacklaces', 'Temple Necklace'],
  'temple necklaces': ['Temple Necklace', 'Temple Haram'],
  mangalsutra: ['black beeds'],
  vaddanam: ['Vaddanam'],
  watches: ['Watches'],
  set2: ['Bridal sets', 'rose gold naklace'],
  Turkey: ['Bridal sets', 'rose gold naklace'],
  'ss/earrings': ['Earrings', 'Silver Earrings', 'Buttalu'],
  'ss/anklets': ['pattilu', 'toe rings'],
  'ss/bangles': ['Bangles', 'ladies kadas'],
  'ss/beads mala': ['beads malas'],
  'ss/charm chains': ['chainss'],
  'ss/g chains': ['chainss'],
  'ss/gents rings': ['Rings', 'Gents finger rings'],
  'ss/g bracelet': ['Bands', 'Bracelates', 'Kadas'],
  'ss/l bracelets': ['Bracelates', 'ladies kadas', 'Bands'],
  'ss/kaan': ['Kaans'],
  'ss/kante': ['KANTE'],
  'ss/champaswaralu': ['champaswaralu'],
  'ss/czs': ['Temple Haram', 'Earrings'],
  'ss/dia replica': ['Earrings', 'pendent', 'Rings'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// -- Products (cached) -----------------------------------------------------

async function loadProducts() {
  if (existsSync(CACHE) && !flag('refresh')) return JSON.parse(readFileSync(CACHE, 'utf8'));
  const { loadCatalogProducts } = await import('./lib/catalog.mjs');
  const { products: catalog } = await loadCatalogProducts({ firestore: flag('firestore') });
  const list = [];
  catalog.forEach((p) => {
    const imgs = p.media?.images || [];
    list.push({
      id: p.id,
      name: (p.name || '').trim(),
      ssc: String(p.subSubcategory || '').toLowerCase().trim(),
      sub: String(p.subcategory || '').toLowerCase().trim(),
      created: p.createdAt?.toMillis?.() || 0,
      price: p.price ?? null,
      onR2: imgs.length > 0 && imgs.every((u) => String(u).includes('images.sreerasthusilvers.com')),
    });
  });
  writeFileSync(CACHE, JSON.stringify(list, null, 2));
  return list;
}

const products = await loadProducts();
const productById = new Map(products.map((p) => [p.id, p]));

/** Products already given photos, by name match or by an earlier decision. */
const takenProducts = new Set();
for (const rec of Object.values(state.done)) takenProducts.add(rec.productId);
// Low-confidence picks are fallbacks only: they neither claim a product nor anchor positions.
const firm = (d) => d && d.productIds?.length && d.confidence !== 'l';
for (const d of Object.values(decisions)) if (firm(d)) for (const id of d.productIds) takenProducts.add(id);
products.filter((p) => p.onR2).forEach((p) => takenProducts.add(p.id));

// -- info/ pieces ------------------------------------------------------------

const IMG_EXT = ['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG', '.heic', '.HEIC'];

/** Time key for ordering: the date in IMG_YYYYMMDD_HHMMSS names, else file mtime. */
function timeKey(file, full) {
  const m = file.match(/(\d{8})_(\d{6})/);
  if (m) return Number(m[1] + m[2]);
  try {
    const t = statSync(full).mtime;
    return Number(
      `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}` +
        `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`,
    );
  } catch {
    return 0;
  }
}

function piecesFor(bucket) {
  const out = [];
  for (const cat of BUCKET_INFO[bucket] || []) {
    const dir = join(ROOT, 'info', cat);
    if (!existsSync(dir)) continue;
    const listing = readdirSync(dir);
    // Decodable photos in this folder, for when a .txt has no photo of its own name.
    const photos = listing
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .map((f) => ({ f, t: timeKey(f.replace(/\.[^.]+$/, ''), join(dir, f)) }));
    for (const f of listing) {
      if (!f.endsWith(' 1.txt')) continue;
      const base = f.slice(0, -' 1.txt'.length);
      const m = readFileSync(join(dir, f), 'utf8').match(/product name\s*-\s*:?\s*(.*)/i);
      if (!m) continue;
      const t = timeKey(base, join(dir, f));
      let image = IMG_EXT.slice(0, 6).map((e) => join(dir, base + e)).find((p) => existsSync(p)) || null;
      let imageGuessed = false;
      if (!image && photos.length) {
        const near = [...photos].sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
        image = join(dir, near.f);
        imageGuessed = true;
      }
      out.push({ cat, base, name: m[1].trim(), image, imageGuessed, t });
    }
  }
  out.sort((a, b) => a.t - b.t || a.base.localeCompare(b.base));

  // Resolve each piece to product(s). Pieces sharing a name pair with products
  // sharing that name in creation order, so duplicates split one-to-one.
  const byName = new Map();
  for (const p of products) {
    const k = norm(p.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(p);
  }
  for (const list of byName.values()) list.sort((a, b) => a.created - b.created);
  const used = new Map();
  out.forEach((pc, i) => {
    pc.rank = i;
    const k = norm(pc.name);
    const list = byName.get(k) || [];
    const n = used.get(k) || 0;
    used.set(k, n + 1);
    pc.productId = list[n]?.id || list[list.length - 1]?.id || null;
    pc.extraProductIds = [];
  });
  // If a name has more products than pieces, attach the surplus to the last piece.
  for (const [k, list] of byName) {
    const pcs = out.filter((pc) => norm(pc.name) === k);
    if (pcs.length && list.length > pcs.length) {
      pcs[pcs.length - 1].extraProductIds = list.slice(pcs.length).map((p) => p.id);
    }
  }
  return out;
}

// -- stock folders ---------------------------------------------------------

const folderNum = (rel) => {
  const m = basename(rel).match(/_(\d+)(?:_|$)/);
  return m ? Number(m[1]) : 0;
};

function foldersFor(bucket) {
  return manifest.entries
    .filter((e) => e.folder.toLowerCase().startsWith(bucket.toLowerCase() + '/'))
    .filter((e) => e.folder.split('/').length === bucket.split('/').length + 1)
    .sort((a, b) => folderNum(a.folder) - folderNum(b.folder) || a.folder.localeCompare(b.folder))
    .map((e, i) => ({ ...e, rank: i }));
}

function anchorsFor(folders, pieces) {
  const pieceByProduct = new Map();
  pieces.forEach((pc) => {
    if (pc.productId) pieceByProduct.set(pc.productId, pc.rank);
    (pc.extraProductIds || []).forEach((id) => pieceByProduct.set(id, pc.rank));
  });
  const anchors = [];
  for (const f of folders) {
    const ids = state.done[f.folder] ? [state.done[f.folder].productId] : firm(decisions[f.folder]) ? decisions[f.folder].productIds : [];
    for (const id of ids) {
      if (pieceByProduct.has(id)) {
        anchors.push({ f: f.rank, p: pieceByProduct.get(id), folder: f.folder });
        break;
      }
    }
  }
  return anchors.sort((a, b) => a.f - b.f);
}

/** Estimate piece rank for folder rank f from surrounding anchors. */
function estimate(f, anchors) {
  let lo = null;
  let hi = null;
  for (const a of anchors) {
    if (a.f < f) lo = a;
    else if (a.f > f && !hi) hi = a;
  }
  if (lo && hi) {
    const p = lo.p + ((f - lo.f) * (hi.p - lo.p)) / (hi.f - lo.f);
    const gap = Math.min(f - lo.f, hi.f - f);
    return { p, spread: 2 + gap * 0.5 + Math.abs(hi.p - lo.p - (hi.f - lo.f)) * 0.5 };
  }
  if (lo) return { p: lo.p + (f - lo.f), spread: 3 + (f - lo.f) * 0.6 };
  if (hi) return { p: hi.p - (hi.f - f), spread: 3 + (hi.f - f) * 0.6 };
  return { p: f, spread: 12 };
}

// -- Commands ----------------------------------------------------------------

if (flag('status')) {
  const vis = Object.values(decisions);
  const conf = { h: 0, m: 0, l: 0 };
  vis.forEach((d) => d.productIds?.length && conf[d.confidence]++);
  console.log(`name-confirmed products : ${Object.keys(state.done).length}`);
  console.log(`visual decisions        : ${vis.filter((d) => d.productIds?.length).length} (high ${conf.h}, medium ${conf.m}, low ${conf.l})`);
  console.log(`folders marked none     : ${vis.filter((d) => d.none).length}`);
  const still = products.filter((p) => !takenProducts.has(p.id));
  console.log(`products still without photos: ${still.length}`);
  process.exit(0);
}

if (flag('decide')) {
  const pending = JSON.parse(readFileSync(PENDING, 'utf8'));
  const specs = argv.filter((a) => /^\d+=/.test(a));
  if (pending.blind) {
    // Blind accuracy test: score against the known answer, never save as a decision.
    const RES = join(__dirname, 'visual-blind-results.json');
    const results = existsSync(RES) ? JSON.parse(readFileSync(RES, 'utf8')) : [];
    for (const spec of specs) {
      const [blockStr, rhs] = spec.split('=');
      const block = pending.blocks[Number(blockStr) - 1];
      if (!block) continue;
      const [letter, c = 'm'] = rhs.split('/');
      const cand = rhs === 'none' ? null : block.candidates.find((x) => x.letter === letter.toUpperCase());
      const correct = !!cand && (cand.productId === block.truth || (cand.extraProductIds || []).includes(block.truth));
      const truthInWindow = block.candidates.some((x) => x.productId === block.truth);
      results.push({ folder: block.folder, bucket: pending.bucket, picked: cand?.name || 'none', confidence: c, correct, truthInWindow });
      console.log(`${correct ? 'CORRECT' : 'WRONG  '} [${c}] ${block.folder}\n        picked: ${cand?.name || 'none'}\n        truth : ${productById.get(block.truth)?.name}`);
    }
    writeFileSync(RES, JSON.stringify(results, null, 2));
    const byC = {};
    results.forEach((r) => {
      byC[r.confidence] = byC[r.confidence] || { right: 0, n: 0 };
      byC[r.confidence].n++;
      if (r.correct) byC[r.confidence].right++;
    });
    const tot = results.filter((r) => r.correct).length;
    console.log(`\nblind running total: ${tot}/${results.length} correct`);
    for (const [k, v] of Object.entries(byC)) console.log(`  confidence ${k}: ${v.right}/${v.n}`);
    process.exit(0);
  }
  for (const spec of specs) {
    const [blockStr, rhs] = spec.split('=');
    const block = pending.blocks[Number(blockStr) - 1];
    if (!block) {
      console.error(`no block ${blockStr}`);
      continue;
    }
    if (rhs === 'none' || rhs === 'defer') {
      decisions[block.folder] = { none: true, deferred: rhs === 'defer', decidedAt: new Date().toISOString() };
      console.log(`${block.folder}  ->  none`);
      continue;
    }
    const [letter, c = 'm', x = ''] = rhs.split('/');
    const cand = block.candidates.find((y) => y.letter === letter.toUpperCase());
    // Optional third part excludes photo kinds that show a different piece: xo = original, xm = model.
    const excludeKinds = [x.includes('o') && 'original', x.includes('m') && 'model', x.includes('p') && 'product'].filter(Boolean);
    if (!cand) {
      console.error(`block ${blockStr}: no candidate ${letter}`);
      continue;
    }
    decisions[block.folder] = {
      productIds: [cand.productId, ...(cand.extraProductIds || [])],
      productName: cand.name,
      infoPiece: cand.piece,
      confidence: { h: 'h', m: 'm', l: 'l' }[c] || 'm',
      excludeKinds,
      decidedAt: new Date().toISOString(),
    };
    console.log(`${block.folder}  ->  ${cand.name}  [${c}]`);
  }
  saveDecisions();
  process.exit(0);
}

const OVERVIEW = join(SHEETS, 'vm-overview.json');

if (flag('set')) {
  // Direct decision for a product with no info/ photo to show as a candidate:
  //   --set "<folder path>" <productId> <h|m|l> [xo]
  const i = argv.indexOf('--set');
  const [folder, productId, c = 'm', x = ''] = argv.slice(i + 1);
  const p = productById.get(productId);
  if (!p || !manifest.entries.some((e) => e.folder === folder)) {
    console.error(`unknown ${!p ? 'product ' + productId : 'folder ' + folder}`);
    process.exit(1);
  }
  decisions[folder] = {
    productIds: [productId],
    productName: p.name,
    infoPiece: null,
    confidence: { h: 'h', m: 'm', l: 'l' }[c] || 'm',
    excludeKinds: [x.includes('o') && 'original', x.includes('m') && 'model', x.includes('p') && 'product'].filter(Boolean),
    decidedAt: new Date().toISOString(),
  };
  saveDecisions();
  console.log(`${folder}  ->  ${p.name}  [${c}]`);
  process.exit(0);
}

if (flag('assign')) {
  // Decisions against the last --overview render: "<folder #>=<piece id>/<h|m|l>[/xo]" or "<folder #>=none".
  const ov = JSON.parse(readFileSync(OVERVIEW, 'utf8'));
  for (const spec of argv.filter((a) => /^\d+=/.test(a))) {
    const [numStr, rhs] = spec.split('=');
    const f = ov.folders.find((x) => x.idx === Number(numStr));
    if (!f) {
      console.error(`no folder #${numStr}`);
      continue;
    }
    if (rhs === 'none' || rhs === 'defer') {
      decisions[f.folder] = { none: true, deferred: rhs === 'defer', decidedAt: new Date().toISOString() };
      console.log(`#${numStr} ${f.folder}  ->  ${rhs}`);
      continue;
    }
    const [pid, c = 'm', x = ''] = rhs.split('/');
    const cand = ov.cands.find((y) => y.id === pid.toLowerCase());
    if (!cand) {
      console.error(`#${numStr}: no candidate ${pid}`);
      continue;
    }
    decisions[f.folder] = {
      productIds: [cand.productId, ...(cand.extraProductIds || [])],
      productName: cand.name,
      infoPiece: cand.piece,
      confidence: { h: 'h', m: 'm', l: 'l' }[c] || 'm',
      excludeKinds: [x.includes('o') && 'original', x.includes('m') && 'model', x.includes('p') && 'product'].filter(Boolean),
      decidedAt: new Date().toISOString(),
    };
    console.log(`#${numStr} ${f.folder}  ->  ${cand.name}  [${c}]`);
  }
  saveDecisions();
  process.exit(0);
}

const bucket = arg('bucket');
if (!bucket || !BUCKET_INFO[bucket]) {
  console.error(`--bucket must be one of: ${Object.keys(BUCKET_INFO).join(', ')}`);
  process.exit(1);
}
const pieces = piecesFor(bucket);
const folders = foldersFor(bucket);
const anchors = anchorsFor(folders, pieces);

if (flag('overview')) {
  // Whole-bucket view: every unclaimed candidate piece on one set of pages, every
  // undecided folder on another. Better than per-folder windows once a bucket is
  // mostly decided and every folder would see the same short candidate list.
  const withDeferred = flag('include-deferred');
  const FROM = Number(arg('from') || 0);
  const COUNT = Number(arg('count') || 1e9);
  const MARGIN = Number(arg('margin') || 10);
  const und = folders
    .filter((f) => !state.done[f.folder] && (!decisions[f.folder] || (withDeferred && decisions[f.folder].deferred)))
    .slice(FROM, FROM + COUNT);
  // In chunked mode only offer pieces near where these folders are predicted to sit.
  const chunked = arg('count') !== undefined;
  const ests = und.map((f) => estimate(f.rank, anchors).p);
  const lo = Math.min(...ests) - MARGIN;
  const hi = Math.max(...ests) + MARGIN;
  const cands = pieces
    .filter((pc) => pc.productId && !takenProducts.has(pc.productId))
    .filter((pc) => !chunked || (pc.rank >= lo && pc.rank <= hi))
    .map((pc) => ({
      id: `p${pc.rank}`,
      piece: `${pc.cat}/${pc.base}`,
      name: pc.name,
      image: pc.image,
      imageGuessed: !!pc.imageGuessed,
      productId: pc.productId,
      extraProductIds: pc.extraProductIds || [],
      price: productById.get(pc.productId)?.price ?? null,
    }));
  const slug = bucket.replace(/[^a-z0-9]+/gi, '-');

  async function grid(items, cols, cellW, cellH, labelH, render, outName) {
    const paths = [];
    const perPage = cols * Math.floor(1560 / (cellH + labelH));
    for (let pg = 0; pg * perPage < items.length; pg++) {
      const slice = items.slice(pg * perPage, (pg + 1) * perPage);
      const rows = Math.ceil(slice.length / cols);
      const comps = [];
      for (const [i, it] of slice.entries()) {
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * (cellH + labelH);
        comps.push(...(await render(it, x, y)));
      }
      const out = join(SHEETS, `${outName}-${pg + 1}.jpg`);
      await sharp({ create: { width: cols * cellW, height: rows * (cellH + labelH), channels: 3, background: { r: 50, g: 50, b: 50 } } })
        .composite(comps)
        .jpeg({ quality: 84 })
        .toFile(out);
      paths.push(out);
    }
    return paths;
  }

  const candPages = await grid(cands, 6, 260, 230, 40, async (c, x, y) => {
    const nm = esc(c.name.replace(/^[\s:]*(92\.?5|999)?\s*(pure|sterling|fine)?\s*(silver)?\s*/i, '').slice(0, 34));
    return [
      { input: await tile(c.image || '', 256, 230), left: x + 2, top: y },
      {
        input: Buffer.from(
          `<svg width="260" height="40"><rect width="260" height="40" fill="#141414"/><text x="4" y="16" font-size="15" font-weight="bold" fill="#ffd970" font-family="sans-serif">${c.id}</text><text x="48" y="15" font-size="12" fill="#ddd" font-family="sans-serif">${nm}</text><text x="4" y="34" font-size="11" fill="#999" font-family="sans-serif">${c.price ? 'Rs ' + c.price : ''}${c.imageGuessed ? '  (near photo)' : ''}</text></svg>`,
        ),
        left: x,
        top: y + 230,
      },
    ];
  }, `vm-${slug}-cands`);

  const fItems = und.map((f, i) => ({ ...f, idx: FROM + i + 1 }));
  const folderPages = await grid(fItems, 4, 390, 190, 26, async (f, x, y) => {
    const dir = join(ROOT, ...f.folder.split('/'));
    const shots = [...f.photos].sort((a, b) => ({ product: 0, original: 1, model: 2 })[a.kind] - ({ product: 0, original: 1, model: 2 })[b.kind]).slice(0, 2);
    const out = [];
    for (const [k, s] of shots.entries()) out.push({ input: await tile(join(dir, s.file), 190, 190), left: x + k * 192, top: y });
    out.push({
      input: Buffer.from(
        `<svg width="390" height="26"><rect width="390" height="26" fill="#0d2a33"/><text x="5" y="19" font-size="16" font-weight="bold" fill="#7fe0ff" font-family="sans-serif">#${f.idx}</text><text x="52" y="18" font-size="12" fill="#cde" font-family="sans-serif">${esc(basename(f.folder).slice(0, 44))} (${f.photos.map((p) => p.kind[0]).join('')})</text></svg>`,
      ),
      left: x,
      top: y + 190,
    });
    return out;
  }, `vm-${slug}-folders`);

  writeFileSync(
    OVERVIEW,
    JSON.stringify({ bucket, folders: fItems.map((f) => ({ idx: f.idx, folder: f.folder })), cands: cands.map(({ image, ...c }) => c) }, null, 2),
  );
  console.log(`candidates (${cands.length}): ${candPages.join('  ')}`);
  console.log(`folders    (${fItems.length}): ${folderPages.join('  ')}`);
  for (const c of cands) console.log(`  ${c.id.padEnd(5)} ${c.name.slice(0, 100)}`);
  process.exit(0);
}

if (flag('validate')) {
  const errs = [];
  for (let i = 0; i < anchors.length; i++) {
    const rest = anchors.filter((_, j) => j !== i);
    const { p, spread } = estimate(anchors[i].f, rest);
    errs.push({ err: Math.abs(p - anchors[i].p), inWindow: Math.abs(p - anchors[i].p) <= Math.max(4, spread) });
  }
  errs.sort((a, b) => a.err - b.err);
  const q = (x) => errs[Math.min(errs.length - 1, Math.floor(errs.length * x))]?.err.toFixed(1);
  console.log(`${bucket}: pieces=${pieces.length} folders=${folders.length} anchors=${anchors.length}`);
  if (errs.length) {
    console.log(`  position error (pieces): median ${q(0.5)}, p80 ${q(0.8)}, max ${errs[errs.length - 1].err.toFixed(1)}`);
    console.log(`  true piece inside candidate window: ${errs.filter((e) => e.inWindow).length}/${errs.length}`);
  }
  process.exit(0);
}

// -- Render next sheet -------------------------------------------------------

const NEXT = Number(arg('next') || 3);
const MAXC = Number(arg('max') || 12);
const BLIND = Number(arg('blind') || 0);
const MINW = Number(arg('minwindow') || 7);
const SKIP = Number(arg('skip') || 0);

/** Folders to render: undecided ones, or - for a blind test - known ones with their answer hidden. */
let targets;
if (BLIND) {
  const step = Math.max(1, Math.floor(anchors.length / BLIND));
  const offset = Number(arg('offset') || 0);
  targets = anchors.filter((_, i) => (i + offset) % step === Math.floor(step / 2)).slice(0, BLIND).map((a) => {
    const f = folders.find((x) => x.folder === a.folder);
    const truth = state.done[a.folder]?.productId || decisions[a.folder]?.productIds?.[0];
    return { f, truth, anchors: anchors.filter((x) => x.folder !== a.folder) };
  });
} else {
  targets = folders
    .filter((f) => !state.done[f.folder] && !decisions[f.folder])
    .slice(SKIP)
    .map((f) => ({ f, truth: null, anchors }));
}
const undecided = folders.filter((f) => !state.done[f.folder] && !decisions[f.folder]);
const blocks = [];
const noCandidates = [];

for (const { f, truth, anchors: anc } of targets) {
  if (blocks.length >= NEXT) break;
  const { p, spread } = estimate(f.rank, anc);
  const W = flag('all-candidates') ? Infinity : Math.max(MINW, Math.min(40, spread));
  const cands = pieces
    .filter((pc) => pc.productId && (!takenProducts.has(pc.productId) || pc.productId === truth))
    .map((pc) => ({ pc, d: Math.abs(pc.rank - p) }))
    .filter((x) => x.d <= W)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAXC)
    .sort((a, b) => a.pc.rank - b.pc.rank);
  if (!cands.length) {
    noCandidates.push(f.folder);
    continue;
  }
  blocks.push({
    folder: f.folder,
    truth,
    rank: f.rank,
    estPiece: Number(p.toFixed(1)),
    photos: f.photos,
    candidates: cands.map((x, i) => ({
      letter: String.fromCharCode(65 + i),
      piece: `${x.pc.cat}/${x.pc.base}`,
      pieceRank: x.pc.rank,
      name: x.pc.name,
      image: x.pc.image,
      imageGuessed: !!x.pc.imageGuessed,
      productId: x.pc.productId,
      extraProductIds: x.pc.extraProductIds || [],
      price: productById.get(x.pc.productId)?.price ?? null,
    })),
  });
}

if (!blocks.length) {
  console.log(`${bucket}: nothing left to render.`);
  if (noCandidates.length) console.log(`  ${noCandidates.length} undecided folders have no unclaimed candidates nearby.`);
  process.exit(0);
}

const Q = 234; // query tile
const CW = 220; // candidate cell width
const CI = 196; // candidate image height
const CL = 38; // candidate label height
const PER_ROW = 6;
const SEP = 8;
const rowH = CI + CL;
const ROWS = Math.max(2, Math.ceil(Math.max(...blocks.map((b) => b.candidates.length)) / PER_ROW));
const blockH = ROWS * rowH;
const W = Q + PER_ROW * CW;
const H = blocks.length * blockH + (blocks.length - 1) * SEP;

async function tile(path, w, h) {
  try {
    return await sharp(readFileSync(path))
      .rotate()
      .resize(w, h, { fit: 'contain', background: { r: 18, g: 18, b: 18 } })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    const svg = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#402020"/><text x="10" y="${h / 2}" font-size="14" fill="#fff" font-family="sans-serif">cannot decode</text></svg>`;
    return sharp(Buffer.from(svg)).jpeg().toBuffer();
  }
}

const comps = [];
for (const [bi, b] of blocks.entries()) {
  const y0 = bi * (blockH + SEP);
  const folderDir = join(ROOT, ...b.folder.split('/'));
  // A blind test must look like a real unnamed folder, and those never have the original photo.
  const ordered = [...b.photos]
    .filter((ph) => !BLIND || ph.kind !== 'original')
    .sort((a, c) => ({ product: 0, original: 1, model: 2 })[a.kind] - ({ product: 0, original: 1, model: 2 })[c.kind]);
  for (let k = 0; k < Math.min(2, ordered.length); k++) {
    comps.push({ input: await tile(join(folderDir, ordered[k].file), Q, Q), left: 0, top: y0 + k * Q });
  }
  const qlabel = `<svg width="${Q}" height="30"><rect width="${Q}" height="30" fill="#000" opacity="0.75"/><text x="6" y="21" font-size="17" font-weight="bold" fill="#7fe0ff" font-family="sans-serif">BLOCK ${bi + 1}${BLIND ? '' : ': ' + esc(basename(b.folder).slice(0, 18))}</text></svg>`;
  comps.push({ input: Buffer.from(qlabel), left: 0, top: y0 });

  for (const [ci, c] of b.candidates.entries()) {
    const col = ci % PER_ROW;
    const row = Math.floor(ci / PER_ROW);
    const x = Q + col * CW;
    const y = y0 + row * rowH;
    comps.push({ input: c.image ? await tile(c.image, CW - 4, CI) : await tile('', CW - 4, CI), left: x + 2, top: y });
    const nm = esc(c.name.replace(/^[\s:]*(92\.?5|999)?\s*(pure|sterling|fine)?\s*(silver)?\s*/i, '').slice(0, 30));
    const lab = `<svg width="${CW}" height="${CL}"><rect width="${CW}" height="${CL}" fill="#141414"/><text x="4" y="16" font-size="16" font-weight="bold" fill="#ffd970" font-family="sans-serif">${c.letter}</text><text x="22" y="15" font-size="12" fill="#ddd" font-family="sans-serif">${nm}</text><text x="4" y="33" font-size="11" fill="#999" font-family="sans-serif">piece ${c.pieceRank}${c.price ? '  Rs ' + c.price : ''}${c.imageGuessed ? '  (near photo)' : ''}</text></svg>`;
    comps.push({ input: Buffer.from(lab), left: x, top: y + CI });
  }
}

const slug = bucket.replace(/[^a-z0-9]+/gi, '-');
const out = join(SHEETS, `vm-${slug}.jpg`);
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 60, g: 60, b: 60 } } })
  .composite(comps)
  .jpeg({ quality: 84 })
  .toFile(out);
writeFileSync(PENDING, JSON.stringify({ bucket, sheet: out, blind: !!BLIND, blocks }, null, 2));

console.log(`sheet: ${out}${BLIND ? '   (BLIND TEST - answers hidden)' : ''}`);
console.log(`anchors: ${anchors.length}  undecided: ${undecided.length}  no-candidate: ${noCandidates.length}`);
for (const [bi, b] of blocks.entries()) {
  const shown = b.photos.filter((ph) => !BLIND || ph.kind !== 'original');
  console.log(`\nBLOCK ${bi + 1}  ${BLIND ? '(hidden)' : b.folder}  (folder rank ${b.rank}, est. piece ${b.estPiece}; photos: ${shown.map((p) => p.kind[0]).join('')})`);
  for (const c of b.candidates) console.log(`  ${c.letter}  p${c.pieceRank}  ${c.name.slice(0, 95)}`);
}
