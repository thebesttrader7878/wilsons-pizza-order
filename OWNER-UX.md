# Owner dashboard UX (Nov 5, 2026)

## Login (/owner)
- Full-screen black background with red/gold glow, logo, "Welcome back" title in Abril Fatface.
- Frosted card: large 16px inputs (no iOS zoom), gold focus ring, Show/Hide password, keep-me-signed-in (30 days), big red "Sign in".
- Same auth as before (OWNER_EMAIL / OWNER_PASSWORD, bcrypt, rate limit). No server changes.

## Unaccepted order re-ping
- While any order is still `new`, the dashboard plays the ka-ching again every 60s, shows a toast
  ("N orders still waiting to be accepted"), vibrates where supported, and pulses the header and new order cards.
- One loop no matter how many new orders. Stops as soon as none are `new` (accepted, canceled, etc.) or on sign-out.
- Uses the existing sound toggle and iOS one-tap unlock. Reduced-motion users get no pulse animation.
- Note: browsers may pause timers in a backgrounded tab or a locked phone; keep the dashboard open on screen.

## Full dashboard dark theme
- Same black/gold/red look on every tab: header + tab bar (frosted, gold active tab), sound bar, filter chips,
  order cards + status pills, order detail sheet (big red Accept, ghost Cancel/Refund, history), Live now,
  Stats/analytics, Reports (KPIs, red-to-gold bars), Menu (price/sold out/hide), Settings (hours, Stripe, alerts), toasts.
- CSS-only override at the end of owner/owner.css.

## Stripe platform fee
- PLATFORM_FEE_CENTS now defaults to 150 ($1.50) when unset; set it to 0 to turn off.
- Charged as application_fee_amount on Connect direct charges (PaymentIntent and Checkout paths), only when it is below the order total.
- Test mode: set STRIPE_SECRET_KEY=sk_test_..., STRIPE_CLIENT_ID=ca_... (test), STRIPE_PUBLISHABLE_KEY=pk_test_... in Render env. No keys in the repo.
