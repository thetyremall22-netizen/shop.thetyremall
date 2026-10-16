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

**No SSH on 0724** → we do **not** build on the server. A GitHub Action builds the
app on Linux (so the native SQLite binding matches the server) and **FTP-uploads**
the finished standalone bundle. You only use the DirectAdmin web UI.

> **One-time: add the workflow via GitHub's web UI.** The pipeline is in the repo at
> [`docs/ci/deploy-0724.yml`](ci/deploy-0724.yml) (GitHub blocks pushing workflow
> files without special token scope). On github.com → **Actions → New workflow → set
> up a workflow yourself**, name it `deploy-0724.yml`, paste that file's contents, and
> commit. It then lives at `.github/workflows/deploy-0724.yml` and runs on every push.

> **Runtime = Nginx Unit** (DirectAdmin → Advanced Features → **Nginx Unit** →
> Create Application), not Phusion Passenger. Unit runs the app's main script
> (`server.js`) through a `unit-http` loader so a standard Next.js server works
> unchanged — see the gotcha in A4.

### A0. Prerequisites
- [ ] **Node.js 20** available in the 0724 Nginx Unit app type.
- [ ] An **FTP account** for the 0724 site (DirectAdmin → FTP Management) — host,
      username, password.
- [ ] A **temp URL** to test on (a temporary subdomain, e.g. `new.thetyremall.co.za`,
      or the server's test URL) while the real domain is still elsewhere.

### A1. Add the FTP details to GitHub (one-time)
In the repo → **Settings → Secrets and variables → Actions**:
- [ ] Secret `FTP_SERVER` = your FTP host (e.g. `ftp.thetyremall.co.za` or the server IP)
- [ ] Secret `FTP_USERNAME` = the FTP user
- [ ] Secret `FTP_PASSWORD` = the FTP password
- [ ] Variable `FTP_SERVER_DIR` = the folder the Node app will run from, **with a
      trailing slash**, e.g. `/domains/thetyremall.co.za/app/`
      *(create this empty folder first in DirectAdmin File Manager — see A2).*
- [ ] If the server has no FTPS, change `protocol: ftps` → `ftp` in the workflow.

### A2. Create the app folder + clear the Laravel default (DirectAdmin File Manager)
- [ ] Create a **dedicated app folder** under the domain, e.g.
      `/domains/thetyremall.co.za/app/` — this is the `FTP_SERVER_DIR` and the Unit
      **Working directory**. Keep it **separate from `public_html`**.
- [ ] **Remove the leftover default Laravel app** from the domain's document root
      (`public_html`) so it doesn't serve instead of our app — move it aside or delete
      it. *(Our app is Next.js; the Laravel page is unrelated and not in our repo.)*
- [ ] Inside the `app/` folder, create an empty **`.data`** folder (holds the live
      SQLite DB; the deploy never overwrites it).

The uploaded folder must look like:
```
app/
├── server.js        ← Unit "Webapp" entry
├── package.json
├── node_modules/    ← traced deps (bundled by the build; no npm install needed for the app)
├── .next/           ← incl. .next/static
├── public/          ← all images
└── .data/           ← you create this; live DB
```

### A3. Run the first deploy
- [ ] Push to `main` (or Actions tab → **Build & deploy to 0724 → Run workflow**).
- [ ] The Action builds and uploads the bundle into `FTP_SERVER_DIR`. The first
      upload is large (~200 MB incl. product images) and slow; later deploys are
      incremental.

### A4. Create the app in Nginx Unit (DirectAdmin → Advanced Features → Nginx Unit → Create Application)
- [ ] **Name** = `tyremall`
- [ ] **Type** = **Node.js** (change it from the default `Java`)
- [ ] **Version** = **20** (highest available)
- [ ] **Working directory** = the app folder (`/domains/thetyremall.co.za/app/`)
- [ ] **Webapp** = `server.js`
- [ ] **Create**, then point the temp subdomain at this app.

> **Unit + Node gotcha:** Unit runs `server.js` via a `unit-http` loader that
> swaps in Unit's HTTP layer, so our standard Next.js server works unchanged. But
> `unit-http` is platform/version-specific to the server's Unit and must exist in
> the app's `node_modules` — the DirectAdmin Node.js app type normally installs it
> for you. If the app won't start and the log says **`Cannot find module
> 'unit-http/loader'`**, let the UI run its npm install for the app (it adds the
> matching `unit-http`), or add `unit-http` there. (Our *app* deps are already
> bundled; this is only Unit's own http shim.)

### A5. Environment variables (in the Node.js app's "Environment variables")
Generate the secrets **locally on your Mac** (Terminal — never paste them into chat):
```bash
echo "TyreMall-$(openssl rand -base64 9 | tr -d '/+=')"   # ADMIN_PASSWORD
openssl rand -hex 32                                      # SESSION_SECRET (64 hex)
openssl rand -hex 24                                      # CRON_SECRET
```
Then add these variables to the app:
```
NEXT_PUBLIC_SITE_URL = https://<temp-subdomain for now, real domain in Phase B>
NODE_ENV             = production
ADMIN_PASSWORD       = <generated>
SESSION_SECRET       = <generated>      # encrypts payment creds + signs logins; keep STABLE forever
CRON_SECRET          = <generated>
# Absolute path is safest under Unit (File Manager shows the full path):
DATABASE_URL         = file:/home/<user>/domains/thetyremall.co.za/app/.data/ttm.db

# PayFast — SANDBOX first (switch to live in Phase B); creds can also go in Admin → Payments
PAYFAST_SANDBOX      = true

# Email — fill in Phase B
MAIL_FROM            = The Tyre Mall <shop@thetyremall.co.za>
SHOP_EMAIL           = shop@thetyremall.co.za
```
- [ ] Click **Restart** on the Node app.

> **Re-deploys:** push to `main` → the Action re-uploads changed files → click
> **Restart** on the Node app in DirectAdmin for the new code to take effect. (The
> `.data` DB is always preserved.)

### A6. First run + admin
- [ ] Confirm `.data/` is writable on persistent disk.
- [ ] Load the temp URL → storefront renders, catalogue auto-seeded from the snapshot.
- [ ] Log in at `<temp-url>/admin` with `ADMIN_PASSWORD` (break-glass owner).
- [ ] In Admin, enter **Payments** creds (PayFast + HappyPay, sandbox) and set the
      **store timezone**. (Content/theme/images already ship with the code — only
      add coupons/staff/new media if you want them.)

### A7. Turn ON maintenance mode
- [ ] Admin → **Settings → Maintenance / Coming-soon mode → On → Save.**
      So the instant DNS flips in Phase B, the public sees the "coming soon" page —
      not a half-ready store. (You, logged in, still see the real site to finish setup.)

### A8. Smoke test on the temp URL
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
