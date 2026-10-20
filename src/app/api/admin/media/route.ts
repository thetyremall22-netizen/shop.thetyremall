import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createImage, createVideo, listMedia, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME } from "@/lib/media";

/** Media list for pickers (banners, page content). */
export async function GET(req: NextRequest) {
  if (!(await authorize("content.view"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const kind = req.nextUrl.searchParams.get("kind") || undefined;
  const { rows } = await listMedia({ page: 1, perPage: 200, kind });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  if (body.kind === "video") {
    const r = await createVideo({ title: String(body.title ?? ""), youtubeUrl: String(body.youtubeUrl ?? "") });
    return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  // image: expect a data URL "data:image/webp;base64,...."
  const dataUrl = String(body.dataUrl ?? "");
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  const mime = m[1];
  const base64 = m[2];
  if (!ALLOWED_IMAGE_MIME.includes(mime)) return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return NextResponse.json({ error: `Image too large (${Math.round(bytes / 1024)}KB). Max ${Math.round(MAX_IMAGE_BYTES / 1024)}KB.` }, { status: 413 });

  const r = await createImage({
    title: String(body.title ?? ""), base64, mime,
    width: Number(body.width) || 0, height: Number(body.height) || 0,
  });
  return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.error }, { status: 400 });
}
