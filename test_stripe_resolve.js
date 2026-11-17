const assert = require('assert');
const { resolveStripe } = require('./server.js');

const envId = 'acct_1UYp2UAYHy8yBJIX';
const live = { live: true, accountId: envId };

assert.deepStrictEqual(
  resolveStripe({ status: 'none' }, live),
  { status: 'connected', id: envId, demo: false, fromEnv: true },
  'falls back to STRIPE_ACCOUNT_ID when nothing is stored'
);

assert.deepStrictEqual(
  resolveStripe({ status: 'none', disconnected: true }, live),
  { status: 'none', disconnected: true },
  'explicit disconnect does not snap back to the env account'
);

const owner = { status: 'connected', id: 'acct_owner123', demo: false, at: '2026-11-17T00:00:00.000Z' };
assert.deepStrictEqual(resolveStripe(owner, live), owner, 'owner OAuth account wins over the env fallback');

assert.deepStrictEqual(
  resolveStripe({ status: 'none' }, { live: false, accountId: envId }),
  { status: 'none' },
  'no env fallback when Stripe keys are missing'
);

assert.equal(resolveStripe({ status: 'none' }, { live: true, accountId: 'not-an-account' }).status, 'none');

console.log('ok');
process.exit(0);
