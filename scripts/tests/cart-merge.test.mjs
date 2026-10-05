import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = path.resolve(process.argv[2] || '.');
const { build } = createRequire(repo + '/package.json')('esbuild');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'cart-merge.mjs');
await build({ entryPoints: [repo + '/src/contexts/cartMerge.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const { mergeAddIntoSavedCart: m } = await import(pathToFileURL(out).href);
const line = { id: 'p1', name: 'Anklet', price: 100, stock: 3 };
let r = m(undefined, line, 2);
assert.deepEqual([r.added, r.items.p1.quantity], [2, 2]);
r = m({ p1: { ...line, quantity: 2 } }, line, 2);            // saved 2 + 2 > stock 3
assert.deepEqual([r.added, r.items.p1.quantity], [1, 3]);
r = m({ p1: { ...line, quantity: 3 } }, line, 1);            // already full
assert.deepEqual([r.added, r.items.p1.quantity, r.before], [0, 3, 3]);
r = m({}, { ...line, stock: 0 }, 1);                          // sold out, nothing saved
assert.deepEqual([r.added, 'p1' in r.items], [0, false]);
r = m({ p1: { ...line, quantity: 1, price: 90 } }, { id: 'p1', name: 'Anklet', price: 100 }, 5); // unknown stock on line, saved stock 3
assert.deepEqual([r.added, r.items.p1.quantity, r.items.p1.price], [2, 3, 90]);
r = m({ p1: { id: 'p1', quantity: 1 } }, { id: 'p1', name: 'x', price: 1 }, 4); // no stock anywhere
assert.deepEqual([r.added, r.items.p1.quantity], [4, 5]);
r = m({ p1: { ...line, quantity: 5 } }, line, 1);            // stock dropped below saved
assert.deepEqual([r.added, r.items.p1.quantity], [0, 5]);
r = m({ other: { id: 'other', quantity: 1 } }, line, 1);     // other lines kept
assert.ok(r.items.other && r.items.p1);
console.log('cartMerge: 8 cases passed');
