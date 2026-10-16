import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { saveGateway, type GatewayMode } from "@/lib/payments";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  if (!(await authorize("settings.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { key } = await params;
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const config: Record<string, string> = {};
  if (b.config && typeof b.config === "object") {
    for (const [k, v] of Object.entries(b.config as Record<string, unknown>)) config[k] = String(v ?? "");
  }
  const res = await saveGateway(key, {
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
    mode: b.mode === "live" || b.mode === "test" ? (b.mode as GatewayMode) : undefined,
    config,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
