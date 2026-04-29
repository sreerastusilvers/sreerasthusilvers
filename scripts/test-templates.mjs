/**
 * WhatsApp Template Test — calls Meta API directly (no server needed)
 * Usage:  node scripts/test-templates.mjs
 *
 * Reads WHATSAPP_TOKEN and WHATSAPP_PHONE_ID from env vars OR falls back
 * to the hardcoded values below.
 */

const TOKEN    = process.env.WHATSAPP_TOKEN    || 'EAAQWhgBVraABRAzgddTUijVVrWhoJkkcx44WNb3QpSCXwgGCa3UrvkcgLZB4xuGpm0DxQpySUrBfmInqxRZCmZCHOIkauGkB6gQGp7U0Ky7c7JWyznEj5kdVaedRsZCi8MrRzyqOvKGQ6BSExf6HeZAPut9MXDeZB0o7B1dn7kG3eFIZCyXyVQuc3ulb0wJhoUgMwZDZD';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1112943475226121';
const BASE     = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

// ── recipients ──────────────────────────────────────────────────────────────
const customer = '919849834102';
const admin    = '919959935203';
const delivery = '919390011378';

// fake orderId that will form the button deep link
const ORDER_ID = 'TESTORDER123ABC';
const CUSTOMER_BASE = 'https://sreerasthusilvers-kkd.vercel.app/account/orders/';
const ADMIN_BASE    = 'https://sreerasthusilvers-kkd.vercel.app/admin/orders/';

async function send(label, to, templateName, bodyParams, urlSuffix = null) {
  const components = [];
  if (bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map(p => ({ type: 'text', text: p })) });
  }
  if (urlSuffix) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlSuffix }] });
  }
  const resp = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: 'en' }, components },
    }),
  });
  const data = await resp.json();
  if (resp.ok) {
    console.log(`✅  ${label} → sent  (id: ${data?.messages?.[0]?.id})`);
  } else {
    console.log(`❌  ${label} → FAILED`);
    console.log(`    Error: ${data?.error?.message || JSON.stringify(data?.error)}`);
  }
}

console.log('\n=== WhatsApp Template Test — all 13 templates ===\n');

// ── CUSTOMER ─────────────────────────────────────────────────────────────────
await send('order_confirmed → customer',        customer, 'order_confirmed',
  ['Priya', '#AB12CD', 'Silver Chain', '1299'], ORDER_ID);

await send('order_out_for_delivery → customer', customer, 'order_out_for_delivery',
  ['Priya', '#AB12CD', 'Silver Chain'],          ORDER_ID);

await send('order_delivered → customer',        customer, 'order_delivered',
  ['Priya', '#AB12CD', 'Silver Chain'],          ORDER_ID);

await send('order_cancelled → customer',        customer, 'order_cancelled',
  ['Priya', '#AB12CD', 'Silver Chain'],          ORDER_ID);

await send('order_refunded → customer',         customer, 'order_refunded',
  ['Priya', '#AB12CD', 'Silver Chain'],          ORDER_ID);

await send('order_return_update → customer',    customer, 'order_return_update',
  ['Priya', '#AB12CD', 'Silver Chain', 'approved'], ORDER_ID);

await send('order_timeslot → customer',         customer, 'order_timeslot',
  ['Priya', '#AB12CD', '30 Apr', '9 AM - 12 PM'], ORDER_ID);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
await send('admin_order_alert → admin',         admin, 'admin_order_alert',
  ['#AB12CD', 'Silver Chain', '1299', 'Priya Nair'], ORDER_ID);

await send('admin_order_delivered → admin',     admin, 'admin_order_delivered',
  ['#AB12CD', 'Priya Nair'],                     ORDER_ID);

await send('admin_return_requested → admin',    admin, 'admin_return_requested',
  ['#AB12CD', 'Priya Nair', 'Silver Chain'],     ORDER_ID);

await send('admin_return_picked → admin',       admin, 'admin_return_picked',
  ['#AB12CD', 'Silver Chain'],                   ORDER_ID);

await send('admin_returned → admin',            admin, 'admin_returned',
  ['#AB12CD', 'Priya Nair', 'Silver Chain'],     ORDER_ID);

// ── DELIVERY PARTNER ─────────────────────────────────────────────────────────
// delivery_new_task has a Static button URL (no urlSuffix needed)
await send('delivery_new_task → partner',       delivery, 'delivery_new_task',
  ['Ravi', '#AB12CD', 'Silver Chain', '12 MG Road, Vizag'], null);

console.log('\nDone.\n');
