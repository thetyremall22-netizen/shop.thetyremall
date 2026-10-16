import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { deleteMedia } from "@/lib/media";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  await deleteMedia(Number(id));
  return NextResponse.json({ ok: true });
}
