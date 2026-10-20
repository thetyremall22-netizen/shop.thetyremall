import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createUser, createResetToken, type Role, ROLES, ROLE_LABELS } from "@/lib/admin-users";
import { sendStaffAccessEmail } from "@/lib/email";
import { addAudit, actorName } from "@/lib/audit";
import { publicBase } from "@/lib/staff-links";

const INVITE_HOURS = 72;

/** Add a staff member. Either the admin sets a temporary password, or
 *  (`sendInvite`) the staff member gets an email link to choose their own. */
export async function POST(req: NextRequest) {
  const actor = await authorize("users.manage");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const email = String(b.email ?? "").trim();
  const name = String(b.name ?? "").trim();
  const role = String(b.role ?? "") as Role;
  const invite = b.sendInvite === true;
  // With an invite, a random password nobody knows is set until they choose theirs.
  const password = invite ? crypto.randomBytes(24).toString("base64url") : String(b.password ?? "");
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter their name." }, { status: 400 });

  const res = await createUser({ email, name, role, password });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  let invited = false;
  if (invite) {
    const t = await createResetToken(email, INVITE_HOURS * 3600_000);
    if (t) {
      try {
        await sendStaffAccessEmail("invite", t.user.email, name, `${publicBase(req)}/admin/reset?token=${t.token}`, ROLE_LABELS[role], INVITE_HOURS);
        invited = true;
      } catch (e) {
        console.error("[users] invite email failed", e);
      }
    }
  }
  await addAudit({
    entity: "staff", entityId: res.id ?? email, action: "created", actor: actorName(actor),
    summary: `Added ${name} <${email}> as ${ROLE_LABELS[role]}${invite ? (invited ? " — invite emailed" : " — invite email FAILED") : " with a temporary password"}`,
  });
  return NextResponse.json({ ok: true, id: res.id, invited });
}
