// Dealer (manufacturer) chats: team permissions, tickets, the opening template,
// number privacy, and the webhook routing dealer replies away from the
// customer inbox. Real source, fake Firestore + fake Meta.
import { createRequire } from 'node:module';
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
for (const [entry, name] of [['api/whatsapp-reply.ts', 'reply-dealer.mjs'], ['api/whatsapp-webhook.ts', 'webhook-dealer.mjs']]) {
  await build({ entryPoints: [path.join(repo, entry)], bundle: true, format: 'esm', platform: 'node', outfile: path.join(out, name), plugins: [alias], external: ['@vercel/node'], logLevel: 'error' });
}
const rp = await import(pathToFileURL(path.join(out, 'reply-dealer.mjs')).href);
const wh = await import(pathToFileURL(path.join(out, 'webhook-dealer.mjs')).href);
const fake = await import(pathToFileURL(path.join(here, 'fake-firebase-admin.mjs')).href);
const s = fake.store;

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

process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = 'PID';
const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
let sent = [];
let wamidSeq = 0;
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
  return json({ messages: [{ id: `wamid.${++wamidSeq}` }] });
};

const call = async (body, token = 'uid:staff1') => {
  let status = 0;
  let payload = null;
  const res = {
    setHeader() {},
    status(c) { status = c; return this; },
    json(p) { payload = p; return this; },
    send(p) { payload = p; return this; },
    end() { return this; },
  };
  await rp.default({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, res);
  return { status, payload };
};

const PHONE = '+919876500001';
const seed = ({ windowOpen = false, template = true } = {}) => {
  s.clear();
  sent = [];
  wamidSeq = 0;
  s.set('users/admin1', { role: 'admin' });
  s.set('users/staff1', { role: 'staff', isActive: true, username: 'Ravi', permissions: ['dealerChats'] });
  s.set('users/web1', { role: 'staff', isActive: true, username: 'Sita', permissions: ['products', 'content'] });
  s.set('users/off1', { role: 'staff', isActive: false, username: 'Old', permissions: ['dealerChats'] });
  s.set('dealers/d1', { displayName: 'Dealer A', active: true, ...(windowOpen ? { replyWindowClosesAt: ts(Date.now() + 3600e3) } : {}) });
  s.set('dealerPrivate/d1', { phone: PHONE, originalName: 'Real Silversmith Co' });
  if (template) {
    s.set('siteSettings/dealerChat', { templateName: 'dealer_enquiry', language: 'en' });
    s.set('whatsappTemplates/dealer_enquiry', {
      name: 'dealer_enquiry',
      language: 'en',
      bodyText: 'Hello, this is Sreerasthu Silvers. We have a new requirement for you (ref {{1}}): {{2}}. Please reply.',
    });
  }
};
const noPhoneAnywhere = (obj) => {
  const text = JSON.stringify(obj || {});
  assert.ok(!text.includes('9876500001'), `phone leaked: ${text.slice(0, 200)}`);
  assert.ok(!text.includes('Real Silversmith'), `real name leaked: ${text.slice(0, 200)}`);
};

// ---- permissions
await t('pure: callerMay', () => {
  const staff = { owner: false, permissions: ['dealerChats'] };
  assert.equal(rp.callerMay(staff, 'dealer-ticket'), true);
  assert.equal(rp.callerMay(staff, 'media'), true);
  assert.equal(rp.callerMay(staff, 'send'), false);
  assert.equal(rp.callerMay(staff, 'templates-create'), false);
  assert.equal(rp.callerMay(staff, 'unknown-action'), false);
  assert.equal(rp.callerMay({ owner: true, permissions: [] }, 'templates-create'), true);
  assert.equal(rp.oneLine('a\nb\t c    d'), 'a / b / c d');
  assert.equal(rp.ticketNumber(7), 'T-0007');
});
await t('staff without dealer access is refused (403); switched-off login is refused (401)', async () => {
  seed();
  assert.equal((await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'x' }, 'uid:web1')).status, 403);
  assert.equal((await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'x' }, 'uid:off1')).status, 401);
  assert.equal((await call({ action: 'send', phone: '+911', text: 'hi' }, 'uid:staff1')).status, 403);
  assert.equal(sent.length, 0);
});

// ---- tickets
await t('no template set up and window closed: clear 409, nothing sent', async () => {
  seed({ template: false });
  const r = await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Anklets' });
  assert.equal(r.status, 409);
  assert.match(r.payload.error, /template/i);
  assert.equal(sent.length, 0);
});
await t('ticket with window closed sends the approved template to the dealer number', async () => {
  seed();
  const r = await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Silver anklets', details: '2 pairs\n40 g each' });
  assert.equal(r.status, 200, JSON.stringify(r.payload));
  assert.equal(r.payload.number, 'T-0001');
  assert.equal(r.payload.via, 'template');
  noPhoneAnywhere(r.payload);
  const m = sent[0].body;
  assert.equal(m.to, '919876500001');
  assert.equal(m.type, 'template');
  assert.equal(m.template.name, 'dealer_enquiry');
  assert.deepEqual(m.template.components[0].parameters.map((p) => p.text), ['T-0001', 'Silver anklets: 2 pairs / 40 g each']);
  const ticket = [...s.entries()].find(([k]) => k.startsWith('dealerTickets/'))[1];
  assert.equal(ticket.number, 'T-0001');
  assert.equal(ticket.createdByName, 'Ravi');
  assert.equal(ticket.status, 'open');
  const dealer = s.get('dealers/d1');
  assert.equal(dealer.awaitingReply, true);
  assert.equal(dealer.lastTicketNumber, 'T-0001');
  // Nothing a staff member can read holds the number or real name.
  for (const [k, v] of s.entries()) if (k.startsWith('dealers/') || k.startsWith('dealerTickets/')) noPhoneAnywhere(v);
  const msg = s.get('dealers/d1/messages/wamid.1');
  assert.equal(msg.sentByName, 'Ravi');
  assert.match(msg.text, /ref T-0001/);
  const second = await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Toe rings' });
  assert.equal(second.payload.number, 'T-0002');
});
await t('inside the window a ticket goes as plain text', async () => {
  seed({ windowOpen: true, template: false });
  const r = await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Kids bangles' });
  assert.equal(r.status, 200);
  assert.equal(r.payload.via, 'text');
  assert.equal(sent[0].body.type, 'text');
  assert.match(sent[0].body.text.body, /New requirement \(ref T-0001\)\nKids bangles/);
  assert.notEqual(s.get('dealers/d1').awaitingReply, true);
});
await t('chat messages: refused until the dealer replies, then sent and tagged with the ticket', async () => {
  seed();
  await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Anklets' });
  sent = [];
  const closed = await call({ action: 'dealer-send', dealerId: 'd1', text: 'Any update?' });
  assert.equal(closed.status, 409);
  assert.equal(sent.length, 0);
  s.set('dealers/d1', { ...s.get('dealers/d1'), replyWindowClosesAt: ts(Date.now() + 3600e3) });
  const ok = await call({ action: 'dealer-send', dealerId: 'd1', text: 'Here is the design' });
  assert.equal(ok.status, 200, JSON.stringify(ok.payload));
  const id = ok.payload.messageId;
  assert.equal(s.get(`dealers/d1/messages/${id}`).ticketNumber, 'T-0001');
});
await t('unknown or hidden dealer: 404', async () => {
  seed();
  assert.equal((await call({ action: 'dealer-ticket', dealerId: 'nope', subject: 'x' })).status, 404);
  s.set('dealers/d1', { ...s.get('dealers/d1'), active: false });
  assert.equal((await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'x' })).status, 404);
  assert.equal((await call({ action: 'dealer-ticket', dealerId: '../users/admin1', subject: 'x' })).status, 400);
});

// ---- webhook
const deps = { fromMillis: ts, serverTimestamp: () => ({ __ts: true }), increment: (n) => ({ __inc: n }) };
await t('webhook: a dealer reply lands in the dealer chat, not the customer inbox', async () => {
  seed();
  await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Anklets' });
  const ticketId = s.get('dealers/d1').lastTicketId;
  await wh.processWebhookPayload(fake.default.firestore(), {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '919876500001', profile: { name: 'Real Silversmith Co' } }],
      messages: [{ id: 'wamid.IN1', from: '919876500001', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Yes, possible' }, context: { id: 'wamid.1' } }],
    } }] }],
  }, deps);
  assert.equal([...s.keys()].some((k) => k.startsWith('whatsappThreads/')), false);
  const msg = s.get('dealers/d1/messages/wamid.IN1');
  assert.equal(msg.text, 'Yes, possible');
  assert.equal(msg.ticketId, ticketId);
  const dealer = s.get('dealers/d1');
  assert.equal(dealer.awaitingReply, false);
  assert.equal(dealer.unreadCount, 1);
  assert.ok(dealer.replyWindowClosesAt.toMillis() > Date.now());
  noPhoneAnywhere(dealer);
  noPhoneAnywhere(msg);
  assert.equal(s.get('dealerPrivate/d1').waProfileName, 'Real Silversmith Co');
  assert.ok(s.get(`dealerTickets/${ticketId}`).lastDealerReplyAt);
});
await t('webhook: delivery ticks reach messages sent to dealers; customers still use threads', async () => {
  seed();
  await call({ action: 'dealer-ticket', dealerId: 'd1', subject: 'Anklets' });
  await wh.processWebhookPayload(fake.default.firestore(), {
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', recipient_id: '919876500001', status: 'delivered', timestamp: '1' }] } }] }],
  }, deps);
  assert.equal(s.get('dealers/d1/messages/wamid.1').status, 'delivered');
  await wh.processWebhookPayload(fake.default.firestore(), {
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.C1', from: '919000000000', timestamp: '1', type: 'text', text: { body: 'Hi' } }] } }] }],
  }, deps);
  assert.ok(s.get('whatsappThreads/+919000000000'));
});

console.log(`\n${passed} passed`);
