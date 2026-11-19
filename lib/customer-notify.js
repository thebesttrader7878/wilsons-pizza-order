// Customer order-status email/SMS. Providers are optional; missing keys must not break checkout.
const crypto = require('crypto');

const DEFAULTS = {
  name: "Wilson's Pizza & Grill",
  address: '1801 Quindaro Blvd, Kansas City, KS 66104',
  phone: '(913) 621-4066',
  site: 'https://wilsons-pizza-grill.onrender.com'
};

const orderStatusUrl = (site, id, token) => String(site || DEFAULTS.site).replace(/\/$/, '') + '/#/order/' + encodeURIComponent(id) + '/' + encodeURIComponent(token);

const pickupLine = (o, address) => {
  const when = !o.when || o.when === 'asap' ? 'ASAP' : String(o.when);
  return 'Pickup at ' + address + ', ' + when + '.';
};

function buildCustomerEmail(o, cfg = {}) {
  const name = cfg.name || DEFAULTS.name;
  const address = cfg.address || DEFAULTS.address;
  const phone = cfg.phone || DEFAULTS.phone;
  const site = cfg.site || DEFAULTS.site;
  const link = orderStatusUrl(site, o.id, o.token);
  const text = [
    'Thanks for your order!',
    '',
    'Order #' + o.id + ' is in.',
    pickupLine(o, address),
    '',
    'Track it here (this page updates live):',
    link,
    '',
    'Questions? Call ' + phone,
    '',
    name
  ].join('\n');
  const fromAddr = cfg.fromAddress || 'orders@wilsons-demo.local';
  return {
    to: String((o.customer && o.customer.email) || ''),
    from: fromAddr.includes('<') ? fromAddr : '"' + name.replace(/"/g, '') + '" <' + fromAddr + '>',
    subject: name + ': Order #' + o.id + ' is in',
    text
  };
}

function buildCustomerSms(o, cfg = {}) {
  const name = cfg.name || DEFAULTS.name;
  const address = cfg.address || DEFAULTS.address;
  const site = cfg.site || DEFAULTS.site;
  const link = orderStatusUrl(site, o.id, o.token);
  return name + ': Order #' + o.id + ' is in! ' + pickupLine(o, address) + ' Track it here: ' + link;
}

function toE164(phone) {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  if (raw.startsWith('+') && d.length >= 10 && d.length <= 15) return '+' + d;
  return '';
}

function parseStripeSignature(header) {
  const out = { t: '', v1: [] };
  String(header || '').split(',').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') out.t = v;
    if (k === 'v1') out.v1.push(v);
  });
  return out;
}

function verifyStripeWebhook(raw, header, secret, nowMs = Date.now()) {
  if (!secret || !header) return false;
  const { t, v1 } = parseStripeSignature(header);
  if (!t || !v1.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > 300) return false;
  const payload = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
  const expected = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(t + '.', 'utf8'), payload])).digest('hex');
  const expBuf = Buffer.from(expected, 'utf8');
  return v1.some(sig => {
    const got = Buffer.from(sig, 'utf8');
    return got.length === expBuf.length && crypto.timingSafeEqual(got, expBuf);
  });
}

function providerFlags(env = process.env) {
  const smtp = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const resend = !!(env.RESEND_API_KEY && env.RESEND_FROM);
  const twilio = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  return {
    email: resend ? 'resend' : (smtp ? 'smtp' : false),
    sms: twilio ? 'twilio' : false
  };
}

async function sendViaResend(mail, env, fetchFn = fetch) {
  const r = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mail.from, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(12000)
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error('Resend ' + r.status + (body ? ': ' + body.slice(0, 180) : ''));
  }
}

async function sendViaTwilio(to, body, env, fetchFn = fetch) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(sid + ':' + env.TWILIO_AUTH_TOKEN).toString('base64');
  const r = await fetchFn('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }).toString(),
    signal: AbortSignal.timeout(12000)
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Twilio ' + r.status + (t ? ': ' + t.slice(0, 180) : ''));
  }
}

// Send at most once per order. Never throws to the caller.
async function notifyCustomer(o, { env = process.env, transport = null, fetchFn = fetch, save, cfg = {} } = {}) {
  const result = { emailed: false, texted: false };
  try {
    if (!o || !o.id || !o.token) return Object.assign(result, { skipped: 'no order' });
    if (o.customerNotifiedAt && (o.customerNotify && (o.customerNotify.emailed || o.customerNotify.texted))) {
      return Object.assign(result, o.customerNotify, { skipped: 'already sent' });
    }
    const flags = providerFlags(env);
    const emailTo = String((o.customer && o.customer.email) || '').trim();
    const smsTo = toE164(o.customer && o.customer.phone);
    const site = cfg.site || env.SITE_URL || DEFAULTS.site;
    const fromAddress = env.RESEND_FROM || env.CUSTOMER_EMAIL_FROM || env.SMTP_USER || 'orders@wilsons-demo.local';
    const mailCfg = Object.assign({}, DEFAULTS, cfg, { site, fromAddress });

    if (flags.email && emailTo) {
      try {
        const mail = buildCustomerEmail(o, mailCfg);
        mail.to = emailTo;
        if (flags.email === 'resend') await sendViaResend(mail, env, fetchFn);
        else if (transport) await transport.sendMail(mail);
        else throw new Error('SMTP transport missing');
        result.emailed = true;
        result.emailVia = flags.email;
      } catch (e) {
        result.emailError = e.message;
        console.error('[customer email] order', o.id, e.message);
      }
    } else if (!flags.email) {
      result.emailSkipped = 'not configured';
    } else {
      result.emailSkipped = 'no customer email';
    }

    if (flags.sms && smsTo) {
      try {
        await sendViaTwilio(smsTo, buildCustomerSms(o, mailCfg), env, fetchFn);
        result.texted = true;
      } catch (e) {
        result.smsError = e.message;
        console.error('[customer sms] order', o.id, e.message);
      }
    } else if (!flags.sms) {
      result.smsSkipped = 'not configured';
    } else {
      result.smsSkipped = 'no customer phone';
    }

    if (result.emailed || result.texted) {
      o.customerNotifiedAt = new Date().toISOString();
      o.customerNotify = { emailed: result.emailed, texted: result.texted, at: o.customerNotifiedAt };
      if (typeof save === 'function') await save(o);
    } else if (!flags.email && !flags.sms) {
      console.log('[customer notify] no email/SMS provider configured, skipped order', o.id);
    }
  } catch (e) {
    console.error('[customer notify] order', o && o.id, e.message);
    result.error = e.message;
  }
  return result;
}

module.exports = {
  DEFAULTS, orderStatusUrl, pickupLine, buildCustomerEmail, buildCustomerSms,
  toE164, parseStripeSignature, verifyStripeWebhook, providerFlags, notifyCustomer
};
