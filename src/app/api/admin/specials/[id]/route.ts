import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateSpecial, deleteSpecial } from "@/lib/special-categories";
import { addAudit, actorName, diffFields, describeChanges } from "@/lib/audit";
import { parseSpecialBody } from "../parse";

const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "none");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = Number((await params).id);
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const r = await updateSpecial(id, parseSpecialBody(b));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const view = (s: typeof r.special) => ({ name: s.name, slug: s.slug, description: s.description, image: s.image, start: fmt(s.startAt), end: fmt(s.endAt), on: s.enabled ? "on" : "off" });
  const changes = diffFields(view(r.before), view(r.special));
  if (Object.keys(changes).length) {
    await addAudit({ entity: "special", entityId: id, action: b.undo ? "undo" : "edit", actor: actorName(actor),
      summary: (b.undo ? "Undid: " : "") + describeChanges(changes, { name: "Name", slug: "Address", description: "Description", image: "Image", start: "Starts", end: "Ends", on: "Switched" }) });
  }
  return NextResponse.json({ ok: true, special: r.special, before: r.before });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("products.delete");
  if (!actor) return NextResponse.json({ error: "You don't have permission to delete." }, { status: 403 });
  const id = Number((await params).id);
  const r = await deleteSpecial(id);
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await addAudit({ entity: "special", entityId: id, action: "delete", actor: actorName(actor),
    summary: `Deleted special “${r.special.name}” and removed it from ${r.slugs.length} product(s)`, before: { special: r.special, products: r.slugs } });
  return NextResponse.json({ ok: true, removedFrom: r.slugs.length });
}
