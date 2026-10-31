# Wilson's Pizza & Grill, online ordering

Express app: storefront, pickup ordering, owner dashboard at /owner (orders, reports with date picker, analytics, Live now, ka-ching sound, keep me signed in), optional Stripe Connect with a $1.50 platform fee.

Run locally: `npm install && npm start`, then open http://localhost:3000

## Env vars (Render)
- OWNER_EMAIL, OWNER_PASSWORD: owner dashboard login
- SITE_URL: public URL of the site
- ORDER_WEBHOOK_URL: Formspree form URL for order emails (empty for now; orders still save to the dashboard)
- STRIPE_SECRET_KEY, STRIPE_CLIENT_ID, STRIPE_ACCOUNT_ID, PLATFORM_FEE_CENTS: optional; without them customers pay at pickup

Menu: public/menu.json, pulled from DoorDash store 216952 (pickup prices, options and photos).
