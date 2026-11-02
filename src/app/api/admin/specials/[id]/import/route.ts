import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { runDealImport } from "@/lib/deal-import";
import { addAudit, actorName } from "@/lib/audit";

export const maxDuration = 60;

/** Import deal products into this special / sale (?commit=1 writes; otherwise a preview). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("products.import");
  if (!actor) return NextResponse.json({ error: "You don't have permission to import products." }, { status: 403 });
  const id = Number((await params).id);
  const commit = req.nextUrl.searchParams.get("commit") === "1";
  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file." }, { status: 400 });
  try {
    const report = await runDealImport(text, id, commit);
    if (report.committed) {
      await addAudit({ entity: "special", entityId: id, action: "import", actor: actorName(actor),
        summary: `Imported deal products into “${report.special}”: ${report.createdCount} added, ${report.updatedCount} updated`, after: { batchId: report.batchId } });
    }
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: `Import failed: ${(e as Error).message}` }, { status: 500 });
  }
}
