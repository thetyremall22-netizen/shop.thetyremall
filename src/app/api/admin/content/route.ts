import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { saveStory, saveTeamSection, saveStat, deleteStat, saveTeamMember, deleteTeamMember } from "@/lib/site-content";

// One command endpoint for the homepage content blocks.
export async function POST(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: { type?: string; op?: string; id?: number; data?: Record<string, unknown> };
  try { b = (await req.json()) as typeof b; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const d = b.data ?? {};
  const s = (v: unknown) => String(v ?? "");
  const n = (v: unknown) => Number(v) || 0;
  const id = b.id && Number.isFinite(b.id) ? b.id : null;

  try {
    switch (b.type) {
      case "story": await saveStory({ eyebrow: s(d.eyebrow), body: s(d.body) }); break;
      case "teamSection": await saveTeamSection({ eyebrow: s(d.eyebrow), emptyCopy: s(d.emptyCopy) }); break;
      case "stat":
        if (b.op === "delete" && id) await deleteStat(id);
        else await saveStat(id, { value: s(d.value), label: s(d.label), sortOrder: n(d.sortOrder) });
        break;
      case "team":
        if (b.op === "delete" && id) await deleteTeamMember(id);
        else await saveTeamMember(id, { name: s(d.name), role: s(d.role), photo: s(d.photo), sortOrder: n(d.sortOrder) });
        break;
      default: return NextResponse.json({ error: "unknown type" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
