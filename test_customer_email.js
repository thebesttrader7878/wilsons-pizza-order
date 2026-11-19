// node test_customer_email.js : unit checks for the customer email (no network).
const assert = require('assert');
const CE = require('./lib/customer-email');

const o = { id: '1007', token: 'abc123def456abc123def456', when: 'asap', customer: { name: 'Sam Test', email: 'sam@example.com' },
  items: [{ qty: 2, name: 'Cheese Pizza', mods: ['16"'], note: 'well done', lineTotal: 30 }], subtotal: 30, tax: 2.74, tip: 3, total: 35.74 };

(async () => {
  const m = CE.buildCustomerEmail(o, { site: 'https://x.test/', pickupMins: 15 });
  assert.equal(m.link, 'https://x.test/#/order/1007?t=abc123def456abc123def456');
  assert.equal(m.to, 'sam@example.com');
  for (const s of ['Order #1007', '2 x Cheese Pizza (16")', 'Total: $35.74', 'Tip: $3.00', '1801 Quindaro Blvd', m.link]) assert.ok(m.text.includes(s), 'text has ' + s);
  assert.ok(m.html.includes('href="https://x.test/#/order/1007?t=abc123def456abc123def456"'));
  assert.ok(!/\u2014/.test(m.text + m.html), 'no em dash');
  assert.equal(CE.providerFlag({}), false);
  assert.equal(CE.providerFlag({ RESEND_API_KEY: 're_x' }), 'resend');

  // Fire-and-forget: queue returns before a hanging fetch finishes; aborts at the timeout; one send per order.
  let calls = 0, body = null;
  const hang = (url, opts) => { calls++; body = JSON.parse(opts.body); assert.equal(url, 'http://mock/emails'); assert.equal(opts.headers.Authorization, 'Bearer re_x');
    return new Promise((res, rej) => opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); })); };
  const logs = [];
  const em = CE.makeCustomerEmailer({ env: { RESEND_API_KEY: 're_x', RESEND_API_BASE: 'http://mock' }, fetchFn: hang, cfg: () => ({ site: 'https://x.test' }), log: { log: () => {}, error: (...a) => logs.push(a.join(' ')) } });
  const t0 = Date.now(); const q = em.queue(o); assert.ok(Date.now() - t0 < 20, 'queue is sync'); assert.equal(q.queued, true);
  assert.equal(em.queue(o).queued, false, 'second queue for same order is skipped');
  const r = await q.done; const took = Date.now() - t0;
  assert.equal(r.ok, false); assert.ok(took >= CE.TIMEOUT_MS - 100 && took < CE.TIMEOUT_MS + 1500, 'aborted near 8s, took ' + took);
  assert.ok(/timed out/.test(logs.join()), 'logged timeout');
  assert.equal(calls, 1); assert.deepEqual(body.to, ['sam@example.com']); assert.ok(body.text.includes('/#/order/1007?t='));
  assert.equal(body.from, "Wilson's Pizza & Grill <orders@wilsonspizzaandgrill.net>");

  // Off / no email: nothing queued.
  assert.equal(CE.makeCustomerEmailer({ env: {} }).queue(o).queued, false);
  assert.equal(CE.makeCustomerEmailer({ env: { RESEND_API_KEY: 'x' } }).queue(Object.assign({}, o, { customer: { name: 'a', email: '' } })).queued, false);
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
