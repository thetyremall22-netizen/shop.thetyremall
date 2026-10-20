import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { supportCounts } from "@/lib/support";

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
    canManageDeals: can(u.role, "deals.manage"),
    canEditContent: can(u.role, "content.edit"),
    // New support requests waiting for staff (badge on the Support tab).
    supportNew: can(u.role, "orders.view") ? (await supportCounts()).open ?? 0 : 0,
  });
}
