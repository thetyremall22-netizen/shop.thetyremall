import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { saveString } from "@/lib/strings";

export async function PATCH(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: { key?: string; value?: string };
  try { b = (await req.json()) as typeof b; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (!b.key) return NextResponse.json({ error: "missing key" }, { status: 400 });
  await saveString(b.key, String(b.value ?? ""));
  return NextResponse.json({ ok: true });
}
