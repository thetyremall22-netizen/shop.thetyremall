import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createReview, saveRatingSummary } from "@/lib/reviews";

// POST = create a review; PATCH = save the rating summary.
export async function POST(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const res = await createReview({
    name: String(b.name ?? ""), location: String(b.location ?? ""), quote: String(b.quote ?? ""),
    rating: Number(b.rating) || 5, source: String(b.source ?? "onsite"),
    verified: b.verified !== false, featured: b.featured !== false, sortOrder: Number(b.sortOrder) || 0,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  await saveRatingSummary({
    overall: b.overall !== undefined ? Number(b.overall) : undefined,
    count: b.count !== undefined ? String(b.count) : undefined,
    sourceCopy: b.sourceCopy !== undefined ? String(b.sourceCopy) : undefined,
  });
  return NextResponse.json({ ok: true });
}
