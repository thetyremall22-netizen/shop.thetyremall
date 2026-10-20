import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createSpecial } from "@/lib/special-categories";
import { addAudit, actorName } from "@/lib/audit";
import { parseSpecialBody } from "./parse";

/** Create a special category. */
export async function POST(req: NextRequest) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit products." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const r = await createSpecial(parseSpecialBody(b));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await addAudit({ entity: "special", entityId: r.special.id, action: "created", actor: actorName(actor), summary: `Created special “${r.special.name}” (/product-category/${r.special.slug})` });
  return NextResponse.json({ ok: true, special: r.special });
}
