# Go-Live Checklist — The Tyre Mall custom site on 0724

Deploy the Next.js custom build to the **0724 (DirectAdmin) server**, standalone.
WordPress/WooCommerce stays on its current server and is **not** needed for launch —
the custom site owns its catalogue, orders, admin, payments and emails.

**Decisions locked in:**
- **Database:** fresh **file DB on the server** (`file:.data/ttm.db`) — clean slate.
- **Admin backend is fully built** (products, orders, emails, leads, content, media,
  reviews, theme, wording, coupons, payments, settings, staff roles, maintenance mode).
- **Payments:** PayFast + HappyPay (both live-tested). Mobicred hidden for now.
- The domain **transfer into 0724 is still pending**, so this splits into Phase A
  (do now) and Phase B (at cutover). DNS details: see `DNS-CUTOVER-0724.md`.

> ⚠️ **The file DB holds your live orders.** It must live on persistent, writable
> disk, be **backed up** (e.g. a daily `cp .data/ttm.db` to a safe folder), and you
> must deploy by **`git pull` in place** — never re-clone over `.data/` or you'll
> wipe orders.
>
> **The whole website is in the repo** — design, all content/copy, theme colours,
> wording, the product catalogue (auto-seeds from the snapshot) **and every image**
> (product photos, banners, logos, promo art in `public/`) all ship with the code and
> render on a fresh DB with nothing to rebuild or re-upload. A fresh DB only starts
> empty for **admin-entered data**: payment credentials, coupons, staff logins,
> anything added later via the **Media library tab** (a separate tool — not the site's
> existing imagery), and any admin *edits that override* a built-in default.
>
> **Note on MariaDB:** this app uses **SQLite** (`file:.data/ttm.db`), not MySQL/
> MariaDB. Any MariaDB on the 0724 account is **not used** by this app and can be
> ignored.

---

## PHASE A — do now (before the transfer; nothing customer-facing changes)

### A0. Prerequisites
- [ ] **Node.js 20** enabled on the 0724 account (Node.js Selector / Passenger).
- [ ] DirectAdmin + SSH/Git access, and a **temp URL** to test on (server IP or a
      temporary subdomain) while the real domain is still elsewhere.

### A1. Code onto the server
```bash
git clone https://github.com/thetyremall22-netizen/shop.thetyremall.git
cd shop.thetyremall
npm ci
```
- [ ] Add `output: "standalone"` to `next.config.ts` (ping me — 1 line) so Passenger
      can run the self-contained `server.js`.
- [ ] `npm run build`
- [ ] Point the Node.js App's **startup file** at the standalone server (exact entry
      when the Node.js Selector screen is up).

### A2. Environment variables (in the Node.js App's "Environment variables")
Generate secrets **on the server** (never through chat):
```bash
echo "TyreMall-$(openssl rand -base64 9 | tr -d '/+=')"   # admin password
openssl rand -hex 32                                      # SESSION_SECRET (64 hex)
openssl rand -hex 24                                      # CRON_SECRET
```
```
NEXT_PUBLIC_SITE_URL = https://thetyremall.co.za
NODE_ENV             = production
ADMIN_PASSWORD       = <generated>
SESSION_SECRET       = <generated>      # encrypts payment creds + signs admin logins; keep STABLE
CRON_SECRET          = <generated>
DATABASE_URL         = file:.data/ttm.db

# PayFast — SANDBOX first (switch to live in Phase B)
PAYFAST_SANDBOX      = true
# (sandbox creds can be set here OR entered in Admin → Payments)

# Email — set in Phase B once the domain/MX is settled (see A-note below)
MAIL_FROM            = The Tyre Mall <shop@thetyremall.co.za>
SHOP_EMAIL           = shop@thetyremall.co.za
```
*SESSION_SECRET is generated fresh here (fine — we are not sharing the Vercel DB).*

### A3. First run + admin
- [ ] Confirm `.data/` is writable on persistent disk.
- [ ] Load the temp URL → storefront renders, catalogue auto-seeded from the snapshot.
- [ ] Log in at `<temp-url>/admin` with `ADMIN_PASSWORD` (break-glass owner).
- [ ] In Admin, enter **Payments** creds (PayFast + HappyPay, sandbox) and set the
      **store timezone**. (Content/theme/images already ship with the code — only
      add coupons/staff/new media if you want them.)

### A4. Turn ON maintenance mode
- [ ] Admin → **Settings → Maintenance / Coming-soon mode → On → Save.**
      So the instant DNS flips in Phase B, the public sees the "coming soon" page —
      not a half-ready store. (You, logged in, still see the real site to finish setup.)

### A5. Smoke test on the temp URL
- [ ] Place **one sandbox PayFast order** end-to-end → appears in **Orders** (processing),
      stock decrements.
- [ ] Test HappyPay redirect from checkout.
- [ ] `<temp-url>/api/test-email?key=<CRON_SECRET>` — see email note below.

---

## PHASE B — at cutover (once the transfer into 0724 is accepted)

### B1. DNS (⚠️ preserve Microsoft 365 email — see DNS-CUTOVER-0724.md)
- [ ] Build the new zone with **all M365 records preserved** (MX → Outlook, SPF,
      autodiscover, Intune) + website A record → 0724 server IP.
- [ ] Lower TTLs a day ahead; switch nameservers; verify `dig MX` still → Outlook and a
      test email **to** shop@ still arrives.

### B2. SSL
- [ ] DirectAdmin → SSL/TLS → issue **Let's Encrypt** for `thetyremall.co.za` + `www`.
- [ ] Confirm `https://thetyremall.co.za` loads with a valid padlock.

### B3. Email (pick whichever works from 0724)
- **Option A — M365 SMTP (simplest, no domain verification):** enable **Authenticated
  SMTP** on the shop@ mailbox in M365, create an app password, set `SMTP_HOST=
  smtp.office365.com`, `SMTP_PORT=587`, `SMTP_USER=shop@thetyremall.co.za`,
  `SMTP_PASS=<app password>`. Confirm 0724 allows outbound TCP 587.
- **Option B — Resend:** add the Resend DNS records (DKIM TXT + rsend/send CNAMEs) and
  verify the domain in resend.com, then set `RESEND_API_KEY`. (See DNS-CUTOVER doc.)
- [ ] `https://thetyremall.co.za/api/test-email?key=<CRON_SECRET>` → `{"ok":true}`.

### B4. PayFast + HappyPay live
- [ ] Admin → Payments → switch PayFast to **Live** + enter **live** merchant creds;
      set the PayFast dashboard notify/return URLs to the live domain.
- [ ] Enter **live HappyPay** creds (or keep disabled until ready).

### B5. Final checks → open
- [ ] Homepage, shop, product page, vehicle search, Tyrone, cart, checkout → PayFast
      → order + confirmation email. All on HTTPS.
- [ ] **Rotate** any credentials shared in chat (PayFast passphrase, HappyPay API key,
      Resend key) and update them in Admin → Payments / env.
- [ ] Admin → Settings → **Maintenance mode → Off → Save.** 🎉
- [ ] Monitor the first few real orders + that their emails send.

---

## Already built this session (no longer "post-launch")
Staff RBAC + forgot-password + brute-force protection · coupons (%/fixed, limits,
timezone-correct dates) · media library (size-capped) · editable content/theme/wording ·
refunds · email logging & filters · HappyPay · maintenance toggle.

## Still optional / later
Customer accounts (register/login/order history) · live WooCommerce sync during WP
wind-down · WooCommerce orders CSV import · multi-step abandoned-cart automation.
