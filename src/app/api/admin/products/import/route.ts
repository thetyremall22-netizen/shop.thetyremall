import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { runImport, type ImportMode } from "@/lib/product-import";

export const maxDuration = 60;

const MODES: ImportMode[] = ["upsert", "create", "update"];

export async function POST(req: NextRequest) {
  if (!(await authorize("products.import"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const mode = (MODES.includes(url.searchParams.get("mode") as ImportMode) ? url.searchParams.get("mode") : "upsert") as ImportMode;
  const commit = url.searchParams.get("commit") === "1";

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file." }, { status: 400 });

  try {
    const report = await runImport(text, mode, commit);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: `Import failed: ${(e as Error).message}` }, { status: 500 });
  }
}
