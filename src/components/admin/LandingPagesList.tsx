"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row { id: number; slug: string; title: string; published: boolean; menu: string; sections: number; updatedAt: number }
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const MENU: Record<string, string> = { main: "Main menu", footer: "Footer", none: "Not in a menu" };
const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "—");

export function LandingPagesList({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/landing-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slug: slug || slugify(title) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't create the page."); return; }
    router.push(`/admin/pages/${d.page.id}`);
  }

  return (
    <>
      <form onSubmit={create} className="mt-6 card p-5">
        <h2 className="font-display text-xl">New landing page</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Page title</span>
            <input required value={title} onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} placeholder="e.g. Black Friday Tyre Specials" className="num w-full" />
          </label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Address — thetyremall.co.za/…</span>
            <input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }} placeholder="black-friday-tyre-specials" className="num w-full" />
          </label>
          <button disabled={busy || !title.trim()} className="btn btn-volt h-11 px-5">{busy ? "Creating…" : "Create page"}</button>
        </div>
        {err && <p className="mt-2 text-sm text-sale">{err}</p>}
        <p className="mt-2 text-xs text-muted">The page starts as a hidden draft — add your sections, then switch on “Published” when it&apos;s ready.</p>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2.5">Page</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Linked from</th><th className="px-3 py-2.5">Last saved</th><th className="px-3 py-2.5" />
          </tr></thead>
          <tbody>
            {initial.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No landing pages yet. Create your first one above.</td></tr>
            ) : initial.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/pages/${p.id}`} className="font-semibold text-fg hover:text-volt">{p.title}</Link>
                  <div className="text-xs text-muted">/{p.slug} · {p.sections} section{p.sections === 1 ? "" : "s"}</div>
                </td>
                <td className="px-3 py-2.5">{p.published
                  ? <span className="rounded-full bg-volt/15 px-2.5 py-0.5 text-xs font-bold text-volt">Published</span>
                  : <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-bold text-muted">Draft (hidden)</span>}</td>
                <td className="px-3 py-2.5 text-muted">{MENU[p.menu] ?? p.menu}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{when(p.updatedAt)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right text-xs font-bold">
                  <Link href={`/admin/pages/${p.id}`} className="text-volt hover:underline">Edit</Link>
                  {p.published
                    ? <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="ml-3 text-muted hover:text-volt">View ↗</a>
                    : <Link href={`/admin/pages/${p.id}/preview`} className="ml-3 text-muted hover:text-volt">Preview</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
