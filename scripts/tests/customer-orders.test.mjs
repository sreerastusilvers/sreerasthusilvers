// Customers list and Customer details: real orders (top-level `orders` with
// `userId`) turned into rows, grouped per customer, and the "Spent" total.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = path.resolve(process.argv[2] || '.');
const { build } = createRequire(repo + '/package.json')('esbuild');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'customer-orders.mjs');
await build({ entryPoints: [repo + '/src/lib/customerOrders.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { toCustomerOrder, groupOrdersByCustomer, totalSpent } = await import(pathToFileURL(out).href);

let n = 0;
const check = (label, got, want) => { n++; assert.deepEqual(got, want, label); };
const ts = (seconds) => ({ seconds });
const row = (id, data) => ({ id, data });

// 1. A real order document: the display number is `orderId`, not `orderNumber`.
check('maps an order', toCustomerOrder('fs1', { orderId: 'ORD-1001', userId: 'u1', status: 'delivered', total: 2500, items: [{}, {}], createdAt: ts(10) }),
  { id: 'fs1', orderNumber: 'ORD-1001', status: 'delivered', total: 2500, items: [{}, {}], createdAt: ts(10) });
// 2. Missing fields fall back safely.
check('fallbacks', toCustomerOrder('fs2', {}), { id: 'fs2', orderNumber: undefined, status: 'pending', total: 0, items: [], createdAt: undefined });
// 3. A non-number total (bad data) counts as 0 rather than breaking the sum.
check('bad total', toCustomerOrder('fs3', { total: '99' }).total, 0);

// 4. Grouped by customer, newest first; orders with no userId are skipped.
const g = groupOrdersByCustomer([
  row('a', { userId: 'u1', total: 100, status: 'delivered', createdAt: ts(1) }),
  row('b', { userId: 'u2', total: 200, status: 'pending', createdAt: ts(5) }),
  row('c', { userId: 'u1', total: 300, status: 'cancelled', createdAt: ts(9) }),
  row('d', { total: 400, createdAt: ts(3) }),
]);
check('u1 ids newest first', g.get('u1').map((o) => o.id), ['c', 'a']);
check('u2 ids', g.get('u2').map((o) => o.id), ['b']);
check('no orphan group', [...g.keys()].sort(), ['u1', 'u2']);

// 5. "Spent" counts delivered orders only.
check('spent', totalSpent(g.get('u1')), 100);
check('spent none', totalSpent([]), 0);

console.log(`customer-orders: ${n} passed`);
