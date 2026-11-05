import sys,json
from playwright.sync_api import sync_playwright
B=sys.argv[1].rstrip('/')+'/'; EM=sys.argv[2]; PW=open(sys.argv[3]).read().strip() if len(sys.argv)>3 else 'testpass123'
TAG=sys.argv[4] if len(sys.argv)>4 else 'local'
SH="/workspace/webdev/shots-wilsons/"+TAG+"-"
M=json.load(open('public/menu.json'))
res=[]
def ok(n,c): res.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n,flush=True)
pz='ex-large-3-topping-pizza-16'; P=M['items'][pz]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome")
    errs=[]
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B); pg.wait_for_selector('.item')
    n=pg.locator('.grid .item').count(); ok(f'menu cards {n} == {len(M["items"])}', n==len(M['items']))
    pg.wait_for_timeout(1500)
    imgs=pg.evaluate("Promise.all([...new Set([...document.querySelectorAll('.ph')].map(e=>getComputedStyle(e).backgroundImage).filter(x=>x.startsWith('url')))].map(u=>new Promise(r=>{const i=new Image();i.onload=()=>r(1);i.onerror=()=>r(0);i.src=u.slice(5,-2)})))")
    ok(f'photos load {sum(imgs)}/{len(imgs)}', len(imgs)>=39 and all(imgs))
    ok('DoorDash link', 'wilson-s-pizza-and-grill-kansas-city-216952' in (pg.get_attribute('[data-testid=dd-hero]','href') or ''))
    body=pg.inner_text('body'); ok('no frozen / em dash', 'frozen' not in body.lower() and '\u2014' not in body)
    ok('no horizontal overflow', pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    pg.screenshot(path=SH+'01-home.png')
    pg.evaluate("document.querySelector('#c-pizza').scrollIntoView()"); pg.wait_for_timeout(800); pg.screenshot(path=SH+'02-pizza-section.png')
    y0=pg.evaluate('scrollY')
    pg.click(f'#c-pizza [data-testid=item-{pz}]'); pg.wait_for_selector('[data-testid=itemmodal]')
    size=[g for g in P['modifiers'] if g['name']=='Pizza Size Choice'][0]
    tops=[g for g in P['modifiers'] if g['name']=='Choose 3 Toppings'][0]
    ok('required blocks add', pg.is_disabled('[data-testid=addtocart]'))
    for i in range(4): pg.click(f'[data-testid=opt-{tops["id"]}-{i}]')
    ok('max 3 toppings enforced', pg.locator(f'input[data-g={tops["id"]}]:checked').count()==3)
    xl=next(i for i,o in enumerate(size['options']) if o['name'].startswith('16'))
    pg.click(f'[data-testid=opt-{size["id"]}-{xl}]')
    pg.screenshot(path=SH+'03-item-options.png')
    exp=P['price']+size['options'][xl]['price']+sum(tops['options'][i]['price'] for i in range(3))
    ok(f'price {exp:.2f}', f'${exp:.2f}' in pg.inner_text('[data-testid=addtocart]'))
    pg.click('[data-testid=addtocart]'); pg.wait_for_timeout(600)
    y1=pg.evaluate('scrollY'); ok(f'no scroll to top after add ({y0}->{y1})', abs(y1-y0)<60 and y1>300)
    pg.click('[data-testid=fab]'); pg.wait_for_selector('[data-testid=checkoutform]')
    pg.fill('[data-testid=co-name]','TEST order (ignore)'); pg.fill('[data-testid=co-phone]','9135550100'); pg.fill('[data-testid=co-email]','test@example.com')
    if pg.locator('[data-testid=co-paystore]').count(): pg.check('[data-testid=co-paystore]')
    pg.screenshot(path=SH+'04-checkout.png',full_page=True)
    pg.click('[data-testid=placeorder]'); pg.wait_for_selector('[data-testid=confirmation]',timeout=30000)
    oid=pg.url.split('/')[-1].split('?')[0]; ok('order placed '+oid, True)
    pg.screenshot(path=SH+'05-confirmation.png',full_page=True)
    pg.goto(B+'owner'); pg.fill('[data-testid=login-email]',EM); pg.fill('[data-testid=login-pass]',PW); pg.click('[data-testid=login-btn]')
    pg.wait_for_selector(f'[data-testid=order-{oid}]',timeout=20000); ok('order in /owner', True)
    pg.screenshot(path=SH+'06-owner.png')
    pg.click(f'[data-testid=order-{oid}]'); pg.wait_for_selector('[data-testid=order-detail]')
    ok('mods on ticket', tops['options'][0]['name'] in pg.inner_text('[data-testid=order-detail]'))
    pg.click('[data-testid=cancel-open]'); pg.fill('[data-testid=cancel-reason]','Test order, ignore'); pg.click('[data-testid=cancel-confirm]'); pg.wait_for_timeout(1500)
    ok('test order canceled', 'cancel' in pg.inner_text('[data-testid=order-detail]').lower())
    pg.screenshot(path=SH+'07-owner-canceled.png')
    ok('no JS errors '+str(errs[:3]), not errs)
print('RESULT', sum(c for _,c in res), '/', len(res))
