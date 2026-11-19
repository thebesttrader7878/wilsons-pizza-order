# Wilson's Pizza & Grill, online ordering

Express app: storefront, pickup ordering, owner dashboard at /owner (orders, reports with date picker, analytics, Live now, ka-ching sound, keep me signed in), optional Stripe Connect with a $1.50 platform fee.

Run locally: `npm install && npm start`, then open http://localhost:3000

## Env vars (Render)
- OWNER_EMAIL, OWNER_PASSWORD: owner dashboard login
- SITE_URL: public URL of the site
- ORDER_WEBHOOK_URL: Formspree form URL for order emails (empty for now; orders still save to the dashboard)
- STRIPE_SECRET_KEY, STRIPE_CLIENT_ID, STRIPE_PUBLISHABLE_KEY, STRIPE_ACCOUNT_ID, PLATFORM_FEE_CENTS: optional Connect keys (test or live). PLATFORM_FEE_CENTS defaults to 150 ($1.50). STRIPE_ACCOUNT_ID is a fallback payout account so test orders keep working until the owner connects their own shop in /owner. Connecting or disconnecting in the dashboard replaces that fallback.

Menu: public/menu.json, pulled from DoorDash store 216952 (pickup prices, options and photos).

## Customer order updates

After a paid order, the site emails and/or texts the customer a private tracking link (`/#/order/{id}/{token}`). Sending is skipped (and checkout still works) until a provider is configured.

Email (pick one):
- Gmail SMTP (simplest if you already have the shop Gmail): `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (an app password)
- Resend: `RESEND_API_KEY`, `RESEND_FROM` (must be a verified domain, for example `Wilson's Pizza & Grill <orders@yourdomain.com>`)

SMS (optional): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. US texting requires A2P 10DLC or a verified toll-free number.

Stripe webhook (optional, so the order is saved even if the customer never returns to the site): add an endpoint `https://wilsons-pizza-grill.onrender.com/api/stripe/webhook` for `checkout.session.completed` (include events from connected accounts) and set `STRIPE_WEBHOOK_SECRET`.
