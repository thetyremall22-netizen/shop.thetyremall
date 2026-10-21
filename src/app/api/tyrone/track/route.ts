import { NextRequest, NextResponse, connection } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { trackJourney, EVENT_TYPES, type JourneyEventType } from "@/lib/tyrone-journey";
import { validateContact } from "@/lib/validate";

// Steps of a Tyrone conversation's journey (see lib/tyrone-journey).
export async function POST(req: NextRequest) {
  await connection();
  let b: { sid?: unknown; events?: unknown; contact?: { name?: string; email?: string; phone?: string } };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const sid = typeof b.sid === "string" && /^[a-z0-9-]{8,64}$/i.test(b.sid) ? b.sid : null;
  if (!sid) return NextResponse.json({ ok: false }, { status: 400 });
  const str = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 20).flatMap((e) => {
    const o = (e ?? {}) as Record<string, unknown>;
    const type = String(o.type) as JourneyEventType;
    return EVENT_TYPES.includes(type) ? [{ type, label: str(o.label), href: str(o.href), page: str(o.page) }] : [];
  });
  // Only valid contact details are stored against the conversation.
  let contact: { name?: string; email?: string; phone?: string } | undefined;
  if (b.contact) {
    const { errors, clean } = validateContact(b.contact, { name: true, email: true, phone: true });
    if (!Object.keys(errors).length) contact = clean;
  }
  if (!events.length && !contact) return NextResponse.json({ ok: true });
  await trackJourney(sid, events, contact, await isAdmin());
  return NextResponse.json({ ok: true });
}
