# The Tyre Mall — Admin Backend Build Plan (Phase 0)

Response to `tyre-mall-backend-build-prompt (2).md`. This is the **Coverage Matrix +
phased plan + assumptions** the brief requires before building (Phase 0 exit = this
doc, signed off). It is kept live and ticked off as modules land.

> **Honest scope note.** The brief specifies a full WordPress-class platform (page
> builder, theme editor, deals engine, multi-gateway payments, media library, SEO
> manager, RBAC, analytics, Google stack, verified migration). That is a multi-week,
> multi-phase program — delivered here in **focused, shippable, verified phases**, not
> one drop. Each phase ships to the live admin and is proven on the storefront before
> the next begins.

---

## Current state (what already exists, this repo)

| Capability | State | Where |
|---|---|---|
| DB-backed product catalogue (4,452 incl. 79 wheels) | ✅ | Turso (prod) / file DB (0724); auto-seed from snapshot |
| Admin auth (fail-closed, HMAC session cookie) | ✅ | `src/lib/admin-auth.ts` |
| Products: list, filters/tabs, edit price/stock/status, add/delete, CSV catalogue import/export | ✅ (single-field editor; no bulk price-rules / image lib yet) | `/admin/products`, `scripts/update_catalogue.py` |
| Orders: status workflow, TEST/FREE labels, Live/Test filter, detail, email customer | ✅ core | `/admin/orders` |
| Email: full log, view, **resend, edit-resend, compose, CC shop** | ✅ (§6.20 core) | `/admin/emails` |
| Leads / enquiries / abandoned carts: capture + tabs + detail + reply | ✅ | `/admin/leads` |
| Abandoned-cart automation (capture → daily cron → reminder → stop on purchase) | ✅ live (single reminder) | `/api/cron/recover` |
| PayFast checkout + ITN + stock decrement + order emails | ✅ | `/api/checkout`, `/api/payfast/notify` |
| Settings (site identity, contact, commerce copy) backend-controlled | ⛔ hardcoded | `src/lib/shop-config.ts`, `Footer.tsx` |
| Page builder / sections / theme tokens / string table | ⛔ | — |
| Deals engine + scheduling + banners | ⛔ (sale flags exist per product) | — |
| Media library | ⛔ (images are files in `/public`) | — |
| SEO manager / redirects / sitemap editor | ⛔ (static metadata) | — |
| RBAC (roles, 2FA, users screen) | ⛔ (single admin password) | — |
| Payments framework / adapters / transactions ledger | ⛔ (PayFast hardwired) | — |
| Analytics dashboards / Google stack | ⛔ | — |
| Customer accounts (client zone) | ⛔ | — |

---

## Coverage Matrix (Appendix A rows → owning module → status → phase)

Status: ✅ done · ◑ partial · ⛔ not started. "Phase" = when it lands (plan below).

| # | Element | Owning admin module | API | Status | Phase |
|---|---|---|---|---|---|
| 1 | Header logo / sticky | Design → Identity; Menus | settings/theme/menus | ⛔ | 3 |
| 2 | Header menu + Account link | Menus (header) | menus | ⛔ | 3 |
| 3 | Announcement bar | Deals → Banners | deals/banners | ⛔ | 4 |
| 4 | WhatsApp floating button | Settings → WhatsApp | settings | ◑ (hardcoded) | 1 |
| 5 | Hero eyebrow/headline/sub/body/bg | Pages → Home → Hero | pages/sections | ⛔ | 3 |
| 6 | Tyre search panel + dropdown values | Pages → Search panel | sections (+catalog) | ◑ (values live, copy hardcoded) | 3 |
| 7 | Wheel search panel incl. PCD | Pages → Search panel | sections | ◑ | 3 |
| 8 | Promo banner (schedule) | Deals → Banner campaigns | deals/banners | ⛔ | 4 |
| 9 | Rating strip 4.8★ / count | Reviews → Rating summary | rating-summary | ⛔ | 3 |
| 10 | "HAPPY CUSTOMERS" aggregate | Reviews → Rating summary | rating-summary | ⛔ | 3 |
| 11 | Testimonials | Reviews | reviews | ⛔ | 3 |
| 12 | FAN FAVOURITES carousel + source | Pages → carousel; Products flags | sections/products | ◑ (flag exists) | 3 |
| 13 | FRESH MAGS carousel | Pages → carousel | sections | ◑ | 3 |
| 14 | Our Story copy | Pages → Story | sections | ⛔ | 3 |
| 15 | 4 stat items | Pages → Stats | stats | ⛔ | 3 |
| 16 | Team section + members | Pages → Team | team | ⛔ | 3 |
| 17 | Footer address/email/hours/columns/social/© | Settings + Menus (footer) | settings/menus | ⛔ → **Phase 1 slice** | 1/3 |
| 18 | Product card (all labels + values) | Products + Strings + Theme | products/strings/theme | ◑ (values from DB; labels hardcoded) | 2/3 |
| 19 | Shop filters / sort / per-page / pagination labels | Settings → Shop config | settings | ◑ | 3 |
| 20 | Category & brand nav links | Brands/Categories | brands/categories | ◑ (from data) | 2 |
| 21 | Product breadcrumbs | Product template | — | ◑ | 3 |
| 22 | Benefit strip (3 items) | Settings → Product copy | settings | ⛔ | 3 |
| 23 | Short desc / features / description (+template) | Product editor → Content | products | ◑ (editable text; no rich editor/template toggle) | 2 |
| 24 | Specifications rows | Product editor → Specs | products | ◑ | 2 |
| 25 | "How to read this size" | Product template copy | strings | ⛔ | 3 |
| 26 | Fits-these-vehicles + disclaimer | Fitment DB + copy | fitment | ◑ (data exists; no admin CRUD) | 2 |
| 27 | "Mag wheels that fit" | Product template + Pages | strings | ◑ | 3 |
| 28 | Compare table | Product template (auto) | — | ◑ | 3 |
| 29 | Suggested / "WE THINK YOU'LL LIKE THESE" | Product template | products | ◑ | 3 |
| 30 | Per-page + global SEO/OG/schema | SEO manager | seo | ⛔ | 5 |
| 31 | robots / sitemap / 404 / coming-soon | SEO / Settings | seo/settings | ◑ (static) | 5 |
| 32 | Every UI string | Strings table | strings | ⛔ | 3 |
| 33 | Colours / fonts / radii / styles | Theme editor | theme | ⛔ | 3 |
| 34 | Logo / favicon / apple-icon / share image | Design → Identity | settings/media | ◑ (favicon done) | 3 |
| 35 | VAT / currency format / free-delivery rule | Settings → Commerce | settings | ⛔ → **Phase 1** | 1 |
| 36 | HappyPay / Mobicred / road-hazard config | Settings → Commerce | settings | ◑ (hardcoded) | 1 |
| 37 | Analytics / custom scripts / cookie banner | Settings → Integrations | settings | ⛔ | 5 |
| 38 | Payment gateways enable/config | Settings → Payments | payments | ◑ (PayFast only, env) | 5 |
| 39 | Transactions ledger / refunds / webhooks | Settings → Payments | payments | ⛔ | 5 |
| 40 | Connectors / outgoing webhooks / API keys | Integrations | integrations | ⛔ | 5 |
| 41 | New pages (Deals/Clearance) + compose | Pages → Page manager | pages | ⛔ | 3/4 |
| 42 | Brands & Categories CRUD | Brands / Categories | brands/categories | ◑ (data; no CRUD UI) | 2 |
| 43 | Self-updating deals/clearance listing | Pages → `deals_grid` | deals/sections | ⛔ | 4 |
| 44 | Orders: create/view/status/cancel/refund/timeline | Orders (§6.19) | orders | ◑ (view/status/labels; no admin-create/refund/timeline) | 2 |
| 45 | Customer purchase history / LTV | Orders → Customers | customers | ⛔ | 6 (client zone) |
| 46 | Email templates / send-resend / logs | Notification centre (§6.20) | emails | ✅ core | done |
| 47 | Sales & product analytics | Analytics (§6.21) | analytics | ⛔ | 5 |
| 48 | GA4 / Ads / Merchant Center / Search Console | Settings → Integrations | integrations | ⛔ | 5 |

Gaps found during build get **added to this matrix**, never hardcoded (Prime Directive #2).

---

## Build phases (sequence + exit criteria)

Phases 1–5 = "finish the admin backend." Phase 6 = the three named asks
(orders CSV import, abandoned-cart upgrade, client zone). Each ships to live admin,
is verified on the storefront, committed, and deployed before the next.

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. Settings foundation** | DB-backed `settings` singletons (site identity, contact & hours, social, commerce: VAT/currency/free-delivery/BNPL/road-hazard/add-on copy, WhatsApp). Admin **Settings** screen. Wire **footer + contact points** to read settings. Revalidation plumbing (cache tags). | Edit address/email/hours/WhatsApp/VAT in admin → live on storefront ≤60s. No hardcoded contact values remain in footer. |
| **2. Catalog depth** | Brands & Categories CRUD; Fitment DB admin; richer product editor (features/specs/description with template toggle); bulk price/stock actions + rounding; product duplicate; CSV import dry-run + rollback (upgrade `update_catalogue`). | Create a brand+category in admin, assign to a product, see it on storefront; bulk 10% price drop + revert; 500-row import with error report + batch rollback. |
| **3. Content: pages, sections, strings, theme** | `pages`+`sections` model + homepage builder (reorder/show-hide/edit all 10 sections); String table (every UI literal); Reviews + RatingSummary (fixes 0.0 bug); Team + Stats + Story; Menus (header/footer) builder; Theme tokens (colours/fonts/radii) via CSS variables; Identity (logo/favicon/share). | Rebuild the homepage + restyle (colour/font) + edit any wording from admin, no deploy; reorder a section live; 4.8★ aggregate correct. |
| **4. Deals engine** | `deals` model + wizard (scope/discount/schedule Africa-Johannesburg) + cron state flips + price-revert guarantee + banners/announcement bar + `deals_grid` section + a Deals/Clearance page. | Deal starting +5m ending +10m auto-starts, shows badge/strike, auto-expires to exact retail; kill-switch; banner schedule. |
| **5. Commerce platform** | Payments framework (adapter registry + PayFast/HappyPay/Payflex/Mobicred/manual-EFT configs, transactions ledger, pay-by-link, webhooks); Orders admin-create + cancel/refund + timeline; SEO manager + redirects + sitemap; Analytics dashboards; Google stack (GA4/Ads/Merchant feed/Search Console); RBAC (roles + 2FA + users); audit log + revisions; backups/export. | Section 12 acceptance tests 15–21 pass; RBAC blocks at API; audit diffs recorded. |
| **6. The three asks** | (a) WooCommerce **orders CSV import** (historical consolidation); (b) **abandoned-cart upgrade** (multi-step sequence + admin config, matching the WP plugin); (c) **client zone** (register/login, order history, addresses/vehicles, forgot password — no card storage). | Old orders imported + visible/filterable; configurable reminder sequence sends on cadence; customer can register, log in, see their orders. |

---

## Assumptions (Phase 0, per brief §Role)

1. **DB = Turso/libSQL (SQLite)**, not Postgres/Prisma as the brief recommends. Rationale:
   the app is already built on Drizzle + libSQL, live on Turso (prod) and a file DB (0724).
   Switching to Postgres/Prisma now would be a rewrite with no user-visible benefit. libSQL
   scales to the 4.5k-SKU catalogue and the order/lead volumes here. (Deviation justified per §4.)
2. **Auth** stays the current HMAC-cookie admin login; RBAC + 2FA (Auth.js-style) is added in
   Phase 5, not retrofitted now.
3. **Images** stay as optimised local `/public` webp files until Phase 3 introduces a media
   library; a full Cloudinary/S3 pipeline is Phase 3+ and optional.
4. **"Zero hardcoded content"** is achieved progressively, directive-compliant per phase: each
   phase moves a defined surface (Phase 1 = contact/commerce, Phase 3 = all copy/sections) into
   the DB. The automated no-hardcoded-strings sweep runs at the end of Phase 3.
5. **Hosting** = Vercel + Turso now; 0724 file DB at launch. Vercel Cron drives schedulers.
6. **Money** = integer minor units (cents), ZAR `R2 428,00` locale — already the case.
7. The **WooCommerce orders CSV** provided is the WC Analytics format (no email/line-items);
   imports are historical records. A fuller order export, if supplied, maps richer fields.

---

## Reprioritised: Staff accounts & login security (pulled forward)

At the owner's request, **staff RBAC + login security** (originally Phase 5) is
pulled forward to run next, after the current catalog work. Delivered in slices:

- **5a. Login security hardening** ✅ *(done 2026-10-16)* — DB-backed brute-force
  lock-out (8 failed attempts per IP / 15 min → 429, holds across serverless
  instances via Turso), a hidden **honeypot** field to catch form-filling bots,
  a failure delay to slow guessing, and the existing fail-closed HMAC session.
- **5b. Staff accounts & roles** ✅ *(done 2026-10-16)* — `admin_users` table;
  login by **email + password** (scrypt hash); roles **Super Admin / Manager /
  Editor / Viewer** with a permission matrix enforced server-side on every
  mutation (403, not just hidden UI); Users screen (add, set role, enable/
  disable, set password). Env `ADMIN_PASSWORD` = break-glass super-admin owner.
- **5c. Forgot password** ✅ *(done 2026-10-16)* — `password_resets` (sha-256,
  1-hour one-time token); /admin/forgot + /admin/reset; reset email sent with no
  CC; no account enumeration. *Delivery needs email configured (Resend/SMTP).*
- **5d. 2FA (TOTP)** *(pending)* — optional enrolment for admin+ roles.

## Status log

- 2026-10-16 — Phase 0 authored. Current admin state captured above.
- 2026-10-16 — Phase 1 shipped: Settings foundation (footer reads DB settings).
- 2026-10-16 — Phase 2a shipped: bulk product actions (price/stock/visibility/sale).
- 2026-10-16 — Phase 5a shipped: admin login brute-force + bot protection.
- 2026-10-16 — Phase 5b shipped: staff accounts, 4 roles, RBAC enforced (UI + API).
- 2026-10-16 — Phase 5c shipped: forgot-password (email reset token).
- 2026-10-16 — Phase 2b shipped: fuller CSV importer (create+update all fields, dry-run, undo).
- 2026-10-16 — Phase 4 (coupons) shipped: admin coupon management + checkout application + redemption tracking.
- 2026-10-16 — Phase 5 (payments) shipped: encrypted gateway config store + Admin → Payments screen; PayFast now DB-configurable (no redeploy, env fallback); real HappyPay adapter (createOrder/webhook/status/refund) wired into checkout. DNS/email go-live checklist (docs/GO-LIVE-DNS.md).
- 2026-10-16 — Orders: refund button (full/partial) via gateway adapters (HappyPay auto, PayFast manual-record + restock + email).
- 2026-10-16 — Phase 2 catalog depth: full single-product editor (all fields + spec merge) + product duplicate.
- 2026-10-16 — Next: Brands & Categories CRUD, Fitment admin (rest of Phase 2), then Phase 3 (pages/sections/strings/theme).
- 2026-10-16 — Next: remaining catalog depth (brands/categories CRUD, fitment admin, richer product editor) + content/theme (Phase 3) + the 3 asks.
