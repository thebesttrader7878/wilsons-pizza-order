# Wilson's Pizza & Grill, online ordering

Express app: storefront, pickup ordering, owner dashboard at /owner (orders, reports with date picker, analytics, Live now, ka-ching sound, keep me signed in), optional Stripe Connect with a $1.50 platform fee.

Run locally: `npm install && npm start`, then open http://localhost:3000

## Env vars (Render)
- OWNER_EMAIL, OWNER_PASSWORD: owner dashboard login
- SITE_URL: public URL of the site
- ORDER_WEBHOOK_URL: Formspree form URL for order emails (empty for now; orders still save to the dashboard)
- STRIPE_SECRET_KEY, STRIPE_CLIENT_ID, STRIPE_PUBLISHABLE_KEY, STRIPE_ACCOUNT_ID, PLATFORM_FEE_CENTS: optional Connect keys (test or live). PLATFORM_FEE_CENTS defaults to 150 ($1.50). STRIPE_ACCOUNT_ID is a fallback payout account so test orders keep working until the owner connects their own shop in /owner. Connecting or disconnecting in the dashboard replaces that fallback.

Menu: public/menu.json, pulled from DoorDash store 216952 (pickup prices, options and photos).

## Customer order email

After an order is saved, the customer gets an email with their order number, items, total, pickup info and a link to their order page (`/#/order/{id}?t={token}`, works on any device). It goes out through Resend's HTTPS API only, never SMTP, and runs in the background so checkout never waits on it (8s timeout, errors are just logged). One email per order.

- `RESEND_API_KEY`: turns it on. Without it, no customer email is sent and checkout works as normal.
- `CUSTOMER_EMAIL_FROM`: sender, default `Wilson's Pizza & Grill <orders@wilsonspizzaandgrill.net>`. The domain has to be verified in Resend.
- `CUSTOMER_EMAIL_REPLY_TO`: optional, default `wilsonspizzaandgrill@gmail.com`.
- `RESEND_API_BASE`: testing only, points the sender at a mock server.

`/healthz` shows `customerEmail: "resend"` when it is on, `false` when off. The owner Formspree alert (`ORDER_WEBHOOK_URL`) is unchanged.
