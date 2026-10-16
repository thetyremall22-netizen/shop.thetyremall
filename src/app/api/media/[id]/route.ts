import { NextRequest, NextResponse } from "next/server";
import { getMediaRaw } from "@/lib/media";

// Public image serving — media uploaded in admin is meant to be shown on the
// site, so this is unauthenticated. `?dl=1` forces a download instead of inline.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getMediaRaw(Number(id));
  if (!raw) return new NextResponse("Not found", { status: 404 });

  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const ext = raw.mime.split("/")[1] || "bin";
  const safeName = raw.title.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/\.[A-Za-z0-9]+$/, "") || `media-${id}`;

  return new NextResponse(new Uint8Array(raw.buffer), {
    headers: {
      "Content-Type": raw.mime,
      "Content-Length": String(raw.buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(dl ? { "Content-Disposition": `attachment; filename="${safeName}.${ext}"` } : {}),
    },
  });
}
