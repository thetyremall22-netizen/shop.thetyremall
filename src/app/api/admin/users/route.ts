import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createUser, type Role, ROLES } from "@/lib/admin-users";

export async function POST(req: NextRequest) {
  if (!(await authorize("users.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const email = String(b.email ?? "").trim();
  const name = String(b.name ?? "").trim();
  const role = String(b.role ?? "") as Role;
  const password = String(b.password ?? "");
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });

  const res = await createUser({ email, name, role, password });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
