// Customer "your order is in" email, sent only through Resend's HTTPS API.
// Never SMTP (Render blocks outbound SMTP) and never awaited by the order request:
// queueCustomerEmail() returns right away and the send runs on its own with an 8s timeout.

const DEFAULTS = {
  name: "Wilson's Pizza & Grill",
  address: '1801 Quindaro Blvd, Kansas City, KS 66104',
  phone: '(913) 621-4066',
  site: 'https://wilsons-pizza-grill.onrender.com',
  from: "Wilson's Pizza & Grill <orders@wilsonspizzaandgrill.net>",
  replyTo: 'wilsonspizzaandgrill@gmail.com'
};
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const TIMEOUT_MS = 8000;

const money = n => '$' + (Number(n) || 0).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const one = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();

// Link the customer can open on any device. Same shape the storefront uses (#/order/{id}), plus ?t= so another device can load it.
const orderLink = (site, id, token) => String(site || DEFAULTS.site).replace(/\/+$/, '') + '/#/order/' + encodeURIComponent(id) + (token ? '?t=' + encodeURIComponent(token) : '');

const providerFlag = (env = process.env) => (env.RESEND_API_KEY ? 'resend' : false);

function buildCustomerEmail(o, cfg = {}) {
  const name = cfg.name || DEFAULTS.name, address = cfg.address || DEFAULTS.address, phone = cfg.phone || DEFAULTS.phone;
  const link = orderLink(cfg.site, o.id, o.token);
  const when = !o.when || o.when === 'asap' ? 'ASAP, about ' + (cfg.pickupMins || 25) + ' min after you paid' : one(o.when);
  const first = one((o.customer && o.customer.name) || '').split(' ')[0];
  const items = (o.items || []).map(i => ({ label: (i.qty || 1) + ' x ' + one(i.name) + (i.mods && i.mods.length ? ' (' + i.mods.map(one).join(', ') + ')' : ''), note: one(i.note), price: money(i.lineTotal) }));
  const sums = [['Subtotal', money(o.subtotal)], ['Sales tax', money(o.tax)]].concat(o.tip ? [['Tip', money(o.tip)]] : []).concat([['Total', money(o.total)]]);
  const text = [
    (first ? 'Thanks ' + first + '!' : 'Thanks!') + ' Order #' + o.id + ' is in.',
    '',
    'Pickup: ' + address,
    'When: ' + when,
    '',
    ...items.map(i => i.label + (i.note ? ' [Note: ' + i.note + ']' : '') + '  ' + i.price),
    '',
    ...sums.map(([k, v]) => k + ': ' + v),
    '',
    'See your order and live status here:',
    link,
    '',
    'Questions? Call ' + phone + '.',
    name
  ].join('\n');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:520px">'
    + '<h2 style="margin:0 0 8px">' + esc(first ? 'Thanks ' + first + '!' : 'Thanks!') + ' Order #' + esc(o.id) + ' is in.</h2>'
    + '<p style="margin:0 0 4px"><b>Pickup:</b> ' + esc(address) + '</p><p style="margin:0 0 12px"><b>When:</b> ' + esc(when) + '</p>'
    + '<p style="margin:0 0 16px"><a href="' + esc(link) + '" style="display:inline-block;background:#c8102e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">View your order</a></p>'
    + '<table style="width:100%;border-collapse:collapse">' + items.map(i => '<tr><td style="padding:4px 0">' + esc(i.label) + (i.note ? '<br><small>Note: ' + esc(i.note) + '</small>' : '') + '</td><td style="padding:4px 0;text-align:right">' + esc(i.price) + '</td></tr>').join('')
    + sums.map(([k, v], n) => '<tr><td style="padding:2px 0;' + (n === sums.length - 1 ? 'font-weight:bold' : 'color:#555') + '">' + esc(k) + '</td><td style="padding:2px 0;text-align:right;' + (n === sums.length - 1 ? 'font-weight:bold' : 'color:#555') + '">' + esc(v) + '</td></tr>').join('') + '</table>'
    + '<p style="margin:16px 0 4px">The page updates live as we make your food.</p>'
    + '<p style="margin:0;color:#555">Questions? Call ' + esc(phone) + '.<br>' + esc(name) + '</p></div>';
  return { to: String((o.customer && o.customer.email) || '').trim(), subject: name + ': order #' + o.id + ' is in', text, html, link };
}

async function sendViaResend(mail, env = process.env, fetchFn = fetch) {
  const base = String(env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/+$/, '');
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetchFn(base + '/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.CUSTOMER_EMAIL_FROM || DEFAULTS.from, to: [mail.to], reply_to: env.CUSTOMER_EMAIL_REPLY_TO || DEFAULTS.replyTo, subject: mail.subject, text: mail.text, html: mail.html }),
      signal: ac.signal
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Resend ' + r.status + ': ' + String(body.message || body.name || '').slice(0, 200));
    return { ok: true, id: body.id || '' };
  } finally { clearTimeout(timer); }
}

// Fire-and-forget. Returns synchronously; never throws; at most one send per order id per process,
// and skipped if the stored order already has customerEmail.sentAt.
function makeCustomerEmailer({ env = process.env, store = null, cfg = () => ({}), fetchFn = fetch, log = console } = {}) {
  const started = new Set();
  const run = async o => {
    if (store) { const cur = await store.getOrder(String(o.id)).catch(() => null); if (cur && cur.customerEmail && cur.customerEmail.sentAt) return { ok: true, skipped: 'already sent' }; }
    const mail = buildCustomerEmail(o, await cfg());
    const r = await sendViaResend(mail, env, fetchFn);
    log.log('[customer email] order', o.id, 'sent via resend', r.id);
    if (store) { const cur = await store.getOrder(String(o.id)).catch(() => null); if (cur) { cur.customerEmail = { sentAt: new Date().toISOString(), id: r.id }; await store.saveOrder(cur); } }
    return r;
  };
  const queue = o => {
    const to = String((o && o.customer && o.customer.email) || '').trim();
    if (!o || !o.id) return { queued: false, reason: 'no order' };
    if (!providerFlag(env)) return { queued: false, reason: 'RESEND_API_KEY not set' };
    if (!EMAIL_RE.test(to)) return { queued: false, reason: 'no customer email' };
    if (started.has(String(o.id))) return { queued: false, reason: 'already queued' };
    started.add(String(o.id));
    const p = new Promise(res => setImmediate(() => run(o).then(res, e => { log.error('[customer email] order', o.id, 'failed:', e && e.name === 'AbortError' ? 'timed out after ' + TIMEOUT_MS + 'ms' : (e && e.message)); res({ ok: false, error: String(e && e.message) }); })));
    return { queued: true, done: p };
  };
  return { queue, started };
}

module.exports = { buildCustomerEmail, orderLink, providerFlag, sendViaResend, makeCustomerEmailer, TIMEOUT_MS, DEFAULTS };
