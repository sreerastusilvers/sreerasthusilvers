// Build-time SEO prerender. Runs after `vite build` (see package.json "build").
//
// The storefront is a client-rendered React app, so without this every URL
// returned the same empty <div id="root"> and one generic title. This writes:
//   dist/shell.html                 neutral SPA shell (vercel.json catch-all)
//   dist/index.html                 home page with its own head + crawlable links
//   dist/<static page>/index.html   about, contact, policies...
//   dist/category/<slug>/index.html every category that has products
//   dist/product/<id>/index.html    every active product (head, JSON-LD, content)
//   dist/sitemap.xml                all of the above, with product images
//
// The HTML inside #root is the same content the page shows (name, photo,
// price, description); React replaces it on start. Vercel serves these files
// before the rewrites, so new products added after a deploy still work through
// the SPA shell (and /api/media for link previews) until the next deploy.
//
// Network failures never fail the build: products/categories are skipped with a
// warning and the shell + static pages are still written.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_IMAGE,
  SITE_NAME,
  SITE_URL,
  STATIC_PAGES,
  absoluteUrl,
  categorySeo,
  formatInr,
  productCategory,
  productSeo,
  storeJsonLd,
  websiteJsonLd,
} from '../../src/lib/seo/core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const CATALOG_URL = 'https://images.sreerasthusilvers.com/catalog/products.json';
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'sreerasthusilvers-33eb1';
const CATEGORIES_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/categories?pageSize=100`;
const MANAGED_IMAGE = /^(https?:\/\/[^?#]+\/m[0-9a-f]{24})\.(jpg|png|webp)$/;
const PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG = /^[a-z0-9-]{1,64}$/; // categories with any other slug are skipped (safe in paths and HTML)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ld = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

async function fetchJson(url, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Same JPEG copy /api/media uses for link previews (WhatsApp drops big/webp images). */
async function ogImageFor(src) {
  const m = MANAGED_IMAGE.exec(src || '');
  if (!m) return src;
  const og = `${m[1]}__og.jpg`;
  try {
    const r = await fetch(og, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    if (r.ok) return og;
  } catch {
    /* fall back to the photo */
  }
  return src;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function headBlock({ title, description, canonical, image, imageAlt, type = 'website', robots, jsonLd = [] }) {
  const img = image || DEFAULT_IMAGE;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${robots || 'index, follow, max-image-preview:large'}" />`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : '',
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : '',
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt || title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    ...jsonLd.map((o) => `<script type="application/ld+json" data-seo="ld">${ld(o)}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ');
}

// Inline so it paints before the app's CSS loads; React replaces it on start.
const PR_STYLE = `<style>.pr{max-width:960px;margin:0 auto;padding:24px 16px;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#2b2b2b}.pr a{color:#80282b}.pr h1{font-size:1.6rem;line-height:1.3;margin:.4em 0}.pr img{max-width:100%;height:auto;border-radius:12px}.pr ul.grid{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.pr nav{font-size:.9rem}</style>`;

function render(template, head, body) {
  const start = template.indexOf('<!-- seo:start -->');
  const end = template.indexOf('<!-- seo:end -->');
  if (start < 0 || end < 0) throw new Error('index.html is missing the <!-- seo:start --> / <!-- seo:end --> markers');
  let html = `${template.slice(0, start)}<!-- seo:start -->\n    ${head}\n    ${template.slice(end)}`;
  if (body) {
    if (!html.includes('<div id="root"></div>')) throw new Error('index.html is missing <div id="root"></div>');
    html = html.replace('<div id="root"></div>', `<div id="root">${PR_STYLE}<main class="pr">${body}</main></div>`);
  }
  return html;
}

async function write(route, html) {
  const file = route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, ...route.split('/').filter(Boolean), 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, 'utf8');
}

const productLink = (p) =>
  `<li><a href="/product/${encodeURIComponent(p.id)}">${esc(p.name)}</a>${typeof p.price === 'number' ? ` – ${formatInr(p.price)}` : ''}</li>`;

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');

  // 1. Neutral SPA shell first: vercel.json's catch-all serves it, so it must
  //    exist even if everything below fails.
  await writeFile(
    path.join(DIST, 'shell.html'),
    render(template, headBlock({ title: SITE_NAME, description: STATIC_PAGES['/'].description, robots: 'noindex, follow' })),
    'utf8',
  );

  // 2. Data.
  let products = [];
  let categories = [];
  try {
    const cat = await fetchJson(CATALOG_URL);
    products = (cat.products || []).filter((p) => p?.flags?.isActive !== false && PRODUCT_ID.test(p.id || ''));
  } catch (err) {
    console.warn(`[seo] catalog unavailable, product pages skipped: ${err.message}`);
  }
  try {
    const j = await fetchJson(CATEGORIES_URL);
    categories = (j.documents || [])
      .map((d) => ({ slug: d.fields?.slug?.stringValue, name: d.fields?.name?.stringValue }))
      .filter((c) => c.name && SLUG.test(c.slug || ""));
  } catch (err) {
    console.warn(`[seo] categories unavailable, category pages skipped: ${err.message}`);
  }
  const updated = (p) => Number(p.updatedAt?.seconds || p.createdAt?.seconds || 0);
  products.sort((a, b) => updated(b) - updated(a));

  // Same matching as CategoryPage: by category name, else by subcategory slug.
  const norm = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const inCategory = (c) => {
    const direct = products.filter((p) => String(p.category || '').toLowerCase() === c.name.toLowerCase());
    return direct.length ? direct : products.filter((p) => norm(p.subcategory) === c.slug);
  };
  const liveCategories = categories.map((c) => ({ ...c, items: inCategory(c) })).filter((c) => c.items.length > 0);

  const sitemap = [];
  const today = new Date().toISOString().slice(0, 10);
  const iso = (s) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : today);

  // 3. Home.
  const categoryNav = liveCategories.length
    ? `<nav aria-label="Categories"><ul>${liveCategories
        .map((c) => `<li><a href="/category/${c.slug}">${esc(c.name)}</a> (${c.items.length})</li>`)
        .join('')}</ul></nav>`
    : '';
  {
    const page = STATIC_PAGES['/'];
    await write(
      '/',
      render(
        template,
        headBlock({ ...page, canonical: absoluteUrl('/'), jsonLd: [storeJsonLd(), websiteJsonLd()] }),
        `<h1>${esc(page.h1)}</h1><p>${esc(page.description)}</p>${categoryNav}` +
          (products.length ? `<h2>New arrivals</h2><ul>${products.slice(0, 40).map(productLink).join('')}</ul>` : '') +
          `<p><a href="/products">See all silver products</a> · <a href="/contact">Visit our Kakinada store</a></p>`,
      ),
    );
    sitemap.push({ loc: absoluteUrl('/'), lastmod: today, priority: '1.0' });
  }

  // 4. Static pages (head only; their text is in the React page).
  for (const [route, page] of Object.entries(STATIC_PAGES)) {
    if (route === '/') continue;
    const isList = route === '/products';
    const body =
      `<h1>${esc(page.h1)}</h1><p>${esc(page.description)}</p>` +
      (isList ? `${categoryNav}<ul>${products.map(productLink).join('')}</ul>` : '');
    await write(
      route,
      render(template, headBlock({ ...page, canonical: absoluteUrl(route), jsonLd: route === '/contact' ? [storeJsonLd()] : [] }), body),
    );
    sitemap.push({ loc: absoluteUrl(route), lastmod: today, priority: isList ? '0.8' : route === '/contact' || route === '/about' ? '0.6' : '0.3' });
  }

  // 5. Categories.
  for (const c of liveCategories) {
    const seo = categorySeo(c.slug, c.name);
    const body =
      `<nav><a href="/">Home</a> › ${esc(c.name)}</nav><h1>${esc(seo.h1)}</h1><p>${esc(seo.description)}</p>` +
      `<ul>${c.items.map(productLink).join('')}</ul>`;
    await write(`/category/${c.slug}`, render(template, headBlock({ ...seo }), body));
    sitemap.push({ loc: seo.canonical, lastmod: iso(Math.max(...c.items.map(updated))), priority: '0.9' });
  }

  // 6. Products.
  const seenLower = new Set();
  const ogImages = await pool(products, 16, (p) => ogImageFor(p.media?.thumbnail || p.media?.images?.[0]));
  let written = 0;
  for (const [i, p] of products.entries()) {
    const lower = p.id.toLowerCase();
    if (seenLower.has(lower)) {
      console.warn(`[seo] skipped ${p.id}: id differs from another only by case`);
      continue;
    }
    seenLower.add(lower);
    const where = productCategory(p, categories);
    const seo = productSeo(p, { categoryPath: where?.path, categoryName: where?.name });
    const specs = Object.entries(p.specifications || {})
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`)
      .join('');
    const body =
      `<nav><a href="/">Home</a>${where ? ` › <a href="${esc(where.path)}">${esc(where.name)}</a>` : ''}</nav>` +
      `<h1>${esc(seo.h1)}</h1>` +
      (seo.images[0] ? `<img src="${esc(seo.images[0])}" alt="${esc(seo.imageAlt)}" width="600" height="600" />` : '') +
      (seo.price ? `<p><strong>${formatInr(seo.price)}</strong> · ${seo.inStock ? 'In stock' : 'Out of stock'}</p>` : '') +
      (seo.about ? `<p>${esc(seo.about)}</p>` : '') +
      (specs ? `<ul>${specs}</ul>` : '') +
      `<p>Sold by ${esc(SITE_NAME)}, Rama Rao Peta, Kakinada. Delivered across India.</p>`;
    await write(
      `/product/${p.id}`,
      render(template, headBlock({ ...seo, image: ogImages[i] || seo.image, type: 'product' }), body),
    );
    sitemap.push({ loc: seo.canonical, lastmod: iso(updated(p)), priority: '0.7', images: seo.images.slice(0, 5), title: seo.h1 });
    written++;
  }

  // 7. Sitemap.
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    sitemap
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority>` +
          (u.images || []).map((img) => `<image:image><image:loc>${esc(img)}</image:loc></image:image>`).join('') +
          `</url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;
  await writeFile(path.join(DIST, 'sitemap.xml'), xml, 'utf8');

  console.log(
    `[seo] prerendered: home, ${Object.keys(STATIC_PAGES).length - 1} static, ${liveCategories.length} categories, ${written} products; sitemap ${sitemap.length} URLs (${SITE_URL})`,
  );
}

main().catch((err) => {
  console.error('[seo] prerender failed:', err);
  process.exit(1);
});
