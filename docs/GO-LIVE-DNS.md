# Go-Live DNS & Email Deliverability — thetyremall.co.za

## The golden rule
Moving the website to the **0724** server changes only the **A record**. Email
(MX, SPF, DKIM, autodiscover) stays on **Microsoft 365** and is **not affected**.
**Never change the MX record when moving the site.**

## Current state (verified 2026-10-16)
| Record | Value | Status |
|---|---|---|
| MX | `thetyremall-co-za.mail.protection.outlook.com` | ✅ Microsoft 365 — leave as-is |
| SPF (TXT) | `v=spf1 include:spf.protection.outlook.com -all` | ✅ correct — leave as-is |
| DKIM | *(none published)* | ⚠️ enable (below) |
| DMARC (`_dmarc` TXT) | *(missing)* | ⚠️ add (below) |
| Website A (`@`, `www`) | `156.38.250.26` (old host) | ⚠️ change to 0724 |

0724 server IP: **169.239.182.48**

---

## 1. Website cutover (DNS)
- [ ] `A  @`   → `169.239.182.48`
- [ ] `A  www` → `169.239.182.48`  (or `CNAME www → thetyremall.co.za`)
- [ ] **Leave unchanged:** `MX`, the SPF `TXT`, `autodiscover`, and any
  `selector1/2._domainkey` records — these are email, not website.
- [ ] Lower the A-record TTL to 300s a day before cutover for a fast switch; raise it back after.

## 2. HTTPS (on 0724)
- [ ] DirectAdmin → SSL/TLS → issue **Let's Encrypt** for `thetyremall.co.za` + `www`.
- [ ] Confirm `https://thetyremall.co.za` loads with a valid padlock.
  *(Required — PayFast and HappyPay will not call insecure URLs.)*

## 3. Email sending from shop@thetyremall.co.za (M365, via 0724)
- [ ] Microsoft 365 admin → Users → shop@thetyremall.co.za → **Mail → Manage email apps → tick "Authenticated SMTP"**.
- [ ] If MFA is on the mailbox, create an **app password** for it.
- [ ] Confirm 0724 allows **outbound TCP 587** (ask the host). If blocked, use Resend instead.
- [ ] Server env vars:
  ```
  SMTP_HOST=smtp.office365.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=shop@thetyremall.co.za
  SMTP_PASS=<mailbox app password>
  MAIL_FROM=The Tyre Mall <shop@thetyremall.co.za>
  ```
- [ ] Test: `https://thetyremall.co.za/api/test-email?key=<CRON_SECRET>` → expect `{"ok":true}`.

## 4. Deliverability (keep order emails out of spam)
- [ ] **SPF** — already correct for M365. ✅ No change.
- [ ] **DKIM** — Microsoft Defender portal → Email & collaboration → Policies & rules →
  Threat policies → **DKIM** → select `thetyremall.co.za` → it shows **two CNAMEs**
  (`selector1._domainkey` / `selector2._domainkey` → `…onmicrosoft.com`). Add both to
  DNS, then click **Enable**.
- [ ] **DMARC** — add a TXT record:
  ```
  Host:  _dmarc
  Value: v=DMARC1; p=none; rua=mailto:shop@thetyremall.co.za; fo=1
  ```
  Start at `p=none` (monitor), move to `p=quarantine` once DKIM/SPF are confirmed aligned.

## 5. PayFast
- [ ] **Admin → Payments → PayFast**: enter live **Merchant ID / Merchant Key / Passphrase**,
  set **mode = Live**, tick Enabled. *(No redeploy — takes effect immediately.)*
- [ ] PayFast dashboard → Settings → Integration: set the **passphrase to the same value**,
  and set the **ITN (notify) URL** to `https://thetyremall.co.za/api/payfast/notify`.
- [ ] Do one **Test-mode** order first to confirm the full loop, then switch to Live.

## 6. HappyPay
- [ ] **Admin → Payments → HappyPay**: enter **Merchant ID / API key / a webhook secret
  (you choose any random string)**, set **mode = Test**, tick Enabled.
- [ ] No webhook URL to configure in HappyPay — the site sends the `successWebhook` /
  `failureWebhook` URLs on every order automatically (they carry your webhook secret).
- [ ] Place a **Test-mode** order (runs against `qa.happypay.co.za`), then switch to **Live**.

## 7. After cutover
- [ ] HTTPS padlock valid; homepage, shop, product, checkout all load.
- [ ] One PayFast (test) + one HappyPay (test) order each complete → order appears in
  Admin → Orders (status processing) → stock decremented → confirmation email arrives.
- [ ] Flip PayFast + HappyPay to **Live** in Admin → Payments.

> Security: payment credentials live in **Admin → Payments** (encrypted at rest), not in
> the code or the repo. Any credential shared over chat/email should be rotated once set up.
