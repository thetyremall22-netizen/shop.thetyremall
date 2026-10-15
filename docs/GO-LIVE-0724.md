# Go-Live Checklist — The Tyre Mall custom site on 0724

Deploy the Next.js custom build to the **0724 (DirectAdmin) server**, standalone.
WordPress/WooCommerce stays on its current (xneelo) server and is **not** needed
for launch — the custom site owns its catalogue, orders, admin and emails.

> **Launch mode = standalone.** Orders go to the site's own database, emails are
> sent by the site, and the catalogue runs from the committed snapshot. The live
> WooCommerce sync, coupons, staff roles and customer accounts are **post-launch**
> builds (see the bottom of this file).

---

## 0. Prerequisites
- [ ] **Node.js enabled** on the 0724 account (Node.js Selector / Passenger) — Node **20** (or ≥18.18). *(0724 said they'd enable it.)*
- [ ] Access to the 0724 DirectAdmin + SSH/Git (for deploy) and to DNS for `thetyremall.co.za`.

## 1. Get the code onto the server
- [ ] Clone the repo on the server (or upload a build):
  ```bash
  git clone https://github.com/thetyremall22-netizen/shop.thetyremall.git
  cd shop.thetyremall
  npm ci
  ```
- [ ] Next.js on DirectAdmin runs under **Passenger**. We'll set `output: "standalone"`
  in `next.config.ts` and point the Node.js App's **startup file** at the standalone
  `server.js` (or run `npm start`). *(Ping me when the Node.js Selector screen is up and
  I'll give the exact entry/startup settings — it's a 2-line config.)*
- [ ] Build:
  ```bash
  npm run build
  ```

## 2. Environment variables (set in the Node.js App's "Environment variables")
Generate the secrets **on the server** so they never go through chat:
```bash
# strong admin password
echo "TyreMall-$(openssl rand -base64 9 | tr -d '/+=')"
# 64-char session secret
openssl rand -hex 32
# cron secret
openssl rand -hex 24
```
Then set:
```
NEXT_PUBLIC_SITE_URL = https://thetyremall.co.za
SITE_URL             = https://thetyremall.co.za
NODE_ENV             = production

# --- admin (set FRESH values from the commands above — never reuse chat values) ---
ADMIN_PASSWORD       = <strong password you just generated>
SESSION_SECRET       = <64-char hex you just generated>
CRON_SECRET          = <hex you just generated>

# --- database (file persists on 0724; no Turso needed) ---
DATABASE_URL         = file:.data/ttm.db

# --- PayFast (SANDBOX first) ---
PAYFAST_SANDBOX      = true
PAYFAST_MERCHANT_ID  = 10004002
PAYFAST_MERCHANT_KEY = q1cd2rdny4a53
PAYFAST_PASSPHRASE   = payfast

# --- email (see step 5; fill whichever method works from 0724) ---
MAIL_FROM            = The Tyre Mall <shop@thetyremall.co.za>
SHOP_EMAIL           = shop@thetyremall.co.za
EMAIL_CC             = tracy@iheartdigital.co.za
#   Option A: server/M365 SMTP (try first from 0724)
SMTP_HOST            = smtp.office365.com
SMTP_PORT            = 587
SMTP_SECURE          = false
SMTP_USER            = shop@thetyremall.co.za
SMTP_PASS            = <the mailbox app password>
#   Option B (fallback if SMTP is blocked): RESEND_API_KEY = re_...

# WOO_* keys are NOT set for launch (standalone). Add them later for the live sync.
```

## 3. Database seed (so the admin drives the live catalogue)
- [ ] One-time seed of the SQLite DB from the committed snapshot, so admin edits go live.
  *(I'll provide the exact seed command/route — it reads `src/data/products.json` into the DB.)*
- [ ] Confirm `.data/` is writable and on persistent disk.

## 4. DNS + SSL
- [ ] Point `thetyremall.co.za` (A record) at the **0724 server IP** (`169.239.182.48`).
  - If WordPress must stay reachable for admin during wind-down, give it a subdomain
    (e.g. `wp.thetyremall.co.za`) on xneelo with its own free Let's Encrypt cert.
- [ ] In DirectAdmin → **SSL/TLS Certificates → Manage certificates**, issue the free
  **Let's Encrypt** cert for `thetyremall.co.za` (works once DNS resolves to 0724).
- [ ] Confirm `https://thetyremall.co.za` loads over HTTPS with a valid padlock.

## 5. Email — one test
- [ ] Hit the test endpoint (standalone sends from the 0724 server):
  ```
  https://thetyremall.co.za/api/test-email?key=<CRON_SECRET>
  ```
  - `{"ok":true,...}` → email works (M365 SMTP from 0724). ✅
  - `{"ok":false,"configured":true,"error":"...535..."}` → M365 blocked → set
    `RESEND_API_KEY` (Resend) and re-test.
  - `{"ok":false,"configured":false}` → no email configured → set SMTP or Resend.

## 6. PayFast + checkout smoke test (sandbox)
- [ ] In the **PayFast dashboard**, set the notify/return URLs to the live domain
  (the app builds `https://thetyremall.co.za/api/payfast/notify` from `NEXT_PUBLIC_SITE_URL`).
- [ ] Place **one sandbox order** end-to-end:
  - [ ] Order appears in **`/admin` → Orders** with status **processing**.
  - [ ] Stock decremented.
  - [ ] Confirmation **email arrives**.
- [ ] If all good → set `PAYFAST_SANDBOX=false` and the **live** PayFast credentials.

## 7. Admin
- [ ] Log in at `https://thetyremall.co.za/admin` with the `ADMIN_PASSWORD` set in step 2.
- [ ] Verify Orders / Products / Leads load.
- [ ] (Reminder) the insecure code defaults are removed — login is disabled unless
  `ADMIN_PASSWORD` is set, and `SESSION_SECRET` must be set or logins won't persist.

## 8. Go live
- [ ] Final check: homepage, shop listings, product page, vehicle search, Tyrone, cart,
  checkout → PayFast → order + email. All on HTTPS.
- [ ] Monitor the first few real orders.

---

## Post-launch (separate builds, agreed)
1. **Staff RBAC** — users table, username + password login, roles **Super Admin / Manager /
   Editor** (+ disabled), **forgot password** (email reset), Users admin screen.
2. **Customer accounts** — register/login, order history, saved addresses, forgot password;
   guest checkout / create-at-checkout / login-to-buy. **No card storage** (PayFast handles
   payments; optional saved-card via PayFast's vault).
3. **Live WooCommerce sync** (optional, during the WP wind-down) — scheduled `syncFromWoo`
   pulling product/price/stock changes into the site DB, with images downloaded locally.
   Requires WordPress on an **HTTPS** hostname + the `WOO_*` keys.
4. **Coupons** — WooCommerce (or native) coupons applied at checkout.
5. **"Email sent" log** on the order detail for staff visibility.
