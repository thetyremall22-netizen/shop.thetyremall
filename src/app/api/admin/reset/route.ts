import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/admin-users";

export async function POST(req: NextRequest) {
  let token: string | undefined;
  let password: string | undefined;
  try {
    ({ token, password } = (await req.json()) as { token?: string; password?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });

  const res = await consumeResetToken(token, password ?? "");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
