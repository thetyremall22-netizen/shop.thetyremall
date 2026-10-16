import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateReview, deleteReview } from "@/lib/reviews";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const rid = Number(id);
  if (!Number.isFinite(rid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.location === "string") patch.location = b.location;
  if (b.rating !== undefined) patch.rating = Number(b.rating);
  if (typeof b.quote === "string") patch.quote = b.quote;
  if (typeof b.source === "string") patch.source = b.source;
  if (typeof b.verified === "boolean") patch.verified = b.verified;
  if (typeof b.featured === "boolean") patch.featured = b.featured;
  if (b.sortOrder !== undefined) patch.sortOrder = Number(b.sortOrder);
  await updateReview(rid, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const rid = Number(id);
  if (!Number.isFinite(rid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteReview(rid);
  return NextResponse.json({ ok: true });
}
