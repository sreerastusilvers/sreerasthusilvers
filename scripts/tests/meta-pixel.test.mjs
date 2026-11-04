// Unit test for src/lib/metaPixel.ts. Run: npm run test:pixel
// Bundles the module twice with esbuild (Pixel ID set / empty) and runs it
// against a fake window, recording every fbq() call.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'meta-pixel-'));
let n = 0;

const entry = fileURLToPath(new URL('../../src/lib/metaPixel.ts', import.meta.url));

async function load(pixelId) {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    define: { 'import.meta.env': JSON.stringify({ VITE_META_PIXEL_ID: pixelId }) },
  });
  const code = out.outputFiles[0].text;
  // A new file per load = a fresh module instance (like a page reload).
  const file = join(tmp, `pixel-${n++}.mjs`);
  writeFileSync(file, code);
  return import(pathToFileURL(file).href);
}

function fakeBrowser(pathname) {
  const calls = [];
  const scripts = [];
  const store = new Map();
  globalThis.window = {
    location: { pathname },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
  };
  globalThis.document = {
    createElement: () => ({}),
    head: { appendChild: (s) => scripts.push(s) },
  };
  return {
    calls: () => (window.fbq ? window.fbq.queue.map((a) => [...a]) : calls),
    scripts,
    go: (p) => { window.location.pathname = p; },
  };
}

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

// ── Pixel ID empty: nothing loads, nothing is sent ──
{
  const b = fakeBrowser('/');
  const px = await load('');
  await test('disabled: no script, no fbq', () => {
    px.trackPageView();
    px.trackViewContent({ id: 'p1', name: 'Ring', price: 100 });
    assert.equal(px.trackPurchase('ORD1', [{ id: 'p1', quantity: 1 }], 100), false);
    assert.equal(px.isMetaPixelEnabled(), false);
    assert.equal(b.scripts.length, 0);
    assert.equal(window.fbq, undefined);
  });
}

// ── Pixel ID set ──
{
  const b = fakeBrowser('/admin/dashboard');
  const px = await load('1234567890');
  const tracks = () => b.calls().filter((c) => c[0] === 'track');

  await test('admin page: script not even loaded', () => {
    px.trackPageView();
    assert.equal(b.scripts.length, 0);
    assert.equal(window.fbq, undefined);
  });

  await test('isTrackablePath blocks staff and auth-code pages only', () => {
    for (const p of ['/admin', '/admin/', '/ADMIN/orders', '/delivery/dashboard', '/deliverypartner',
      '/reset-password', '/auth/action', '/__/auth/action', '/verify-email', '/auth/verify-email']) {
      assert.equal(px.isTrackablePath(p), false, p);
    }
    for (const p of ['/', '/product/abc', '/checkout', '/category/jewellery', '/administer', '/login']) {
      assert.equal(px.isTrackablePath(p), true, p);
    }
  });

  await test('first trackable page: base code + init with autoConfig off, pushState off', () => {
    b.go('/');
    px.trackPageView();
    assert.equal(b.scripts.length, 1);
    assert.equal(b.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
    assert.equal(window.fbq.disablePushState, true);
    const q = b.calls();
    assert.deepEqual(q[0], ['set', 'autoConfig', false, '1234567890']);
    assert.deepEqual(q[1], ['init', '1234567890']);
    assert.deepEqual(q[2], ['track', 'PageView', {}]);
  });

  await test('ViewContent / AddToCart / InitiateCheckout params', () => {
    b.go('/product/p1');
    px.trackViewContent({ id: 'p1', name: 'Silver Ring', price: 1499.999 });
    px.trackAddToCart({ id: 'p1', name: 'Silver Ring', price: 1500 }, 2);
    px.trackInitiateCheckout([{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }], 4200);
    const [vc, atc, ic] = tracks().slice(-3);
    assert.deepEqual(vc, ['track', 'ViewContent',
      { content_ids: ['p1'], content_type: 'product', content_name: 'Silver Ring', value: 1500, currency: 'INR' }]);
    assert.deepEqual(atc, ['track', 'AddToCart',
      { content_ids: ['p1'], content_type: 'product', content_name: 'Silver Ring', value: 3000, currency: 'INR', quantity: 2 }]);
    assert.deepEqual(ic, ['track', 'InitiateCheckout',
      { content_ids: ['p1', 'p2'], num_items: 3, content_type: 'product', value: 4200, currency: 'INR' }]);
  });

  await test('Purchase: eventID = order id, fires once per order', () => {
    b.go('/checkout');
    const lines = [{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }];
    assert.equal(px.trackPurchase('SRS-1001', lines, 4250.5), true);
    assert.equal(px.trackPurchase('SRS-1001', lines, 4250.5), false);
    const purchases = tracks().filter((c) => c[1] === 'Purchase');
    assert.equal(purchases.length, 1);
    assert.deepEqual(purchases[0], ['track', 'Purchase',
      { content_ids: ['p1', 'p2'], num_items: 3, content_type: 'product', value: 4250.5, currency: 'INR' },
      { eventID: 'SRS-1001' }]);
    assert.deepEqual(JSON.parse(window.localStorage.getItem('meta_pixel_purchases')), ['SRS-1001']);
  });

  await test('Purchase dedupe survives a reload (localStorage)', async () => {
    const stored = window.localStorage.getItem('meta_pixel_purchases');
    const saved = [globalThis.window, globalThis.document];
    const b2 = fakeBrowser('/checkout');
    window.localStorage.setItem('meta_pixel_purchases', stored);
    const px2 = await load('1234567890');
    assert.equal(px2.trackPurchase('SRS-1001', [{ id: 'p1', quantity: 1 }], 10), false);
    assert.equal(px2.trackPurchase('SRS-1002', [{ id: 'p1', quantity: 1 }], 10), true);
    assert.equal(b2.calls().filter((c) => c[1] === 'Purchase').length, 1);
    [globalThis.window, globalThis.document] = saved;
  });

  await test('no event on admin pages after init', () => {
    const before = tracks().length;
    b.go('/admin/orders');
    px.trackPageView();
    px.trackAddToCart({ id: 'p1', name: 'x', price: 1 }, 1);
    assert.equal(tracks().length, before);
  });

  await test('no personal-data keys in any payload', () => {
    const banned = /name$|phone|email|mobile|address|^em$|^ph$|^fn$|^ln$/i;
    for (const c of tracks()) {
      for (const k of Object.keys(c[2] || {})) {
        if (k === 'content_name') continue;
        assert.ok(!banned.test(k), `PII-like key ${k} in ${c[1]}`);
      }
    }
  });
}

console.log(`\nmeta-pixel: ${passed} passed`);
