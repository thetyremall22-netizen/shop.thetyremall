import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateUser, getUserById, type Role, ROLES, ROLE_LABELS } from "@/lib/admin-users";
import { addAudit, actorName } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("users.manage");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const patch: { name?: string; role?: Role; active?: boolean; password?: string } = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (b.role !== undefined) { if (!ROLES.includes(b.role as Role)) return NextResponse.json({ error: "invalid role" }, { status: 400 }); patch.role = b.role as Role; }
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.password === "string" && b.password) patch.password = b.password;

  // Guard: an account admin can't deactivate or demote their own logged-in account
  // (prevents accidental self-lockout; the env owner login is the recovery path).
  if (actor.id === userId && (patch.active === false || (patch.role && patch.role !== "super_admin"))) {
    return NextResponse.json({ error: "You can't disable or demote your own account." }, { status: 400 });
  }

  const before = await getUserById(userId);
  const res = await updateUser(userId, patch);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  const parts: string[] = [];
  if (patch.role && before && patch.role !== before.role) parts.push(`Role: ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[patch.role]}`);
  if (patch.active !== undefined && before && patch.active !== before.active) parts.push(patch.active ? "Enabled" : "Disabled");
  if (patch.password) parts.push("Password set by an admin");
  if (patch.name !== undefined && before && patch.name.trim() !== before.name) parts.push(`Name: ${before.name} → ${patch.name.trim()}`);
  if (parts.length) await addAudit({ entity: "staff", entityId: userId, action: "edit", actor: actorName(actor), summary: `${before?.email ?? userId}: ${parts.join(" · ")}` });
  return NextResponse.json({ ok: true });
}
