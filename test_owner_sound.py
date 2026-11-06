# Owner-dashboard ka-ching: immediate chime when a new order appears, then again
# every few seconds until Accept. __PING_MS / __POLL_MS shorten the waits.
import json, secrets, sys, urllib.request
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
EMAIL = 'owner@example.com'
PASSWORD = 'testpass123'
ITEM = '2-meats-2-sides'

def post_order(n):
    pid = 'pi_demo_' + secrets.token_hex(4) + '%02d' % n
    body = json.dumps({
        'customer': {'name': 'Sound Test', 'phone': '9135550199', 'email': 'sound@example.com'},
        'items': [{'id': ITEM, 'qty': 1}],
        'payment': {'method': 'card', 'id': pid, 'last4': '4242'},
        'when': 'asap',
    }).encode()
    req = urllib.request.Request(BASE + '/api/orders', data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)['id']

def snap(page):
    return page.evaluate('''() => ({
      chimes: window.__chimes || 0, played: window.__played || 0, repings: window.__repings || 0,
      arrived: window.__arrived || 0, atArrival: window.__repingsAtArrival,
      state: window.__actx ? window.__actx.state : 'none',
      prompt: !!document.querySelector('[data-testid=sound-prompt]'),
      urgent: document.body.classList.contains('urgent')
    })''')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/local/bin/google-chrome', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page.add_init_script('window.__PING_MS = 700; window.__POLL_MS = 250;')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Order already waiting when the dashboard opens: no arrival chime, repeat still starts.
    pre = post_order(1)
    page.goto(BASE + '/owner', wait_until='domcontentloaded')
    page.fill('[data-testid=login-email]', EMAIL)
    page.fill('[data-testid=login-pass]', PASSWORD)
    page.click('[data-testid=login-btn]')
    page.wait_for_selector('[data-testid=order-%s]' % pre, timeout=15000)
    page.wait_for_timeout(250)
    if page.locator('[data-testid=sound-prompt]').count():
        page.click('[data-testid=sound-prompt]')
        page.wait_for_timeout(300)
    early = snap(page)
    assert not early['arrived'], early
    page.wait_for_function('() => (window.__repings || 0) >= 1', timeout=4000)
    mid = snap(page)
    assert mid['repings'] >= 1 and not mid['arrived'], mid
    assert mid['state'] == 'running' and mid['played'] >= 1, mid
    # Accept stops the repeat.
    page.click('[data-testid=order-%s]' % pre)
    page.wait_for_selector('[data-testid=next-status]')
    page.click('[data-testid=next-status]')
    page.wait_for_function("() => (document.querySelector('[data-testid=detail-status]') || {}).textContent === 'Making'", timeout=10000)
    page.wait_for_timeout(400)
    stopped = snap(page)
    page.wait_for_timeout(2200)
    still = snap(page)
    assert still['repings'] == stopped['repings'] and not still['urgent'], (stopped, still)
    page.click('[data-testid=order-detail] .x')
    # A new order while the dashboard is open chimes immediately, then repeats.
    before = snap(page)
    fresh = post_order(2)
    page.wait_for_function('() => (window.__arrived || 0) >= 1', timeout=5000)
    page.wait_for_selector('[data-testid=order-%s]' % fresh, timeout=5000)
    arrival = snap(page)
    assert arrival['arrived'] == 1, arrival
    assert arrival['repings'] == arrival['atArrival'], arrival
    assert arrival['chimes'] >= before['chimes'] + 1, (before, arrival)
    assert arrival['played'] >= before['played'] + 1, (before, arrival)
    page.wait_for_function('repings => (window.__repings || 0) >= repings + 1', arg=arrival['repings'], timeout=4000)
    again = snap(page)
    assert again['played'] >= arrival['played'] + 1, (arrival, again)
    # Second repeat proves it keeps going (one loop, not one per order).
    page.wait_for_function('repings => (window.__repings || 0) >= repings + 1', arg=again['repings'], timeout=4000)
    # Mute is explicit, and the banner is the way back on.
    played_before_mute = snap(page)['played']
    page.click('[data-testid=sound-mute]')
    page.wait_for_selector('[data-testid=sound-prompt]')
    assert 'off' in page.inner_text('[data-testid=sound-prompt]').lower()
    muted = post_order(3)
    page.wait_for_function('() => (window.__arrived || 0) >= 2', timeout=5000)
    page.wait_for_timeout(400)
    assert snap(page)['played'] == played_before_mute
    page.click('[data-testid=sound-prompt]')
    page.wait_for_function('played => (window.__played || 0) > played', arg=played_before_mute, timeout=3000)
    assert page.locator('[data-testid=sound-prompt]').count() == 0 or snap(page)['state'] == 'running'
    # Synthesized ka-ching is not silent.
    energy = page.evaluate('''async () => {
      const ac = new OfflineAudioContext(1, 44100 * 2, 44100);
      window.CTQ_KACHING(ac, 0.05);
      const buf = await ac.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); sum += a; if (a > peak) peak = a; }
      return { peak, avg: sum / d.length };
    }''')
    assert energy['peak'] > 0.2 and energy['avg'] > 0.01, energy
    assert not errors, errors
    print('PASS owner sound', json.dumps({'pre': pre, 'fresh': fresh, 'muted': muted, 'energy': energy, 'arrival': arrival}))
    browser.close()
