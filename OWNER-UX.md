# Owner dashboard UX (Nov 5, 2026)

## Login (/owner)
- Full-screen black background with red/gold glow, logo, "Welcome back" title in Abril Fatface.
- Frosted card: large 16px inputs (no iOS zoom), gold focus ring, Show/Hide password, keep-me-signed-in (30 days), big red "Sign in".
- Same auth as before (OWNER_EMAIL / OWNER_PASSWORD, bcrypt, rate limit). No server changes.

## Unaccepted order re-ping
- While any order is still `new`, the dashboard plays the ka-ching again every 5 seconds, shows a toast
  ("N orders still waiting to be accepted"), vibrates where supported, and pulses the header and new order cards.
- The first time that order appears while the dashboard is open, the ka-ching plays immediately. Orders that
  were already waiting when the page loaded do not all chime at that instant; the 5-second repeat covers them.
- One loop no matter how many new orders. Stops as soon as none are `new` (accepted, canceled, etc.) or on sign-out.
- One-time sound unlock, per browser: tapping **Sign in** plays a ka-ching and unlocks audio when the phone allows it.
  If a gold **Tap to turn on order sounds** banner is still up after login (or after the phone blocks audio again),
  tap that banner once. That is the only extra step. Mute is a separate button; **Sound on** plays a test chime and does not turn sound off.
- The screen stays awake while the dashboard is open when the browser allows a wake lock, so the 5-second timer keeps firing with the tab on screen.
  A locked phone or a tab that is not visible can still delay timers. Leave the owner tab open and the screen on.
  If an iPhone is on silent and you still hear nothing after the tap, turn the ringer on.
- Reduced-motion users get no pulse animation. The chime is synthesized in the browser (no audio file).

## Full dashboard dark theme
- Same black/gold/red look on every tab: header + tab bar (frosted, gold active tab), sound bar, filter chips,
  order cards + status pills, order detail sheet (big red Accept, ghost Cancel/Refund, history), Live now,
  Stats/analytics, Reports (KPIs, red-to-gold bars), Menu (price/sold out/hide), Settings (hours, Stripe, alerts), toasts.
- CSS-only override at the end of owner/owner.css.

## Stripe platform fee
- PLATFORM_FEE_CENTS now defaults to 150 ($1.50) when unset; set it to 0 to turn off.
- Charged as application_fee_amount on Connect direct charges (PaymentIntent and Checkout paths), only when it is below the order total.
- Test mode: set STRIPE_SECRET_KEY=sk_test_..., STRIPE_CLIENT_ID=ca_... (test), STRIPE_PUBLISHABLE_KEY=pk_test_... in Render env. No keys in the repo.
