# The Tyre Mall — Online Store

Modern e-commerce storefront for **The Tyre Mall** (tyres, mag wheels & car accessories, South Africa).
Built with **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4** and **TypeScript**.

> **Status:** demo / build in progress. Checkout is currently a **mock flow** — no live payments are wired up yet (PayFast / HappyPay / Mobicred come in a later phase).

---

## Tech stack

| Area        | Choice                                             |
| ----------- | -------------------------------------------------- |
| Framework   | Next.js 16 (App Router, Turbopack)                 |
| UI          | React 19, Tailwind CSS v4, CSS animations          |
| Language    | TypeScript                                         |
| Data        | Static product catalogue in `src/data/*.json`      |
| Images      | Product photos hotlinked from `thetyremall.co.za`  |
| Hosting     | Vercel                                             |

## Local setup

Requires **Node.js 18.18+** (Node 20+ recommended).

```bash
npm install        # install dependencies
npm run dev        # start dev server → http://localhost:3000
```

### Scripts

| Command         | What it does                              |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Local dev server with hot reload          |
| `npm run build` | Production build (run before deploying)   |
| `npm run start` | Serve the production build locally        |
| `npm run lint`  | Lint the codebase                         |

## Project structure

```
src/
  app/            # routes (home, shop, product, cart, checkout, api/search)
  components/     # UI components (Hero, Header, MegaSearch, ProductCard, …)
  lib/            # cart state, config, helpers
  data/           # product + category catalogue (JSON)
public/brand/     # logos, hero image, product scene art
```

## Deploying to Vercel

The site is hosted on Vercel and **auto-deploys on every push to `main`**.

**First-time setup (one-off):**

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. **Import Git Repository** → select this repo (`shop.thetyremall`).
3. Vercel auto-detects **Next.js** — keep all build settings at their defaults.
4. Click **Deploy**. A live `*.vercel.app` URL is created in ~1–2 minutes.

**Every change after that:**

```bash
git add -A
git commit -m "describe your change"
git push            # → GitHub, then Vercel auto-builds & redeploys
```

### Notes

- **Free tier:** runs on Vercel's Hobby plan for demo/preview. A **live store taking real payments needs Vercel Pro** (Hobby is non-commercial only).
- **No environment variables** are required yet. When live payments are added, API keys go in Vercel → Project → Settings → Environment Variables (never commit them).
- Build output: most pages are static; `/shop`, `/coming-soon` and `/api/search` are server-rendered on demand.
