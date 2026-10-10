import { NextRequest, NextResponse } from "next/server";
import { checkPassword, makeToken, ADMIN_COOKIE, ADMIN_MAXAGE } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  let password: string | undefined;
  try {
    ({ password } = (await req.json()) as { password?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!checkPassword(password ?? "")) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAXAGE,
    path: "/",
  });
  return res;
}
