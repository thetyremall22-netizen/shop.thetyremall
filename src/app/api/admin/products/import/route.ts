import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { bulkUpsert } from "@/lib/db/queries";

// minimal CSV parser (handles quoted fields, commas, newlines)
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file." }, { status: 400 });
  const rows = parseCsv(text);
  if (!rows.length) return NextResponse.json({ error: "No rows found." }, { status: 400 });
  if (!("slug" in rows[0]) && !("sku" in rows[0])) {
    return NextResponse.json({ error: "CSV must include a 'slug' or 'sku' column to match products." }, { status: 400 });
  }
  const { updated, skipped } = await bulkUpsert(rows);
  return NextResponse.json({ ok: true, updated, skipped, total: rows.length });
}
