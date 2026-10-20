import { NextResponse } from "next/server";
import { signOut } from "@/lib/customer-routes";

export async function POST() {
  return signOut(NextResponse.json({ ok: true }));
}
