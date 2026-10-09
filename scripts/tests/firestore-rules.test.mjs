// Firestore rules: team page access (can()), owner-only areas, and every
// customer, checkout and delivery rule. Runs against the local emulator only;
// the suite loads firestore.rules itself under the demo project "demo-rules",
// so nothing can reach the live database. Recipe in README.md.
//
// Three kinds of result:
//   ok    the rules do what the app needs
//   FAIL  a rule regressed (exit code 1)
//   GAP   a known hole or breakage, listed at the end; it does not fail the run.
//         When a rule fix closes one, it prints "closed" so the case can move
//         into the main list.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';

setLogLevel('silent'); // every refused write would print an SDK warning

const repo = path.resolve(process.argv[2] || '.');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8180').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-rules',
  // RULES_FILE tries a changed copy before it replaces firestore.rules.
  firestore: { rules: readFileSync(process.env.RULES_FILE || path.join(repo, 'firestore.rules'), 'utf8'), host, port: Number(port) },
});
await env.clearFirestore();

const dbs = new Map();
const as = (uid) => {
  if (!dbs.has(uid)) dbs.set(uid, (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore());
  return dbs.get(uid);
};
const seed = (docs) => env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await Promise.all(Object.entries(docs).map(([p, d]) => db.doc(p).set(d)));
});

let passed = 0;
let failed = 0;
const gaps = [];
const closed = [];
let n = 0;
const t = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log('  ok  ', name);
  } catch (e) {
    failed += 1;
    process.exitCode = 1;
    console.log('  FAIL', name, '\n       ', e.code || '', e.message);
  }
};
const allow = (name, uid, op) => t(name, () => assertSucceeds(op(as(uid), ++n)));
const deny = (name, uid, op) => t(name, () => assertFails(op(as(uid), ++n)));
// A known gap: `want` is what the rules should do, the opposite of today.
const gap = async (id, name, want, uid, op) => {
  try {
    await (want === 'deny' ? assertFails : assertSucceeds)(op(as(uid), ++n));
    closed.push(`${id} ${name}`);
    console.log('  closed', id, name, '(now right: move it into the main list)');
  } catch {
    gaps.push(`${id} ${name}`);
    console.log('  GAP ', id, name);
  }
};

// ── People ──────────────────────────────────────────────────────────────────
// The page keys from src/lib/permissions.ts.
const PERMS = ['dashboard', 'products', 'orders', 'customers', 'coupons', 'giftCards', 'videoCalls', 'newsletter',
  'silverRate', 'commerce', 'aiTools', 'marketing', 'whatsapp', 'dealerChats', 'content', 'storage'];
const staff = (permissions, extra = {}) => ({ role: 'staff', staffRole: 'staff', permissions, isActive: true, name: 'Staff', ...extra });

const product = (extra = {}) => ({
  name: 'Silver ring', price: 38000, inventory: { stock: 3, sku: 'R1' }, flags: { isActive: true },
  media: { images: ['a.jpg'] }, ...extra,
});

await seed({
  'users/owner': { role: 'admin', name: 'Owner' },
  ...Object.fromEntries(PERMS.map((p) => [`users/st-${p}`, staff([p])])),
  'users/st-off': staff(PERMS, { isActive: false }),
  'users/st-none': { role: 'staff', staffRole: 'staff', isActive: true },
  'users/st-noflag': { role: 'staff', staffRole: 'staff', permissions: ['content'] },
  'users/st-live': staff(['products']),
  'users/cust': { role: 'user', name: 'Asha', email: 'asha@example.com' },
  'users/cust2': { role: 'user', name: 'Ravi', email: 'ravi@example.com' },
  'users/cust-perms': { role: 'user', permissions: PERMS },
  'users/susp': { role: 'user', accountStatus: 'suspended' },
  'users/dboy': { role: 'delivery', name: 'Delivery' },
  'users/dboy2': { role: 'delivery', name: 'Delivery 2' },

  'users/cust2/addresses/ad1': { line1: '1 MG Road' },
  'users/cust2/wishlist/p1': { productId: 'p1' },
  'users/cust2/orders/uo1': { total: 1000, status: 'delivered' },
  'users/cust2/giftCards/g1': { balance: 500 },
  'users/cust2/wallets/w1': { balance: 0 },
  'users/cust2/transactions/tx1': { amount: 10 },
  'users/cust2/auditLog/al1': { event: 'login' },
  'users/cust2/loginHistory/lh1': { at: 1 },

  'products/p1': product(),
  'products/p7': product({ media: { images: ['1', '2', '3', '4', '5', '6', '7'] } }),
  'coupons/c1': { code: 'SAVE10', discount: 10, usedCount: 0 },
  'giftCards/gc1': { code: 'GIFT', balance: 2000 },
  'orders/o1': { userId: 'cust2', status: 'pending', total: 1000, paymentMethod: 'Razorpay', paymentStatus: 'paid' },
  'orders/o1/messages/m1': { authorType: 'customer', authorId: 'cust2', visibility: 'customer', channel: 'chat', text: 'Hi' },
  'orders/o1/messages/note': { authorType: 'staff', authorId: 'owner', visibility: 'internal', channel: 'note', text: 'VIP' },
  'refunds/rf1': { userId: 'cust2', amount: 100, status: 'pending' },
  'videoCallRequests/v1': { customerUid: 'cust2', status: 'pending' },
  'newsletterSubscriptions/a@b.co': { email: 'a@b.co' },
  'promptHistory/ph1': { prompt: 'x' },
  'broadcastCampaigns/bc1': { title: 'Diwali' },
  'whatsappTemplates/wt1': { name: 'order_update' },
  'whatsappThreads/t1': { phone: '+919999999999', status: 'open' },
  'whatsappThreads/t1/messages/wm1': { text: 'Hello', direction: 'in' },
  'whatsappSnippets/s1': { text: 'Thanks!' },
  'dealers/d1': { displayName: 'Dealer A' },
  'dealers/d1/messages/dm1': { text: 'Price?' },
  'dealerPrivate/d1': { phone: '+918888888888', realName: 'Real Name' },
  'dealerTickets/k1': { dealerId: 'd1', status: 'open', number: 'T-0001' },
  'dealerTickets/k2': { dealerId: 'd1', status: 'open', number: 'T-0002' },
  'counters/dealerTickets': { next: 3 },
  'activityLog/a1': { actorUid: 'owner', action: 'update' },
  'recycleBin/b1': { path: 'products/old', data: { name: 'Old' }, deletedByUid: 'owner' },
  'reviews/r1': { userId: 'cust2', productId: 'p1', rating: 5, status: 'pending' },
  'userTokens/tok1': { uid: 'cust2', token: 'tok1' },
  'deliveryRatings/dr1': { userId: 'cust2', deliveryBoyId: 'dboy', rating: 5 },
  'accountDeletionRequests/adr1': { userId: 'cust2', status: 'pending' },
  'adminWalletLog/w1': { amount: 1 },
  'admin/a1': { x: 1 },
  'whatsappOtps/otp1': { hash: 'h' },
  'siteSettings/delivery': { fee: 50 },
});

// ── 1. Who may use which admin area ─────────────────────────────────────────
// Every case runs as the owner, one staff login per page key, a switched-off
// login with every page, a login with none, a customer, a customer with a
// stray permissions list, a signed-in account without a profile, and a
// signed-out visitor. Only the owner and the staff holding a listed page may
// succeed. `perms: []` = owner only; `nobody` = refused even to the owner.
const ACTORS = [
  { key: 'owner', uid: 'owner' },
  ...PERMS.map((p) => ({ key: `staff:${p}`, uid: `st-${p}`, perm: p })),
  { key: 'staff switched off', uid: 'st-off' },
  { key: 'staff with no pages', uid: 'st-none' },
  { key: 'customer', uid: 'cust' },
  { key: 'customer with permissions list', uid: 'cust-perms' },
  { key: 'signed in, no profile', uid: 'ghost' },
  { key: 'signed out', uid: null },
];
const set = (p, d) => (db) => db.doc(p).set(d);
const get = (p) => (db) => db.doc(p).get();
const list = (p) => (db) => db.collection(p).get();
const del = (p) => (db) => db.doc(p).delete();
const settingsWrite = (id) => (db, tag, i) => db.doc(`siteSettings/${id}`).set({ v: i }, { merge: true });

const MATRIX = [
  // customers
  { name: "read another customer's profile", perms: ['customers'], op: get('users/cust2') },
  { name: 'list every user profile', perms: ['customers'], op: list('users') },
  // products
  { name: 'create a product', perms: ['products'], op: (db, tag) => db.doc(`products/${tag}`).set(product()) },
  { name: 'change a product price', perms: ['products'], op: (db, tag, i) => db.doc('products/p1').update({ price: 1000 + i }) },
  { name: 'delete a product', perms: ['products'], seed: (tag) => ({ [`products/${tag}`]: product() }), op: (db, tag) => db.doc(`products/${tag}`).delete() },
  { name: 'write a category', perms: ['products'], op: (db, tag) => db.doc(`categories/${tag}`).set({ name: 'Rings' }) },
  // orders
  { name: "read someone else's order", perms: ['orders'], op: get('orders/o1') },
  { name: 'list every order', perms: ['orders'], op: list('orders') },
  { name: 'edit an order', perms: ['orders'], op: (db, tag) => db.doc('orders/o1').update({ adminNote: tag }) },
  { name: 'delete an order', perms: ['orders'], seed: (tag) => ({ [`orders/${tag}`]: { userId: 'cust2', status: 'pending' } }), op: (db, tag) => db.doc(`orders/${tag}`).delete() },
  { name: 'read an internal order note', perms: ['orders'], op: get('orders/o1/messages/note') },
  { name: 'post a staff message on an order', perms: ['orders'], op: (db, tag) => db.doc(`orders/o1/messages/${tag}`).set({ authorType: 'staff', authorId: 'x', visibility: 'customer', channel: 'chat', text: 'Shipped' }) },
  { name: "read someone else's refund", perms: ['orders'], op: get('refunds/rf1') },
  { name: 'process a refund', perms: ['orders'], op: (db, tag) => db.doc('refunds/rf1').update({ status: tag }) },
  // coupons
  { name: 'create a coupon', perms: ['coupons'], op: (db, tag) => db.doc(`coupons/${tag}`).set({ code: tag, discount: 5, usedCount: 0 }) },
  { name: 'change a coupon discount', perms: ['coupons'], op: (db, tag, i) => db.doc('coupons/c1').update({ discount: i }) },
  { name: 'delete a coupon', perms: ['coupons'], seed: (tag) => ({ [`coupons/${tag}`]: { code: tag } }), op: (db, tag) => db.doc(`coupons/${tag}`).delete() },
  // gift cards
  { name: 'issue a gift card to a customer', perms: ['giftCards'], op: (db, tag) => db.doc(`users/cust2/giftCards/${tag}`).set({ balance: 500 }) },
  { name: "change a customer's gift card balance", perms: ['giftCards'], op: (db, tag, i) => db.doc('users/cust2/giftCards/g1').update({ balance: i }) },
  { name: 'list every gift card (collection group)', perms: ['giftCards'], op: (db) => db.collectionGroup('giftCards').get() },
  { name: 'create a shop-wide gift card', perms: ['giftCards'], op: (db, tag) => db.doc(`giftCards/${tag}`).set({ code: tag, balance: 100 }) },
  // video calls
  { name: "read someone else's video call request", perms: ['videoCalls'], op: get('videoCallRequests/v1') },
  { name: 'update a video call request', perms: ['videoCalls'], op: (db, tag) => db.doc('videoCallRequests/v1').update({ adminNote: tag }) },
  { name: 'delete a video call request', perms: ['videoCalls'], seed: (tag) => ({ [`videoCallRequests/${tag}`]: { customerUid: 'cust2' } }), op: (db, tag) => db.doc(`videoCallRequests/${tag}`).delete() },
  // newsletter
  { name: 'read a newsletter subscriber', perms: ['newsletter'], op: get('newsletterSubscriptions/a@b.co') },
  { name: 'list newsletter subscribers', perms: ['newsletter'], op: list('newsletterSubscriptions') },
  { name: 'remove a newsletter subscriber', perms: ['newsletter'], seed: (tag) => ({ [`newsletterSubscriptions/${tag}@x.in`]: { email: `${tag}@x.in` } }), op: (db, tag) => db.doc(`newsletterSubscriptions/${tag}@x.in`).delete() },
  // silver rate and commerce settings
  { name: 'set the silver rate', perms: ['silverRate'], op: settingsWrite('silverRate') },
  ...['delivery', 'gst', 'customerSupport', 'coupons', 'jewelleryOffer'].map((id) => ({ name: `edit siteSettings/${id}`, perms: ['commerce'], op: settingsWrite(id) })),
  // AI tools
  { name: 'read AI prompt history', perms: ['aiTools'], op: get('promptHistory/ph1') },
  { name: 'save AI prompt history', perms: ['aiTools'], op: (db, tag) => db.doc(`promptHistory/${tag}`).set({ prompt: 'p' }) },
  // marketing
  { name: 'read a broadcast campaign', perms: ['marketing'], op: get('broadcastCampaigns/bc1') },
  { name: 'create a broadcast campaign', perms: ['marketing'], op: (db, tag) => db.doc(`broadcastCampaigns/${tag}`).set({ title: 'Sale' }) },
  { name: 'edit WhatsApp template list', perms: ['marketing'], op: (db, tag) => db.doc(`whatsappTemplates/${tag}`).set({ name: 'x' }) },
  { name: 'read WhatsApp template list', perms: ['whatsapp', 'marketing'], op: get('whatsappTemplates/wt1') },
  // customer WhatsApp inbox
  { name: 'read a customer WhatsApp thread', perms: ['whatsapp'], op: get('whatsappThreads/t1') },
  { name: 'read thread messages', perms: ['whatsapp'], op: get('whatsappThreads/t1/messages/wm1') },
  { name: 'add a note to a thread', perms: ['whatsapp'], op: (db, tag) => db.doc(`whatsappThreads/t1/messages/${tag}`).set({ direction: 'note', text: 'n' }) },
  { name: 'assign a thread', perms: ['whatsapp'], op: (db, tag) => db.doc('whatsappThreads/t1').update({ assignedTo: tag }) },
  { name: 'save a quick reply', perms: ['whatsapp'], op: (db, tag) => db.doc(`whatsappSnippets/${tag}`).set({ text: 'Hi' }) },
  { name: 'read quick replies', perms: ['whatsapp'], op: get('whatsappSnippets/s1') },
  // dealer chats (staff side)
  { name: "read a dealer's display name", perms: ['dealerChats'], op: get('dealers/d1') },
  { name: 'read a dealer chat', perms: ['dealerChats'], op: get('dealers/d1/messages/dm1') },
  { name: 'read a dealer ticket', perms: ['dealerChats'], op: get('dealerTickets/k1') },
  { name: 'close or reopen a dealer ticket', perms: ['dealerChats'], op: (db, tag, i) => db.doc('dealerTickets/k1').update({ status: i % 2 ? 'closed' : 'open', updatedAt: i }) },
  // website content
  ...['homeBanners', 'homeCollections', 'homeVideos', 'banners', 'showcases', 'testimonials', 'gallery'].map((c) => ({
    name: `write ${c}`, perms: ['content'], op: (db, tag) => db.doc(`${c}/${tag}`).set({ title: 'x' }),
  })),
  { name: 'approve a review', perms: ['content'], op: (db, tag, i) => db.doc('reviews/r1').update({ status: 'approved', moderatedAt: i }) },
  { name: 'delete a review', perms: ['content'], seed: (tag) => ({ [`reviews/${tag}`]: { userId: 'cust2', status: 'pending' } }), op: (db, tag) => db.doc(`reviews/${tag}`).delete() },
  ...['footer', 'sidebarPromo'].map((id) => ({ name: `edit siteSettings/${id}`, perms: ['content'], op: settingsWrite(id) })),
  // owner only
  { name: 'read the activity log', perms: [], op: get('activityLog/a1') },
  { name: 'read the recycle bin', perms: [], op: get('recycleBin/b1') },
  { name: 'list the recycle bin', perms: [], op: list('recycleBin') },
  { name: 'edit a recycle bin entry', perms: [], op: (db, tag) => db.doc('recycleBin/b1').update({ note: tag }) },
  { name: 'empty a recycle bin entry', perms: [], seed: (tag) => ({ [`recycleBin/${tag}`]: { path: 'products/x', deletedByUid: 'owner' } }), op: (db, tag) => db.doc(`recycleBin/${tag}`).delete() },
  { name: "read a dealer's number and real name", perms: [], op: get('dealerPrivate/d1') },
  { name: 'list dealer numbers', perms: [], op: list('dealerPrivate') },
  { name: "write a dealer's number", perms: [], op: (db, tag) => db.doc(`dealerPrivate/${tag}`).set({ phone: '+91' }) },
  { name: 'add a dealer', perms: [], op: (db, tag) => db.doc(`dealers/${tag}`).set({ displayName: 'D' }) },
  { name: 'write into a dealer chat', perms: [], op: (db, tag) => db.doc(`dealers/d1/messages/${tag}`).set({ text: 'x' }) },
  { name: 'create a dealer ticket', perms: [], op: (db, tag) => db.doc(`dealerTickets/${tag}`).set({ dealerId: 'd1', status: 'open' }) },
  { name: "change a ticket's dealer", perms: [], op: (db, tag) => db.doc('dealerTickets/k2').update({ dealerId: tag }) },
  { name: 'delete a dealer ticket', perms: [], seed: (tag) => ({ [`dealerTickets/${tag}`]: { dealerId: 'd1', status: 'open' } }), op: (db, tag) => db.doc(`dealerTickets/${tag}`).delete() },
  { name: 'read the ticket counter', perms: [], op: get('counters/dealerTickets') },
  { name: 'bump the ticket counter', perms: [], op: (db, tag, i) => db.doc('counters/dealerTickets').set({ next: i }) },
  { name: 'edit dealer chat setup (siteSettings/dealerChat)', perms: [], op: settingsWrite('dealerChat') },
  { name: 'edit siteSettings/catalogVersion', perms: [], op: settingsWrite('catalogVersion') },
  { name: 'read admin/*', perms: [], op: get('admin/a1') },
  { name: 'write admin/*', perms: [], op: (db, tag) => db.doc(`admin/${tag}`).set({ x: 1 }) },
  { name: 'read the admin wallet log', perms: [], op: get('adminWalletLog/w1') },
  { name: 'create a team login (profile for someone else)', perms: [], op: (db, tag) => db.doc(`users/new-${tag}`).set(staff(['products'])) },
  { name: 'turn a customer into staff', perms: [], seed: (tag) => ({ [`users/mk-${tag}`]: { role: 'user' } }), op: (db, tag) => db.doc(`users/mk-${tag}`).update({ role: 'staff', permissions: ['orders'] }) },
  { name: 'switch a team login off', perms: [], seed: (tag) => ({ [`users/off-${tag}`]: staff(['orders']) }), op: (db, tag) => db.doc(`users/off-${tag}`).update({ isActive: false }) },
  { name: 'delete a user profile', perms: [], seed: (tag) => ({ [`users/del-${tag}`]: { role: 'user' } }), op: (db, tag) => db.doc(`users/del-${tag}`).delete() },
  { name: "read a customer's push token", perms: [], op: get('userTokens/tok1') },
  { name: 'read a delivery rating', perms: [], op: get('deliveryRatings/dr1') },
  { name: "read a customer's saved address", perms: [], op: get('users/cust2/addresses/ad1') },
  { name: "read a customer's wallet", perms: [], op: get('users/cust2/wallets/w1') },
  { name: "read a customer's login history", perms: [], op: get('users/cust2/loginHistory/lh1') },
  { name: "read someone's account deletion request", perms: [], op: get('accountDeletionRequests/adr1') },
  // nobody, not even the owner (server only)
  { name: 'read WhatsApp OTP records', nobody: true, op: get('whatsappOtps/otp1') },
  { name: 'write WhatsApp OTP records', nobody: true, op: (db, tag) => db.doc(`whatsappOtps/${tag}`).set({ hash: 'h' }) },
  { name: "edit a customer's audit log", nobody: true, op: (db, tag) => db.doc('users/cust2/auditLog/al1').update({ event: tag }) },
  { name: 'delete a wallet', nobody: true, op: del('users/cust2/wallets/w1') },
  { name: 'delete a ledger transaction', nobody: true, op: del('users/cust2/transactions/tx1') },
  { name: 'edit the admin wallet log', nobody: true, op: (db, tag) => db.doc('adminWalletLog/w1').update({ amount: tag }) },
];

const tagOf = (ci, a) => `m${ci}-${a.uid || 'anon'}`;
const matrixSeed = {};
MATRIX.forEach((c, ci) => { if (c.seed) for (const a of ACTORS) Object.assign(matrixSeed, c.seed(tagOf(ci, a))); });
await seed(matrixSeed);

console.log(`\n1. Admin areas: ${MATRIX.length} actions x ${ACTORS.length} kinds of login`);
for (const [ci, c] of MATRIX.entries()) {
  const wrong = [];
  for (const a of ACTORS) {
    const expected = !c.nobody && (a.uid === 'owner' || (a.perm !== undefined && c.perms.includes(a.perm)));
    try {
      await (expected ? assertSucceeds : assertFails)(c.op(as(a.uid), tagOf(ci, a), ++n));
    } catch {
      wrong.push(`${a.key} was ${expected ? 'refused' : 'allowed'}`);
    }
  }
  const who = c.nobody ? 'nobody' : c.perms.length ? `owner + ${c.perms.join('/')}` : 'owner only';
  await t(`${c.name} [${who}]`, () => { if (wrong.length) throw new Error(wrong.join('; ')); });
}

// ── 2. Team logins: own profile, switching off, changing pages ──────────────
console.log('\n2. Team logins');
await allow('staff reads their own profile', 'st-products', get('users/st-products'));
await allow('a switched-off login can still read its own profile (to show "your login is off")', 'st-off', get('users/st-off'));
await allow('staff edits their own display name', 'st-products', (db, i) => db.doc('users/st-products').update({ name: `S${i}` }));
await deny('staff cannot give themselves another page', 'st-products', (db) => db.doc('users/st-products').update({ permissions: ['products', 'orders'] }));
await deny('staff cannot change their own staff role', 'st-products', (db) => db.doc('users/st-products').update({ staffRole: 'website_manager' }));
await deny('staff cannot make themselves owner', 'st-products', (db) => db.doc('users/st-products').update({ role: 'admin' }));
await deny('staff cannot drop their staff role', 'st-products', (db) => db.doc('users/st-products').update({ role: 'user' }));
await deny('a switched-off login cannot switch itself back on', 'st-off', (db) => db.doc('users/st-off').update({ isActive: true }));
await deny('a switched-off login cannot remove its isActive flag', 'st-off', (db) => db.doc('users/st-off').set({ role: 'staff', staffRole: 'staff', permissions: PERMS }));
await deny('staff with Customers cannot edit a customer', 'st-customers', (db) => db.doc('users/cust2').update({ name: 'X' }));
await allow('a login without an isActive field counts as on', 'st-noflag', (db, i) => db.doc(`homeBanners/noflag${i}`).set({ title: 'x' }));
await allow('live: staff with Products edits a product', 'st-live', (db, i) => db.doc('products/p1').update({ price: 2000 + i }));
await allow('live: owner switches the login off', 'owner', (db) => db.doc('users/st-live').update({ isActive: false }));
await deny('live: the switched-off login is refused at once', 'st-live', (db, i) => db.doc('products/p1').update({ price: 2000 + i }));
await allow('live: owner switches it on with Content instead of Products', 'owner', (db) => db.doc('users/st-live').update({ isActive: true, permissions: ['content'] }));
await deny('live: Products is now refused', 'st-live', (db, i) => db.doc('products/p1').update({ price: 2000 + i }));
await allow('live: Content now works', 'st-live', (db, i) => db.doc(`homeBanners/live${i}`).set({ title: 'x' }));

// ── 3. Customer accounts ────────────────────────────────────────────────────
console.log('\n3. Customer accounts');
await allow('a new account creates its own profile (no role)', 'new1', (db) => db.doc('users/new1').set({ name: 'A', email: 'a@x.in' }));
await allow("a new account creates its own profile with role 'user'", 'new2', (db) => db.doc('users/new2').set({ name: 'B', role: 'user' }));
await deny('a new account cannot make itself admin', 'new3', (db) => db.doc('users/new3').set({ name: 'C', role: 'admin' }));
await deny('a new account cannot make itself staff', 'new4', (db) => db.doc('users/new4').set({ role: 'staff', permissions: PERMS, isActive: true }));
await deny("a customer cannot create someone else's profile", 'cust', (db) => db.doc('users/new5').set({ role: 'user' }));
await allow('a customer edits their own name', 'cust', (db, i) => db.doc('users/cust').update({ name: `Asha ${i}` }));
await deny('a customer cannot make themselves admin', 'cust', (db) => db.doc('users/cust').update({ role: 'admin' }));
await deny('a customer cannot make themselves staff', 'cust', (db) => db.doc('users/cust').update({ role: 'staff', permissions: ['orders'] }));
await deny('a customer cannot add a permissions list', 'cust', (db) => db.doc('users/cust').update({ permissions: ['orders'] }));
await deny('a customer cannot add a staff role label', 'cust', (db) => db.doc('users/cust').update({ staffRole: 'website_manager' }));
await allow('a customer requests account deletion', 'cust', (db) => db.doc('users/cust').update({ accountStatus: 'pending_deletion' }));
await allow('a customer cancels the deletion request', 'cust', (db) => db.doc('users/cust').update({ accountStatus: 'active' }));
await deny('a customer cannot move their account to any other state', 'cust', (db) => db.doc('users/cust').update({ accountStatus: 'suspended' }));
await deny('a suspended customer cannot lift the suspension', 'susp', (db) => db.doc('users/susp').update({ accountStatus: 'active' }));
await deny('a customer cannot delete their profile', 'cust', del('users/cust'));
await deny("a customer cannot read another customer's profile", 'cust', get('users/cust2'));
await allow('a customer reads and writes their own address', 'cust', (db) => db.doc('users/cust/addresses/home').set({ line1: 'x' }));
await allow('a customer writes their own wishlist and history', 'cust', (db) => Promise.all([
  db.doc('users/cust/wishlist/p1').set({ productId: 'p1' }), db.doc('users/cust/history/h1').set({ productId: 'p1' })]));
await deny("a customer cannot read another customer's address", 'cust', get('users/cust2/addresses/ad1'));
await allow('a customer reads their own gift card', 'cust2', get('users/cust2/giftCards/g1'));
await deny('a customer cannot raise their own gift card balance', 'cust2', (db) => db.doc('users/cust2/giftCards/g1').update({ balance: 99999 }));
await deny("a customer cannot read another customer's gift card", 'cust', get('users/cust2/giftCards/g1'));
await allow('a customer adds to their own ledger', 'cust2', (db, i) => db.doc(`users/cust2/transactions/t${i}`).set({ amount: 1 }));
await deny('a customer cannot edit a ledger entry', 'cust2', (db) => db.doc('users/cust2/transactions/tx1').update({ amount: 999 }));
await allow('a customer adds to their own login history', 'cust2', (db, i) => db.doc(`users/cust2/loginHistory/l${i}`).set({ at: i }));
await deny('a customer cannot edit login history', 'cust2', (db) => db.doc('users/cust2/loginHistory/lh1').update({ at: 0 }));
await deny('a customer cannot edit their audit log', 'cust2', (db) => db.doc('users/cust2/auditLog/al1').update({ event: 'x' }));
await allow('a customer writes their own cart', 'cust', (db) => db.doc('carts/cust/items/p1').set({ qty: 1 }));
await deny("a customer cannot read another customer's cart", 'cust', get('carts/cust2'));
await deny('a signed-out visitor cannot read a cart', null, get('carts/cust'));
await allow('a customer asks to delete their account', 'cust', (db) => db.doc('accountDeletionRequests/adr-cust').set({ userId: 'cust', status: 'pending' }));
await allow('a customer reads their own deletion request', 'cust', get('accountDeletionRequests/adr-cust'));
await deny("a customer cannot read another customer's deletion request", 'cust', get('accountDeletionRequests/adr1'));

// ── 4. Products and coupons from checkout ───────────────────────────────────
console.log('\n4. Products and coupons (checkout writes from the browser)');
await seed({
  'products/ps': product(),
  'products/sold': product({ inventory: { stock: 0, sku: 'S' }, flags: { isActive: false }, inactiveReason: 'outOfStock' }),
  'products/hidden': product({ inventory: { stock: 0, sku: 'H' }, flags: { isActive: false } }),
});
await allow('anyone can read a product', null, get('products/ps'));
await allow('checkout takes 1 off the stock', 'cust', (db) => db.doc('products/ps').update({ 'inventory.stock': 2, updatedAt: 1 }));
await deny('a customer cannot set a price (the Rs.1 attack)', 'cust', (db) => db.doc('products/ps').update({ price: 1 }));
await deny('a customer cannot change price together with stock', 'cust', (db) => db.doc('products/ps').update({ price: 1, 'inventory.stock': 1 }));
await deny('a customer cannot set negative stock', 'cust', (db) => db.doc('products/ps').update({ 'inventory.stock': -1 }));
await deny('a customer cannot set stock to text', 'cust', (db) => db.doc('products/ps').update({ 'inventory.stock': '5' }));
await deny('a customer cannot change other inventory fields', 'cust', (db) => db.doc('products/ps').update({ 'inventory.sku': 'X' }));
await deny('a customer cannot rename a product', 'cust', (db) => db.doc('products/ps').update({ name: 'Free ring' }));
await deny('a customer cannot hide a product that still has stock', 'cust', (db) => db.doc('products/ps').update({ 'flags.isActive': false }));
await allow('the last sale hides a sold-out product', 'cust', (db) => db.doc('products/ps').update({ 'inventory.stock': 0, 'flags.isActive': false, inactiveReason: 'outOfStock', outOfStockAt: 1 }));
await allow('a cancellation re-lists a product the sell-out rule hid', 'cust', (db) => db.doc('products/sold').update({ 'inventory.stock': 1, 'flags.isActive': true, inactiveReason: null }));
await deny('a customer cannot re-list a product the owner hid', 'cust', (db) => db.doc('products/hidden').update({ 'inventory.stock': 1, 'flags.isActive': true }));
await deny('a customer cannot set any other inactiveReason', 'cust', (db) => db.doc('products/ps').update({ inactiveReason: 'manual' }));
await deny('a signed-out visitor cannot change stock', null, (db) => db.doc('products/p1').update({ 'inventory.stock': 0 }));
await deny('a customer cannot create a product', 'cust', (db) => db.doc('products/fake').set(product()));
await deny('staff cannot create a product with 6 photos', 'st-products', (db) => db.doc('products/six').set(product({ media: { images: ['1', '2', '3', '4', '5', '6'] } })));
await allow('staff creates a product with 5 photos', 'st-products', (db) => db.doc('products/five').set(product({ media: { images: ['1', '2', '3', '4', '5'] } })));
await allow('staff edits the price of an old product with 7 photos left as they are', 'st-products', (db) => db.doc('products/p7').update({ price: 39000 }));
await deny('staff cannot add an 8th photo to it', 'st-products', (db) => db.doc('products/p7').update({ 'media.images': ['1', '2', '3', '4', '5', '6', '7', '8'] }));
await allow('anyone can read a coupon', null, get('coupons/c1'));
await allow('an order bumps the coupon count by 1', 'cust', (db) => db.doc('coupons/c1').get().then((s) => db.doc('coupons/c1').update({ usedCount: s.data().usedCount + 1, updatedAt: 1 })));
await deny('a customer cannot bump it by 2', 'cust', (db) => db.doc('coupons/c1').get().then((s) => db.doc('coupons/c1').update({ usedCount: s.data().usedCount + 2 })));
await deny('a customer cannot reset the count', 'cust', (db) => db.doc('coupons/c1').update({ usedCount: 0 }));
await deny('a customer cannot change the discount', 'cust', (db) => db.doc('coupons/c1').update({ discount: 100 }));
await deny('a customer cannot change the discount while bumping', 'cust', (db) => db.doc('coupons/c1').get().then((s) => db.doc('coupons/c1').update({ usedCount: s.data().usedCount + 1, discount: 100 })));
await deny('a signed-out visitor cannot bump a coupon', null, (db) => db.doc('coupons/c1').update({ usedCount: 99 }));

// ── 5. Orders, delivery and order chat ──────────────────────────────────────
console.log('\n5. Orders, delivery and order chat');
const cancelled = { status: 'cancelled', cancelledBy: 'user', cancellationReason: 'Changed mind', cancelledAt: 1, updatedAt: 1, statusHistory: [] };
await seed({
  'orders/c-pending': { userId: 'cust', status: 'pending', total: 1000, paymentStatus: 'paid' },
  'orders/c-pending2': { userId: 'cust', status: 'processing', total: 1000, paymentStatus: 'paid' },
  'orders/c-shipped': { userId: 'cust', status: 'shipped', total: 1000 },
  'orders/c-delivered': { userId: 'cust', status: 'delivered', total: 1000 },
  'orders/od1': { userId: 'cust2', status: 'shipped', total: 500, paymentMethod: 'Cash On Delivery', paymentStatus: 'pending', delivery_boy_id: 'dboy', delivery_otp: '1234' },
  'orders/od2': { userId: 'cust2', status: 'outForDelivery', total: 500, delivery_boy_id: 'dboy', delivery_otp: '1234' },
  'orders/od3': { userId: 'cust2', status: 'shipped', total: 500, delivery_boy_id: 'dboy' },
});
await allow('a customer places their own order', 'cust', (db) => db.doc('orders/new-c').set({ userId: 'cust', status: 'pending', total: 1000, paymentMethod: 'Cash On Delivery', paymentStatus: 'pending' }));
await deny('a customer cannot place an order in another name', 'cust', (db) => db.doc('orders/new-x').set({ userId: 'cust2', status: 'pending' }));
await deny('a signed-out visitor cannot place an order', null, (db) => db.doc('orders/new-y').set({ userId: 'cust' }));
await allow('a customer reads their own order', 'cust', get('orders/c-pending'));
await deny("a customer cannot read someone else's order", 'cust', get('orders/o1'));
await allow('a customer lists their own orders', 'cust', (db) => db.collection('orders').where('userId', '==', 'cust').get());
await deny('a customer cannot list every order', 'cust', list('orders'));
await deny('a signed-out visitor cannot list orders', null, list('orders'));
await allow('a customer cancels a pending order', 'cust', (db) => db.doc('orders/c-pending').update(cancelled));
await deny('a customer cannot cancel a shipped order', 'cust', (db) => db.doc('orders/c-shipped').update(cancelled));
await deny('a cancellation cannot also change the total', 'cust', (db) => db.doc('orders/c-pending2').update({ ...cancelled, total: 1 }));
await deny('a cancellation cannot also mark it refunded', 'cust', (db) => db.doc('orders/c-pending2').update({ ...cancelled, paymentStatus: 'refunded' }));
await deny("a cancellation must say it's by the customer", 'cust', (db) => db.doc('orders/c-pending2').update({ ...cancelled, cancelledBy: 'admin' }));
await allow('a customer asks to return a delivered order', 'cust', (db) => db.doc('orders/c-delivered').update({ status: 'returnRequested' }));
await deny('a customer cannot ask to return an undelivered order', 'cust', (db) => db.doc('orders/c-pending2').update({ status: 'returnRequested' }));
await deny('a customer cannot mark their order delivered', 'cust', (db) => db.doc('orders/c-shipped').update({ status: 'delivered' }));
await deny("a customer cannot cancel someone else's order", 'cust', (db) => db.doc('orders/o1').update(cancelled));
await allow('the delivery partner reads an order assigned to them', 'dboy', get('orders/od1'));
await deny('another delivery partner cannot read it', 'dboy2', get('orders/od1'));
await allow('delivery: shipped -> picked', 'dboy', (db) => db.doc('orders/od1').update({ status: 'picked' }));
await allow('delivery: picked -> outForDelivery', 'dboy', (db) => db.doc('orders/od1').update({ status: 'outForDelivery' }));
await deny('delivery partner cannot change the total', 'dboy', (db) => db.doc('orders/od1').update({ total: 1 }));
await allow('delivery: cash on delivery collected', 'dboy', (db) => db.doc('orders/od1').update({ paymentStatus: 'paid', paymentCollectedAt: 1, paymentCollectedBy: 'dboy', paymentCollectedByName: 'D', updatedAt: 1 }));
await allow('delivery: outForDelivery -> delivered with OTP cleared', 'dboy', (db) => db.doc('orders/od1').update({ status: 'delivered', delivery_otp: null, otp_verified: true }));
await deny('delivery: cannot mark delivered without clearing the OTP', 'dboy', (db) => db.doc('orders/od2').update({ status: 'delivered' }));
await deny('delivery: cannot skip from shipped to delivered', 'dboy', (db) => db.doc('orders/od3').update({ status: 'delivered', delivery_otp: null, otp_verified: true }));
await deny('delivery: cannot touch an order not assigned to them', 'dboy', (db) => db.doc('orders/o1').update({ status: 'picked' }));
await allow('a customer reads a chat message on their order', 'cust2', get('orders/o1/messages/m1'));
await deny('a customer cannot read an internal note', 'cust2', get('orders/o1/messages/note'));
await allow('a customer writes in their order chat', 'cust2', (db) => db.doc('orders/o1/messages/c1').set({ authorType: 'customer', authorId: 'cust2', visibility: 'customer', channel: 'chat', text: 'When?' }));
await deny('a customer cannot post as staff', 'cust2', (db) => db.doc('orders/o1/messages/c2').set({ authorType: 'staff', authorId: 'cust2', visibility: 'customer', channel: 'chat', text: 'x' }));
await deny('a customer cannot post as another person', 'cust2', (db) => db.doc('orders/o1/messages/c3').set({ authorType: 'customer', authorId: 'cust', visibility: 'customer', channel: 'chat', text: 'x' }));
await deny('a customer cannot post an internal note', 'cust2', (db) => db.doc('orders/o1/messages/c4').set({ authorType: 'customer', authorId: 'cust2', visibility: 'internal', channel: 'chat', text: 'x' }));
await deny("a customer cannot write in someone else's order chat", 'cust', (db) => db.doc('orders/o1/messages/c5').set({ authorType: 'customer', authorId: 'cust', visibility: 'customer', channel: 'chat', text: 'x' }));
await deny('a customer cannot edit an order message', 'cust2', (db) => db.doc('orders/o1/messages/m1').update({ text: 'edited' }));
await allow('a customer reads their own refund', 'cust2', get('refunds/rf1'));
await deny("a customer cannot read someone else's refund", 'cust', get('refunds/rf1'));
await deny('a customer cannot approve their own refund', 'cust2', (db) => db.doc('refunds/rf1').update({ status: 'approved' }));
await deny('even the owner cannot delete a refund', 'owner', del('refunds/rf1'));

// ── 6. Activity log, recycle bin, dealer tickets ────────────────────────────
console.log('\n6. Activity log, recycle bin, dealer tickets');
await allow('staff writes their own activity entry', 'st-products', (db, i) => db.doc(`activityLog/s${i}`).set({ actorUid: 'st-products', action: 'update' }));
await deny('staff cannot log an entry in the owner\'s name', 'st-products', (db, i) => db.doc(`activityLog/s${i}`).set({ actorUid: 'owner', action: 'update' }));
await deny('a customer cannot write the activity log', 'cust', (db, i) => db.doc(`activityLog/c${i}`).set({ actorUid: 'cust' }));
await deny('a switched-off login cannot write the activity log', 'st-off', (db, i) => db.doc(`activityLog/o${i}`).set({ actorUid: 'st-off' }));
await deny('staff cannot read the activity log', 'st-products', list('activityLog'));
await deny('even the owner cannot edit an activity entry', 'owner', (db) => db.doc('activityLog/a1').update({ action: 'x' }));
await deny('even the owner cannot delete an activity entry', 'owner', del('activityLog/a1'));
await allow('staff bins a product they delete', 'st-products', (db, i) => db.doc(`recycleBin/s${i}`).set({ path: 'products/ps', data: { name: 'x' }, deletedByUid: 'st-products' }));
await deny("staff cannot bin something in the owner's name", 'st-products', (db, i) => db.doc(`recycleBin/s${i}`).set({ path: 'products/ps', deletedByUid: 'owner' }));
await deny('a customer cannot write to the bin', 'cust', (db, i) => db.doc(`recycleBin/c${i}`).set({ path: 'products/ps', deletedByUid: 'cust' }));
await allow('owner restores an entry (writes the document back)', 'owner', (db) => db.doc('products/old').set({ name: 'Old' }).then(() => db.doc('recycleBin/b1').delete()));
await deny('dealer staff cannot set a ticket to any other status', 'st-dealerChats', (db) => db.doc('dealerTickets/k1').update({ status: 'deleted' }));
await deny('dealer staff cannot move a ticket to another dealer while closing it', 'st-dealerChats', (db) => db.doc('dealerTickets/k1').update({ status: 'closed', dealerId: 'd2' }));
await allow('dealer staff closes a ticket with who and when', 'st-dealerChats', (db, i) => db.doc('dealerTickets/k1').update({ status: 'closed', closedAt: i, closedByUid: 'st-dealerChats', closedByName: 'S', updatedAt: i }));

// ── 7. Storefront visitors ──────────────────────────────────────────────────
console.log('\n7. Storefront visitors');
for (const c of ['homeBanners', 'homeCollections', 'homeVideos', 'banners', 'showcases', 'testimonials', 'gallery', 'categories', 'reviews']) {
  await allow(`a signed-out visitor reads ${c}`, null, list(c));
}
await allow('a signed-out visitor reads site settings', null, get('siteSettings/delivery'));
await deny('a customer cannot change site settings', 'cust', (db, i) => db.doc('siteSettings/delivery').set({ v: i }, { merge: true }));
await allow('a visitor joins the newsletter', null, (db) => db.doc('newsletterSubscriptions/new@shop.in').set({ email: 'new@shop.in', subscribedAt: 1 }));
await deny('newsletter: a bad email is refused', null, (db) => db.doc('newsletterSubscriptions/not-an-email').set({ email: 'not-an-email' }));
await deny('newsletter: extra fields are refused', null, (db) => db.doc('newsletterSubscriptions/x@shop.in').set({ email: 'x@shop.in', admin: true }));
await deny('newsletter: the email must match the document', null, (db) => db.doc('newsletterSubscriptions/y@shop.in').set({ email: 'z@shop.in' }));
await deny('newsletter: joining twice is refused, not an overwrite', null, (db) => db.doc('newsletterSubscriptions/new@shop.in').set({ email: 'new@shop.in', subscribedAt: 2 }));
await deny('newsletter: a visitor cannot read the list', null, list('newsletterSubscriptions'));
await allow('a customer writes their own review', 'cust', (db) => db.doc('reviews/rv-cust').set({ userId: 'cust', productId: 'p1', rating: 5, status: 'pending' }));
await deny("a customer cannot write a review in someone else's name", 'cust', (db) => db.doc('reviews/rv-x').set({ userId: 'cust2', rating: 1, status: 'pending' }));
await deny('a customer cannot approve their own review', 'cust', (db) => db.doc('reviews/rv-cust').update({ status: 'approved' }));
await allow('a customer rates their delivery', 'cust2', (db) => db.doc('deliveryRatings/dr-c2').set({ userId: 'cust2', deliveryBoyId: 'dboy', rating: 4 }));
await deny("a customer cannot rate in someone else's name", 'cust', (db) => db.doc('deliveryRatings/dr-x').set({ userId: 'cust2', deliveryBoyId: 'dboy', rating: 1 }));
await allow('the rated delivery partner reads the rating', 'dboy', get('deliveryRatings/dr1'));
await allow('the customer reads their own rating', 'cust2', get('deliveryRatings/dr1'));
await deny("another customer cannot read the rating", 'cust', get('deliveryRatings/dr1'));
await allow('a customer saves their push token', 'cust', (db) => db.doc('userTokens/tok-cust').set({ uid: 'cust', token: 'tok-cust' }));
await deny("a customer cannot save a token in someone else's name", 'cust', (db) => db.doc('userTokens/tok-x').set({ uid: 'cust2', token: 'tok-x' }));
await allow('a customer reads their own token', 'cust', get('userTokens/tok-cust'));
await deny("a customer cannot read someone else's token", 'cust', get('userTokens/tok1'));
await deny("a customer cannot delete someone else's token", 'cust', del('userTokens/tok1'));
await allow('a customer deletes their own token on sign-out', 'cust', del('userTokens/tok-cust'));
await allow('a customer starts a video call', 'cust', (db) => db.doc('videoCalls/vc1').set({ callerUid: 'cust', calleeUid: 'owner' }));
await deny('a customer cannot start a call in someone else\'s name', 'cust', (db) => db.doc('videoCalls/vc2').set({ callerUid: 'cust2', calleeUid: 'owner' }));
await allow('the person called reads the call', 'owner', get('videoCalls/vc1'));
await deny('a third person cannot read the call', 'cust2', get('videoCalls/vc1'));
await allow('the caller sends connection details', 'cust', (db) => db.doc('videoCalls/vc1/callerCandidates/c1').set({ c: 1 }));
await deny('a third person cannot send connection details', 'cust2', (db) => db.doc('videoCalls/vc1/calleeCandidates/c1').set({ c: 1 }));
await allow('a customer books a video call', 'cust', (db) => db.doc('videoCallRequests/vr-cust').set({ customerUid: 'cust', status: 'pending' }));
await deny('a customer cannot book in someone else\'s name', 'cust', (db) => db.doc('videoCallRequests/vr-x').set({ customerUid: 'cust2', status: 'pending' }));
await allow('a customer lists their own video call bookings', 'cust', (db) => db.collection('videoCallRequests').where('customerUid', '==', 'cust').get());
await allow('a customer cancels their own booking', 'cust', (db) => db.doc('videoCallRequests/vr-cust').update({ status: 'cancelled' }));
await deny("a customer cannot read someone else's booking", 'cust', get('videoCallRequests/v1'));
await allow('a signed-in customer reads a shop gift card code', 'cust', get('giftCards/gc1'));

// ── 8. Known gaps (do not fail the run) ─────────────────────────────────────
console.log('\n8. Known gaps (should be fixed; see README)');
await gap('G1', 'Content staff can change siteSettings/adminNotification (the owner-only Settings page: where order alerts go)', 'deny', 'st-content',
  (db) => db.doc('siteSettings/adminNotification').set({ whatsappNumber: '+910000000000' }, { merge: true }));
await seed({ 'users/st-planted': staff(['products']) });
await gap('G2', "Staff can plant a recycle-bin entry for a path they can't write (owner's Restore would create an admin)", 'deny', 'st-planted',
  (db) => db.doc('recycleBin/planted').set({ path: 'users/sleeper', collection: 'users', docId: 'sleeper', label: 'Silver ring', data: { role: 'admin' }, deletedByUid: 'st-planted' }));
await gap('G3', 'A customer can set their own wallet balance', 'deny', 'cust2', (db) => db.doc('users/cust2/wallets/w1').update({ balance: 99999 }));
await gap('G4', 'A customer can publish their own review as already approved', 'deny', 'cust', (db) => db.doc('reviews/rv-self').set({ userId: 'cust', productId: 'p1', rating: 5, status: 'approved' }));
await gap('G5', 'Any signed-in user can rewrite a shop-wide gift card balance', 'deny', 'cust', (db) => db.doc('giftCards/gc1').update({ balance: 999999 }));
await gap('G6', 'Any signed-in user can list every video call booking', 'deny', 'cust', list('videoCallRequests'));
await gap('G7', 'Any signed-in user can list every account deletion request', 'deny', 'cust', list('accountDeletionRequests'));
await gap('G8', "A customer can write a prepaid order marked 'paid' without paying (orders are written by the browser)", 'deny', 'cust',
  (db) => db.doc('orders/free').set({ userId: 'cust', status: 'pending', total: 1, paymentMethod: 'Razorpay', paymentStatus: 'paid' }));
await gap('G9', 'Staff with only Dashboard cannot load orders, so the Dashboard page is empty', 'allow', 'st-dashboard', list('orders'));
await gap('G10', 'Customer details reads users/{id}/orders, which has no rule: refused even for the owner', 'allow', 'owner', list('users/cust2/orders'));
await gap('G11', "Customer details reads the customer's wishlist: refused for staff with Customers", 'allow', 'st-customers', list('users/cust2/wishlist'));

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed, ${gaps.length} known gaps open${closed.length ? `, ${closed.length} gaps now closed` : ''}`);
for (const g of gaps) console.log('  open  ', g);
for (const g of closed) console.log('  closed', g);
