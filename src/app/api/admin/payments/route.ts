import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { listGatewayStatus } from "@/lib/payments";

export async function GET() {
  if (!(await authorize("settings.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ gateways: await listGatewayStatus() });
}
