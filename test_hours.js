const assert = require('assert'); const H = require('./lib/hours');
const hours = Array.from({ length: 7 }, (_, i) => ({ open: '10:00', close: '20:30', closed: i === 0 }));
const at = s => new Date(s); // UTC; KC is UTC-6 in November
assert.strictEqual(H.isOpen(hours, at('2026-11-19T21:30:00Z')), true);   // Thu 3:30pm
assert.strictEqual(H.isOpen(hours, at('2026-11-20T02:31:00Z')), false);  // Thu 8:31pm
assert.strictEqual(H.isOpen(hours, at('2026-11-20T02:29:00Z')), true);   // Thu 8:29pm
assert.strictEqual(H.isOpen(hours, at('2026-11-19T15:59:00Z')), false);  // Thu 9:59am
assert.strictEqual(H.isOpen(hours, at('2026-11-22T18:00:00Z')), false);  // Sun noon
assert.strictEqual(H.nextOpenText(hours, at('2026-11-19T15:00:00Z')), 'today at 10am');
assert.strictEqual(H.nextOpenText(hours, at('2026-11-20T03:00:00Z')), 'tomorrow at 10am');
assert.strictEqual(H.nextOpenText(hours, at('2026-11-22T03:00:00Z')), 'Monday at 10am'); // Sat 9pm
assert.ok(H.closedMessage(hours, at('2026-11-22T18:00:00Z')).includes('tomorrow at 10am')); // Sun -> Mon
console.log('hours ok');
