// Store hours in Kansas City time. hours[0] is Sunday.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const kcNow = (date = new Date(), tz = 'America/Chicago') => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  return { day: SHORT.indexOf(p.weekday), t: p.hour + ':' + p.minute };
};
const isOpen = (hours, date) => { const k = kcNow(date), h = Array.isArray(hours) && hours[k.day]; if (!h || h.closed) return false; return k.t >= h.open && k.t < h.close; };
const fmtT = t => { let [h, mm] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (mm ? ':' + String(mm).padStart(2, '0') : '') + ap; };
// "today at 10am", "tomorrow at 10am" or "Monday at 10am"; '' if never open.
const nextOpenText = (hours, date) => { if (!Array.isArray(hours)) return ''; const k = kcNow(date);
  for (let i = 0; i < 8; i++) { const d = (k.day + i) % 7, h = hours[d]; if (!h || h.closed) continue; if (i === 0 && k.t >= h.open) continue;
    return (i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAY_NAMES[d]) + ' at ' + fmtT(h.open); }
  return ''; };
const closedMessage = (hours, date) => { const n = nextOpenText(hours, date); return "We're closed right now, so online ordering is paused." + (n ? ' Orders open ' + n + '.' : ''); };
module.exports = { kcNow, isOpen, nextOpenText, closedMessage, DAY_NAMES };
