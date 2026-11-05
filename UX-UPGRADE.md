# Wilson's ordering site — UX upgrade (READY TO DEPLOY)

Authorized PUSH LIVE by Seven (t369u / t370u).

## Done locally
- Phone UX: scroll-spy, one-tap quick-add, cart drawer, sticky search, larger +, preselect required singles
- Take & Bake category from wilsons-pizza-and-grill.net (cold and fresh — never "frozen")
- Prices: singles $14.99 / 3-packs $45.99 / 5-packs $74.99; BYO 5-Pack totals $74.99 ($45.99 + $29)
- Carryout order-ahead hero/CTA; card-only checkout (no pay-at-pickup)
- 31 takebake photos under `public/img/takebake/`

## Deploy
- Tarball: `/workspace/webdev/wilsons-order-ux-deploy.tgz`
- Handoff: `/workspace/webdev/WILSONS-DEPLOY-HANDOFF.md`
- Target Render: `wilsons-pizza-grill` → https://wilsons-pizza-grill.onrender.com (srv-dbij53h42hec73akqbe0)
- Repo: https://github.com/thebesttrader7878/wilsons-pizza-order (autoDeploy on main commit)
- Preserve existing Render env vars

Executor cannot LaunchCloudAgent; parent must push via CloudAgent + tarball then verify live.

## Customer social proof (Nov 5)
- 6 real TikTok clips from wilsonspizzaandgrill.net (Shopify CDN mp4 + posters; @wilsonpizza)
- Horizontal snap carousel after proof strip / before catnav; lazy play-on-view
- Hero polish: "Made for the creek" + See the hype CTA
- Tarball: `/workspace/webdev/wilsons-order-ux-deploy.tgz`
- Screenshots: `/workspace/webdev/wilsons-customer-shots/`

## Hero mosaic mobile fix (Nov 5)
- Replaced cramped 4-col grid (negative margin + hero overflow:hidden clipped tiles on iPhone Safari)
- Mobile: horizontal snap carousel of full 1:1 cards; desktop keeps mosaic grid
- Safe-area padding on wrap/hero; trailing pad + edge fade so scroll affordance is clear
