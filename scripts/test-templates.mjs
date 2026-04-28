const TOKEN = 'EAAQWhgBVraABRAzgddTUijVVrWhoJkkcx44WNb3QpSCXwgGCa3UrvkcgLZB4xuGpm0DxQpySUrBfmInqxRZCmZCHOIkauGkB6gQGp7U0Ky7c7JWyznEj5kdVaedRsZCi8MrRzyqOvKGQ6BSExf6HeZAPut9MXDeZB0o7B1dn7kG3eFIZCyXyVQuc3ulb0wJhoUgMwZDZD';
const PHONE_ID = '1112943475226121';
const BASE = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

async function send(label, to, templateName, params) {
  const components = params.length
    ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: p })) }]
    : [];
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
    console.log(`✅  ${label} → sent (msgId: ${data?.messages?.[0]?.id})`);
  } else {
    console.log(`❌  ${label} → FAILED`);
    console.log('    Error:', JSON.stringify(data?.error));
  }
}

const customer = '919849834102';
const admin    = '919959935203';
const delivery = '919390011378';

console.log('\n=== WhatsApp Template Test ===\n');

// 1. order_placed → customer
// {{1}} name  {{2}} orderId  {{3}} items  {{4}} total
await send('order_placed → customer', customer, 'order_placed',
  ['Priya', '#AB12CD', 'Silver Chain', '1299']);

// 2. order_status_update → customer
// {{1}} name  {{2}} orderId  {{3}} items  {{4}} statusPhrase
await send('order_status_update → customer', customer, 'order_status_update',
  ['Priya', '#AB12CD', 'Silver Chain', 'is out for delivery']);

// 3. admin_new_order → admin
// {{1}} orderId  {{2}} items  {{3}} total  {{4}} customerName
await send('admin_new_order → admin', admin, 'admin_new_order',
  ['#AB12CD', 'Silver Chain', '1299', 'Priya Nair']);

// 4. delivery_assigned → delivery partner
// {{1}} partnerName  {{2}} orderId  {{3}} items  {{4}} address
await send('delivery_assigned → delivery', delivery, 'delivery_assigned',
  ['Ravi', '#AB12CD', 'Silver Chain', '12 MG Road, Kozhikode']);

console.log('\nDone.\n');
