import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";

export async function GET() {
  const u = await getAdminUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    name: u.name,
    email: u.email,
    role: u.role,
    isOwner: u.isOwner,
    canManageUsers: can(u.role, "users.manage"),
    canManageSettings: can(u.role, "settings.manage"),
  });
}
