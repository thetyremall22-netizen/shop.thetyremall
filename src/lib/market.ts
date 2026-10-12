import "server-only";
import { libsql } from "./db";

export interface NewsItem { title: string; url?: string; summary?: string }

/** New & updated stock in the last `days` days (from the DB). */
export async function newStock(days = 7): Promise<{ count: number; samples: { name: string; brand: string; type: string }[] }> {
  try {
    const cutoff = Date.now() - days * 86400_000;
    const c = await libsql.execute({ sql: `SELECT COUNT(*) n FROM products WHERE updated_at > ?`, args: [cutoff] });
    const s = await libsql.execute({ sql: `SELECT name, brand, type FROM products WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 15`, args: [cutoff] });
    return {
      count: Number(c.rows[0]?.n ?? 0),
      samples: s.rows.map((r) => ({ name: String(r.name), brand: String(r.brand), type: String(r.type) })),
    };
  } catch {
    return { count: 0, samples: [] };
  }
}

/**
 * New vehicles / tyres coming to South Africa (item 42). Real-time web scraping
 * isn't reliable from a serverless cron, so this reads from a feed you plug in:
 * set NEWS_FEED_URL to a JSON endpoint returning [{title,url,summary}] (e.g. a
 * saved search, an RSS-to-JSON bridge, or an internal feed). Returns [] when
 * unconfigured so the digest still sends.
 */
export async function fetchMarketNews(): Promise<NewsItem[]> {
  const url = process.env.NEWS_FEED_URL;
  if (!url) return [];
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return arr.slice(0, 20).map((i: Record<string, unknown>) => ({
      title: String(i.title ?? "").slice(0, 200),
      url: typeof i.url === "string" ? i.url : (typeof i.link === "string" ? i.link : undefined),
      summary: typeof i.summary === "string" ? i.summary.slice(0, 300) : (typeof i.description === "string" ? i.description.slice(0, 300) : undefined),
    })).filter((i: NewsItem) => i.title);
  } catch {
    return [];
  }
}
