// Server tests for gap G1: /api/create-order leaves the priced cart lines in the
// Razorpay order's notes, and /api/verify-payment records the payment as
// payments/{paymentId} for the signed-in customer. Real source, fake
// firebase-admin, fake Razorpay, fake Identity Toolkit and fake Firestore REST.
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.argv[2] || '.');
const { build } = createRequire(repo + '/package.json')('esbuild');
const out = path.join(here, 'out');
const alias = {
  name: 'alias',
  setup(b) {
    b.onResolve({ filter: /^firebase-admin$/ }, () => ({ path: pathToFileURL(path.join(here, 'fake-firebase-admin.mjs')).href, external: true }));
  },
};
for (const [entry, name] of [['api/verify-payment.ts', 'verify-payment.mjs'], ['api/create-order.ts', 'create-order.mjs']]) {
  await build({ entryPoints: [path.join(repo, entry)], bundle: true, format: 'esm', platform: 'node', outfile: path.join(out, name), plugins: [alias], external: ['@vercel/node'], logLevel: 'error' });
}

// Read at module load by both functions.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
process.env.FIREBASE_PROJECT_ID = 'demo-shop';
process.env.FIREBASE_API_KEY = 'web-key';
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_ADMIN_SDK_BASE64;

const vp = await import(pathToFileURL(path.join(out, 'verify-payment.mjs')).href);
const co = await import(pathToFileURL(path.join(out, 'create-order.mjs')).href);

let passed = 0;
const t = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log('  ok  ', name);
  } catch (e) {
    console.log('  FAIL', name, '\n', e);
    process.exitCode = 1;
  }
};

// ── Fake services ──────────────────────────────────────────────────────────
const fs = new Map(); // Firestore REST: 'payments/pay_1' -> REST document
const rzp = { payments: new Map(), orders: new Map(), created: [] };
const calls = [];
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const FS = 'https://firestore.googleapis.com/v1/projects/demo-shop/databases/(default)/documents';
const str = (v) => ({ stringValue: v });
const int = (v) => ({ integerValue: String(v) });

globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const method = init.method || 'GET';
  const auth = init.headers?.Authorization || init.headers?.authorization;
  calls.push({ url, method, auth, body: init.body });
  if (url.startsWith('https://api.razorpay.com/v1/')) {
    const p = url.slice('https://api.razorpay.com/v1'.length);
    if (method === 'POST' && p === '/orders') {
      const body = JSON.parse(init.body);
      rzp.created.push(body);
      return json({ id: 'order_new', amount: body.amount, currency: body.currency });
    }
    const [, kind, id] = p.split('/');
    const hit = rzp[kind]?.get(decodeURIComponent(id));
    return hit ? json(hit) : json({ error: { description: 'not found' } }, 404);
  }
  if (url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken')) {
    const { token } = JSON.parse(init.body);
    return json({ idToken: `id-for(${token})`, expiresIn: '3600' });
  }
  if (url.startsWith(FS)) {
    const rest = url.slice(FS.length + 1);
    if (method === 'POST' && rest.startsWith('payments?documentId=')) {
      const id = decodeURIComponent(rest.split('=')[1]);
      if (fs.has(`payments/${id}`)) return json({ error: { status: 'ALREADY_EXISTS' } }, 409);
      fs.set(`payments/${id}`, JSON.parse(init.body));
      return json({ name: id });
    }
    if (method === 'POST' && rest.startsWith(':runQuery')) return json([{}]);
    const docPath = rest.split('?')[0];
    return fs.has(docPath) ? json(fs.get(docPath)) : json({ error: { status: 'NOT_FOUND' } }, 404);
  }
  throw new Error(`unexpected fetch ${method} ${url}`);
};

const call = async (mod, body, token) => {
  let status = 0;
  let payload = null;
  const res = {
    setHeader() {},
    status(c) { status = c; return this; },
    json(p) { payload = p; return this; },
    end() { return this; },
  };
  await mod.default({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return { status, payload };
};
const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', 'test_secret').update(`${orderId}|${paymentId}`).digest('hex');
const paid = (orderId, paymentId) => ({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });
const razorpayOrder = (id, lines) => {
  rzp.orders.set(id, { id, amount: 150000, notes: co.packLines(lines) });
};
const razorpayPayment = (id, orderId, extra = {}) => {
  rzp.payments.set(id, { id, order_id: orderId, status: 'captured', amount: 150000, currency: 'INR', ...extra });
};
const record = (id) => fs.get(`payments/${id}`)?.fields;
const LINES = [{ productId: 'ring1', quantity: 1 }, { productId: 'chain7', quantity: 2 }];

console.log('\n/api/verify-payment');
razorpayOrder('order_1', LINES);
razorpayPayment('pay_1', 'order_1');

await t('a forged signature is refused and nothing is recorded', async () => {
  const r = await call(vp, { ...paid('order_1', 'pay_1'), razorpay_signature: 'f'.repeat(64) }, 'uid:cust1');
  assert.equal(r.status, 400);
  assert.equal(r.payload.verified, false);
  assert.equal(record('pay_1'), undefined);
});

await t('a genuine payment is recorded for the signed-in customer', async () => {
  calls.length = 0;
  const r = await call(vp, paid('order_1', 'pay_1'), 'uid:cust1');
  assert.equal(r.status, 200);
  assert.deepEqual([r.payload.verified, r.payload.recorded], [true, true]);
  const f = record('pay_1');
  assert.equal(f.userId.stringValue, 'cust1');
  assert.equal(f.razorpayPaymentId.stringValue, 'pay_1');
  assert.equal(f.razorpayOrderId.stringValue, 'order_1');
  assert.equal(f.amountPaise.integerValue, '150000');
  assert.equal(f.status.stringValue, 'captured');
  assert.deepEqual(
    f.lines.arrayValue.values.map((v) => [v.mapValue.fields.productId.stringValue, v.mapValue.fields.quantity.integerValue]),
    [['ring1', '1'], ['chain7', '2']],
  );
});

await t('it writes as the service identity with the paymentServer claim', async () => {
  const signIn = calls.find((c) => c.url.includes('signInWithCustomToken'));
  assert.ok(signIn.url.endsWith('?key=web-key'));
  assert.equal(JSON.parse(signIn.body).token, 'custom:razorpay-verifier:{"paymentServer":true}');
  const write = calls.find((c) => c.method === 'POST' && c.url.includes('/payments?documentId=pay_1'));
  assert.equal(write.auth, 'Bearer id-for(custom:razorpay-verifier:{"paymentServer":true})');
});

await t('a retry of the same payment by the same customer is fine', async () => {
  const r = await call(vp, paid('order_1', 'pay_1'), 'uid:cust1');
  assert.deepEqual([r.payload.verified, r.payload.recorded], [true, true]);
});

await t("another account cannot claim someone else's payment", async () => {
  const r = await call(vp, paid('order_1', 'pay_1'), 'uid:mallory');
  assert.deepEqual([r.payload.verified, r.payload.recorded], [true, false]);
  assert.equal(record('pay_1').userId.stringValue, 'cust1');
});

const notRecorded = async (name, id, orderId, token, setup) => {
  await t(name, async () => {
    setup?.();
    const r = await call(vp, paid(orderId, id), token);
    assert.equal(r.status, 200, 'a paying customer is never told the payment failed');
    assert.deepEqual([r.payload.verified, r.payload.recorded], [true, false]);
    assert.ok(r.payload.recordError);
    assert.equal(record(id), undefined);
  });
};
await notRecorded('no sign-in token: verified, but not recorded', 'pay_2', 'order_1', null, () => razorpayPayment('pay_2', 'order_1'));
await notRecorded('an expired token: verified, but not recorded', 'pay_3', 'order_1', 'expired', () => razorpayPayment('pay_3', 'order_1'));
await notRecorded('a payment for a different Razorpay order is not recorded', 'pay_4', 'order_1', 'uid:cust1', () => razorpayPayment('pay_4', 'order_other'));
await notRecorded('a failed payment is not recorded', 'pay_5', 'order_1', 'uid:cust1', () => razorpayPayment('pay_5', 'order_1', { status: 'failed' }));
await notRecorded('a payment in another currency is not recorded', 'pay_7', 'order_1', 'uid:cust1', () => razorpayPayment('pay_7', 'order_1', { currency: 'USD' }));
await notRecorded('an order without priced lines is not recorded', 'pay_6', 'order_bare', 'uid:cust1', () => {
  rzp.orders.set('order_bare', { id: 'order_bare', amount: 150000, notes: { orderNumber: 'SRS1' } });
  razorpayPayment('pay_6', 'order_bare');
});

await t('parseLines refuses notes whose count does not match', async () => {
  assert.deepEqual(vp.parseLines({ srs_line_count: '3', srs_lines_0: 'a*1,b*2' }), []);
  assert.deepEqual(vp.parseLines({ srs_line_count: '1', srs_lines_0: 'a*0' }), []);
  assert.deepEqual(vp.parseLines(undefined), []);
});

await t('30 long product ids pack into notes of 256 characters or less and read back', async () => {
  const lines = Array.from({ length: 30 }, (_, i) => ({ productId: `prod${String(i).padStart(16, '0')}`, quantity: 1 + (i % 4) }));
  const notes = co.packLines(lines);
  assert.ok(Object.values(notes).every((v) => v.length <= 256));
  assert.ok(Object.keys(notes).length <= 13);
  assert.deepEqual(vp.parseLines(notes), lines);
});

console.log('\n/api/create-order');
const product = (price, extra = {}) => ({
  fields: { name: str('Item'), price: int(price), category: str('Rings'), inventory: { mapValue: { fields: { stock: int(10) } } }, ...extra },
});
fs.set('products/ring1', product(500));
fs.set('products/chain7', product(500));

await t('the priced cart lines go into the Razorpay notes, in cart order', async () => {
  const r = await call(co, { items: [{ productId: 'ring1', quantity: 1 }, { productId: 'chain7', quantity: 2 }], shippingState: 'Andhra Pradesh', notes: { orderNumber: 'SRS1', userId: 'cust1' } });
  assert.equal(r.status, 200, JSON.stringify(r.payload));
  const notes = rzp.created.at(-1).notes;
  assert.deepEqual(vp.parseLines(notes), LINES);
  assert.equal(notes.orderNumber, 'SRS1');
  assert.equal(rzp.created.at(-1).currency, 'INR');
  assert.equal(rzp.created.at(-1).payment_capture, 1);
});

await t('the client cannot pick the currency', async () => {
  const r = await call(co, { items: [{ productId: 'ring1', quantity: 1 }], currency: 'IDR' });
  assert.equal(r.status, 200, JSON.stringify(r.payload));
  assert.equal(rzp.created.at(-1).currency, 'INR');
});

await t('a client cannot plant its own srs_ lines or extra notes', async () => {
  const r = await call(co, {
    items: [{ productId: 'ring1', quantity: 1 }],
    notes: { orderNumber: 'SRS2', srs_line_count: '2', srs_lines_0: 'diamond*1', srs_lines_1: 'gold*5', other: 'x' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.payload));
  const notes = rzp.created.at(-1).notes;
  assert.deepEqual(vp.parseLines(notes), [{ productId: 'ring1', quantity: 1 }]);
  assert.equal(notes.srs_lines_1, undefined);
  assert.equal(notes.other, undefined);
});

await t('more than 25 cart lines are refused before any payment', async () => {
  const before = rzp.created.length;
  const items = Array.from({ length: 26 }, (_, i) => ({ productId: `p${i}`, quantity: 1 }));
  const r = await call(co, { items });
  assert.equal(r.status, 400);
  assert.equal(rzp.created.length, before);
});

await t('a product id with a comma or star is refused', async () => {
  const r = await call(co, { items: [{ productId: 'ring1,x*9', quantity: 1 }] });
  assert.equal(r.status, 400);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
