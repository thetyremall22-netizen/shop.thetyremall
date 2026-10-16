import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateUser, type Role, ROLES } from "@/lib/admin-users";

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

  const res = await updateUser(userId, patch);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
