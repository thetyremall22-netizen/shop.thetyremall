import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateLead, LEAD_EDITABLE, type LeadField } from "@/lib/contacts";
import { validateContact } from "@/lib/validate";
import { addAudit, diffFields, describeChanges, actorName } from "@/lib/audit";

const LABELS: Record<string, string> = {
  name: "Name", email: "Email", phone: "Phone", message: "Message",
  product_name: "Product", sku: "SKU", product_url: "Product link", notes: "Notes",
};

/** Edit a lead (fix a mistyped name/email/phone, add notes). Every change is
 *  recorded in the lead's history; `undo: true` marks a revert. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("leads.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit leads." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const patch: Partial<Record<LeadField, string | null>> = {};
  for (const k of LEAD_EDITABLE) {
    if (k in b) {
      const v = b[k];
      patch[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, k === "message" || k === "notes" ? 5000 : 500) : null;
    }
  }

  // Same rules as the website forms for the contact fields (blank is allowed
  // so a wrong value can be cleared).
  const { errors, clean } = validateContact(
    { name: patch.name ?? undefined, email: patch.email ?? undefined, phone: patch.phone ?? undefined }, {},
  );
  if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 });
  if (patch.name) patch.name = clean.name ?? patch.name;
  if (patch.email) patch.email = clean.email ?? patch.email;
  if (patch.phone) patch.phone = clean.phone ?? patch.phone;

  const res = await updateLead(id, patch);
  if (!res) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const pick = (row: Record<string, unknown>) => Object.fromEntries(LEAD_EDITABLE.map((k) => [k, row[k] ?? null]));
  const before = pick(res.before);
  const after = pick(res.after);
  const changes = diffFields(before, after);
  if (Object.keys(changes).length) {
    await addAudit({
      entity: "lead", entityId: id, action: b.undo ? "undo" : "edit",
      summary: (b.undo ? "Undid: " : "") + describeChanges(changes, LABELS),
      before, after, actor: actorName(actor),
    });
  }
  return NextResponse.json({ ok: true, before, after });
}
