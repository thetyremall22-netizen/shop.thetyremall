import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getUserById, createResetToken, ROLE_LABELS } from "@/lib/admin-users";
import { sendStaffAccessEmail } from "@/lib/email";
import { addAudit, actorName } from "@/lib/audit";
import { publicBase } from "@/lib/staff-links";

const HOURS = 24;

/** Email a staff member a link to set a new password (admin-initiated). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("users.manage");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getUserById(Number((await params).id));
  if (!user) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (!user.active) return NextResponse.json({ error: "This account is disabled. Enable it first." }, { status: 400 });
  const t = await createResetToken(user.email, HOURS * 3600_000);
  if (!t) return NextResponse.json({ error: "Couldn't create a reset link." }, { status: 500 });
  const firstLogin = user.lastLoginAt == null;
  try {
    await sendStaffAccessEmail(firstLogin ? "invite" : "reset", user.email, user.name, `${publicBase(req)}/admin/reset?token=${t.token}`, ROLE_LABELS[user.role], HOURS);
  } catch (e) {
    return NextResponse.json({ error: `Couldn't send the email: ${(e as Error).message}` }, { status: 502 });
  }
  await addAudit({ entity: "staff", entityId: user.id, action: "reset", actor: actorName(actor), summary: `${firstLogin ? "Invite" : "Password reset link"} emailed to ${user.email}` });
  return NextResponse.json({ ok: true });
}
