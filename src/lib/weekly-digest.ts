import "server-only";
import { newStock, fetchMarketNews } from "./market";
import { callTapSummary } from "./enquiries";
import { listLeads } from "./contacts";
import { sendMail, SHOP_EMAIL } from "./email";

/** Build and email the weekly summary to the shop. */
export async function sendWeeklyDigest(): Promise<{ stock: number; calls: number; leads: number; news: number }> {
  const weekAgo = Date.now() - 7 * 86400_000;
  const [stock, calls, news, leads] = await Promise.all([
    newStock(7),
    callTapSummary(weekAgo),
    fetchMarketNews(),
    listLeads({ limit: 500 }),
  ]);
  const newLeads = leads.filter((l) => Number(l.created_at) > weekAgo);

  const esc = (s: string) => s.replace(/</g, "&lt;");
  const section = (title: string, inner: string) => `<h2 style="font-size:16px;margin:22px 0 8px">${title}</h2>${inner}`;
  const ul = (items: string[]) => items.length ? `<ul style="margin:0;padding-left:18px">${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : `<p style="color:#6b7280;margin:0">None this week.</p>`;

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#14171a">
    <p>Weekly summary for The Tyre Mall — ${new Date().toLocaleDateString("en-ZA")}.</p>
    ${section(`New &amp; updated stock (${stock.count})`, ul(stock.samples.map((s) => `${esc(s.brand)} — ${esc(s.name)} <i style="color:#6b7280">(${s.type})</i>`)))}
    ${section(`Call taps by branch`, ul(calls.map((c) => `${esc(c.storeName)}: <b>${c.taps}</b>`)))}
    ${section(`New contact leads (${newLeads.length})`, ul(newLeads.slice(0, 25).map((l) => `${esc(String(l.email ?? l.phone ?? "—"))} <i style="color:#6b7280">(${esc(String(l.source ?? ""))})</i>`)))}
    ${section(`New vehicles &amp; tyres coming to SA`, news.length
      ? ul(news.map((n) => n.url ? `<a href="${n.url}">${esc(n.title)}</a>${n.summary ? ` — ${esc(n.summary)}` : ""}` : esc(n.title)))
      : `<p style="color:#6b7280;margin:0">No market feed configured (set NEWS_FEED_URL to include industry news here).</p>`)}
  </div>`;

  await sendMail(SHOP_EMAIL, `The Tyre Mall — weekly summary`, html);
  return { stock: stock.count, calls: calls.length, leads: newLeads.length, news: news.length };
}
