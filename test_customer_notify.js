const assert = require('assert');
const crypto = require('crypto');
const {
  orderStatusUrl, buildCustomerEmail, buildCustomerSms, toE164,
  verifyStripeWebhook, providerFlags, notifyCustomer, DEFAULTS
} = require('./lib/customer-notify');

const order = {
  id: '1001',
  token: 'aabbccddeeff001122334455',
  when: 'asap',
  customer: { name: 'Test', email: 'test@example.com', phone: '9135550100' }
};

const url = orderStatusUrl(DEFAULTS.site, order.id, order.token);
assert.ok(url.includes('/#/order/1001/aabbccddeeff001122334455'), url);
assert.ok(!url.match(/#\/order\/1001$/), 'link must include token');

const mail = buildCustomerEmail(order);
assert.equal(mail.to, 'test@example.com');
assert.ok(mail.from.startsWith('"Wilson\'s Pizza & Grill"'));
assert.equal(mail.subject, "Wilson's Pizza & Grill: Order #1001 is in");
assert.ok(mail.text.includes('Order #1001 is in'));
assert.ok(mail.text.includes(DEFAULTS.address));
assert.ok(mail.text.includes('ASAP'));
assert.ok(mail.text.includes(url));

const sms = buildCustomerSms(order);
assert.ok(sms.startsWith("Wilson's Pizza & Grill: Order #1001 is in!"));
assert.ok(sms.includes(DEFAULTS.address));
assert.ok(sms.includes(url));

assert.equal(toE164('913-555-0100'), '+19135550100');
assert.equal(toE164('(913) 555-0100'), '+19135550100');
assert.equal(toE164('+19135550100'), '+19135550100');
assert.equal(toE164('19135550100'), '+19135550100');
assert.equal(toE164('555'), '');

const envEmpty = {};
assert.deepEqual(providerFlags(envEmpty), { email: false, sms: false });
assert.equal(providerFlags({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.c', SMTP_PASS: 'x' }).email, 'smtp');
assert.equal(providerFlags({ RESEND_API_KEY: 're_x', RESEND_FROM: 'a@b.c' }).email, 'resend');
assert.equal(providerFlags({ TWILIO_ACCOUNT_SID: 'ACxx', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+1555' }).sms, 'twilio');

const raw = Buffer.from('{"type":"checkout.session.completed"}');
const secret = 'whsec_test';
const t = '1700000000';
const v1 = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(t + '.'), raw])).digest('hex');
assert.equal(verifyStripeWebhook(raw, `t=${t},v1=${v1}`, secret, 1700000000 * 1000), true);
assert.equal(verifyStripeWebhook(raw, `t=${t},v1=${v1}`, secret, 1700000000 * 1000 + 400000), false);
assert.equal(verifyStripeWebhook(raw, `t=${t},v1=deadbeef`, secret, 1700000000 * 1000), false);
assert.equal(verifyStripeWebhook(raw, `t=${t},v1=${v1}`, '', 1700000000 * 1000), false);

(async () => {
  const none = await notifyCustomer(order, { env: {} });
  assert.equal(none.emailed, false);
  assert.equal(none.texted, false);
  assert.equal(none.emailSkipped, 'not configured');
  assert.equal(none.smsSkipped, 'not configured');

  let saved = 0;
  const already = { ...order, customerNotifiedAt: '2026-01-01T00:00:00Z', customerNotify: { emailed: true, texted: false } };
  const skip = await notifyCustomer(already, { env: { SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }, transport: { sendMail: async () => { throw new Error('should not send'); } }, save: async () => { saved++; } });
  assert.equal(skip.skipped, 'already sent');
  assert.equal(saved, 0);

  const sent = [];
  const o2 = { ...order, customer: { ...order.customer } };
  const ok = await notifyCustomer(o2, {
    env: { SMTP_HOST: 'h', SMTP_USER: 'shop@example.com', SMTP_PASS: 'p', SITE_URL: DEFAULTS.site },
    transport: { sendMail: async (m) => { sent.push(m); } },
    save: async () => { saved++; }
  });
  assert.equal(ok.emailed, true);
  assert.equal(ok.emailVia, 'smtp');
  assert.equal(ok.texted, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'test@example.com');
  assert.ok(sent[0].text.includes('/#/order/1001/'));
  assert.ok(o2.customerNotifiedAt);
  assert.equal(saved, 1);

  // Provider configured but send fails: must not throw
  const o3 = { id: '1002', token: 'aa'.repeat(12), customer: { email: 'a@b.c', phone: '9135550100' } };
  const fail = await notifyCustomer(o3, {
    env: { SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' },
    transport: { sendMail: async () => { throw new Error('smtp down'); } }
  });
  assert.equal(fail.emailed, false);
  assert.ok(fail.emailError);

  const resendCalls = [];
  const o4 = { id: '1003', token: 'bb'.repeat(12), when: 'Today 1:00pm', customer: { email: 'a@b.c', phone: '9135550199' } };
  const r = await notifyCustomer(o4, {
    env: { RESEND_API_KEY: 're_x', RESEND_FROM: 'Wilson <orders@example.com>', TWILIO_ACCOUNT_SID: 'ACxx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+15551212' },
    fetchFn: async (url, opts) => { resendCalls.push({ url, body: opts.body }); return { ok: true, text: async () => '{}' }; }
  });
  assert.equal(r.emailed, true);
  assert.equal(r.emailVia, 'resend');
  assert.equal(r.texted, true);
  assert.equal(resendCalls.length, 2);
  assert.ok(resendCalls[0].url.includes('resend.com'));
  assert.ok(resendCalls[1].url.includes('twilio.com'));
  const smsBody = new URLSearchParams(resendCalls[1].body).get('Body');
  assert.ok(smsBody.includes('Today 1:00pm'));

  console.log('test_customer_notify ok');
})().catch(e => { console.error(e); process.exit(1); });
