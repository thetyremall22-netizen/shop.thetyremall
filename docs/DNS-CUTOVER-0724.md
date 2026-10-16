# DNS cutover checklist — moving thetyremall.co.za to 0724

**Why this exists:** the domain transfer into the 0724 server is still pending. When
it's accepted and the **nameservers switch**, the new DNS zone must already contain
every record below **before** the switch goes live — otherwise email and/or the
website break the moment the nameservers flip.

> ⚠️ The old `cp1.practiwebs.co.za` zone I inspected had a **WRONG MX**
> (`mail.thetyremall.co.za` → a local server, not Microsoft). If a zone like that is
> used at cutover, **inbound @thetyremall.co.za email dies instantly.** Rebuild the
> new zone from the records below, don't trust whatever is pre-populated.

## Live DNS snapshot (captured 2026-10-16, from the authoritative host-h.net zone)

### 🔴 Microsoft 365 email — MUST be recreated exactly (do not change the values)
| Type | Name | Value | Notes |
|---|---|---|---|
| MX | `@` (root) | `thetyremall-co-za.mail.protection.outlook.com` (priority 10) | Inbound mail. Critical. |
| TXT | `@` (root) | `v=spf1 include:spf.protection.outlook.com -all` | SPF. Keep Microsoft-only (see Resend note). |
| TXT | `@` (root) | `MS=ms42962560` | Microsoft domain verification. |
| CNAME | `autodiscover` | `autodiscover.outlook.com` | Outlook client autoconfig. |
| CNAME | `enterpriseregistration` | `enterpriseregistration.windows.net` | Intune/AAD. |
| CNAME | `enterpriseenrollment` | `enterpriseenrollment.manage.microsoft.com` | Intune/AAD. |

*(No Microsoft DKIM selectors — `selector1/2._domainkey` — are currently published.
If M365 DKIM is enabled later, add those two CNAMEs too.)*

### 🌐 Website — point to wherever the NEW site is hosted
| Type | Name | Current value | At cutover |
|---|---|---|---|
| A | `@` (root) | `156.38.250.26` (old WordPress host) | → new host IP, **or** the Vercel/0724 target for the new Next.js site |
| A | `www` | `156.38.250.26` | → same as root (or CNAME to it) |

*Decide before cutover where the live site runs — the new Next.js app (Vercel or
0724) or the old WordPress site — and set these accordingly. If Vercel:
A `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com` (confirm current values
in the Vercel dashboard at cutover).*

### ✉️ Resend (transactional email sending) — ADD these new rows
| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey` | the full `p=MIGfMA…QIDAQAB` DKIM key from resend.com/domains |
| CNAME | `rsend` | `rsend-eu…mta.net` (exact value from Resend) |
| CNAME | `send` | `send.for…mta.net` (exact value from Resend) |
| TXT | `_dmarc` *(optional)* | `v=DMARC1; p=none; rua=mailto:shop@thetyremall.co.za` |

**Resend does NOT need the root SPF changed** — the `rsend`/`send` CNAMEs delegate
SPF on a separate `send.` subdomain, and alignment passes via `resend._domainkey`.
Leave the Microsoft root SPF exactly as-is.

## Order of operations (zero-downtime)
1. **Before accepting/finishing the transfer:** in the NEW host's DNS editor, build the
   full zone from the tables above (M365 rows + website rows). Double-check the MX and
   SPF match Microsoft exactly.
2. **Lower TTLs** on the current live zone a day ahead (e.g. 300s) so the switch is fast.
3. **Switch the nameservers** to the new host.
4. **Immediately verify:**
   - `dig MX thetyremall.co.za` → still `…mail.protection.outlook.com`
   - Send a test email **to** shop@thetyremall.co.za → arrives in the M365 inbox
   - `dig A thetyremall.co.za` → the intended site host; load the site over HTTPS
5. **Then add/verify Resend:** add the Resend rows, click "I've added the records" in
   Resend, wait for green, send a test from Admin → Emails to a real address.
6. **Re-issue HTTPS** for the new host if needed (Let's Encrypt) once A records resolve.

## Rollback
Keep the old host-h.net zone intact until the new one is confirmed working. If anything
breaks, point the nameservers back to `ns1/ns2.host-h.net` + `ns1/ns2.dns-h.com`.

## Doing it sooner (optional)
If email sending is needed **before** the transfer, the Resend rows can be added to the
**current live host-h.net zone** now (email works immediately) — but they'll need to be
re-added in the new zone after cutover. Otherwise, do everything once in step 5 above.
