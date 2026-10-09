// Jewellery offer: the rules, and that api/create-order.ts carries an identical copy.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = path.resolve(process.argv[2] || '.');
const { build } = createRequire(repo + '/package.json')('esbuild');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const bundle = async (entry, name) => {
  const out = path.join(outDir, name);
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['@vercel/node'] });
  return import(pathToFileURL(out).href);
};
const client = await bundle(repo + '/src/lib/jewelleryOffer.ts', 'jewellery-offer-client.mjs');
const server = await bundle(repo + '/api/create-order.ts', 'jewellery-offer-server.mjs');
const { computeJewelleryOffer: offer, sanitizeOfferSettings: clean, DEFAULT_JEWELLERY_OFFER: D } = client;

const on = { ...D, enabled: true };
const J = (id, price, qty = 1) => ({ productId: id, category: 'Jewellery', unitPrice: price, quantity: qty });
const X = (id, price, qty = 1) => ({ productId: id, category: 'Furniture', unitPrice: price, quantity: qty });
let n = 0;
const check = (label, got, want) => { n++; assert.deepEqual(got, want, label); };

// 1. Switched off: nothing.
check('off', offer(D, [J('a', 120000), X('b', 20000)]).discount, 0);
// 2. ₹1,00,000 of jewellery + a ₹20,000 article: article free.
let r = offer(on, [J('a', 100000), X('b', 20000)]);
check('1L tier frees article', [r.discount, r.giftProductId, r.credit], [20000, 'b', 30000]);
// 3. Free item worth more than the credit: credit comes off, rest is paid.
r = offer(on, [J('a', 100000), X('b', 45000)]);
check('credit capped', [r.discount, r.giftProductId], [30000, 'b']);
// 4. Tiers: 50k → 15k, 25k → 7k, below 25k → nothing.
check('50k tier', offer(on, [J('a', 50000), X('b', 40000)]).discount, 15000);
check('25k tier', offer(on, [J('a', 25000), X('b', 40000)]).discount, 7000);
check('below 25k', offer(on, [J('a', 24999), X('b', 40000)]).discount, 0);
// 5. The free unit never counts towards its own threshold.
r = offer(on, [J('a', 30000)]);
check('lone ring cannot pay for itself', [r.discount, r.unlocked?.credit], [0, 7000]);
// 6. Two of the same ring: one pays for the other.
r = offer(on, [J('a', 60000, 2)]);
check('qty 2 same ring', [r.discount, r.giftProductId, r.qualifyingSpend], [15000, 'a', 60000]);
// 7. Best line is chosen automatically: chain as gift keeps ring's 1L in the spend.
r = offer(on, [J('ring', 100000), J('chain', 30000)]);
check('auto best', [r.giftProductId, r.discount], ['chain', 30000]);
// 8. Customer's explicit pick is honoured even when worse.
r = offer(on, [J('ring', 100000), J('chain', 30000)], { giftProductId: 'ring' });
check('explicit pick', [r.giftProductId, r.discount], ['ring', 7000]);
// 9. Non-jewellery spend does not qualify.
check('furniture spend', offer(on, [X('sofa', 200000), X('b', 5000)]).discount, 0);
// 10. Coupons: blocked unless combinable.
r = offer(on, [J('a', 100000), X('b', 20000)], { couponApplied: true });
check('coupon blocks', [r.discount, r.blockedByCoupon], [0, true]);
check('coupon combines', offer({ ...on, combineWithCoupons: true }, [J('a', 100000), X('b', 20000)], { couponApplied: true }).discount, 20000);
// 11. Dates.
check('not started', offer({ ...on, startsAt: 2000 }, [J('a', 100000), X('b', 1)], { now: 1000 }).discount, 0);
check('ended', offer({ ...on, endsAt: 500 }, [J('a', 100000), X('b', 1)], { now: 1000 }).discount, 0);
// 12. Category spelling variants count.
check('jewelry spelling', offer(on, [{ ...J('a', 50000), category: 'jewelry' }, X('b', 1000)]).discount, 1000);
// 13. Progress hint.
r = offer(on, [J('a', 40000), X('b', 1000)]);
check('progress', [r.tier.minSpend, r.nextTier.minSpend, r.shortfall], [25000, 50000, 10000]);
// 14. Settings sanitising: bad tiers dropped, sorted, Firestore-ish dates.
const s = clean({ enabled: true, tiers: [{ minSpend: 100000, credit: 30000 }, { minSpend: 0, credit: 5 }, { minSpend: 'x' }], startsAt: new Date(5), endsAt: { toMillis: () => 9 } });
check('sanitize', [s.tiers.length, s.startsAt, s.endsAt, s.qualifyingCategories[0]], [1, 5, 9, 'Jewellery']);
check('sanitize empty', clean(null).enabled, false);

// 15. Server copy agrees on 2,000 random carts.
let seed = 7;
const rnd = (k) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
for (let i = 0; i < 2000; i++) {
  const lines = Array.from({ length: 1 + rnd(5) }, (_, j) => ({
    productId: 'p' + j,
    category: ['Jewellery', 'jewelry', 'Furniture', 'Articles', undefined][rnd(5)],
    unitPrice: rnd(9) * 7500 + rnd(1000),
    quantity: 1 + rnd(3),
  }));
  const settings = clean({ enabled: rnd(5) > 0, combineWithCoupons: rnd(2) === 1, tiers: D.tiers });
  const opts = { couponApplied: rnd(3) === 0, giftProductId: rnd(3) === 0 ? 'p' + rnd(5) : null, now: 1 };
  assert.deepEqual(server.computeJewelleryOffer(server.sanitizeOfferSettings(settings), lines, opts), offer(settings, lines, opts), 'server copy differs');
}
n++;
console.log(`jewelleryOffer: ${n} cases passed (incl. 2,000 random carts vs the server copy)`);
