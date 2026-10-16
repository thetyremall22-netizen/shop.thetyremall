"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Stat { id: number; value: string; label: string; sortOrder: number }
export interface TeamMember { id: number; name: string; role: string; photo: string; sortOrder: number }
export interface Story { eyebrow: string; body: string }
export interface TeamSection { eyebrow: string; emptyCopy: string }

const field = "mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const label = "text-xs font-bold uppercase tracking-wide text-muted";

function usePost() {
  const router = useRouter();
  return async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) router.refresh();
    return res.ok;
  };
}

export function ContentManager({ story, teamSection, stats, team }: { story: Story; teamSection: TeamSection; stats: Stat[]; team: TeamMember[] }) {
  const post = usePost();

  // story
  const [eyebrow, setEyebrow] = useState(story.eyebrow);
  const [body, setBody] = useState(story.body);
  const [storyMsg, setStoryMsg] = useState<string | null>(null);
  // team section
  const [tEyebrow, setTEyebrow] = useState(teamSection.eyebrow);
  const [emptyCopy, setEmptyCopy] = useState(teamSection.emptyCopy);
  const [tsMsg, setTsMsg] = useState<string | null>(null);
  // new stat / member
  const [ns, setNs] = useState({ value: "", label: "" });
  const [nm, setNm] = useState({ name: "", role: "", photo: "" });

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Our Story</h2>
        <label className="mt-3 block"><span className={label}>Eyebrow</span><input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className={field} /></label>
        <label className="mt-3 block"><span className={label}>Story text</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${field} h-auto py-2`} /></label>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={async () => setStoryMsg(await post({ type: "story", data: { eyebrow, body } }) ? "✓ Saved" : "Error")} className="btn btn-volt px-5">Save story</button>
          {storyMsg && <span className="text-sm font-semibold text-pay">{storyMsg}</span>}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg">Stats</h2>
        <div className="mt-3 space-y-2">
          {stats.map((s) => <StatRow key={s.id} s={s} post={post} />)}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <label className="block"><span className={label}>Value</span><input value={ns.value} onChange={(e) => setNs({ ...ns, value: e.target.value })} placeholder="10" className={`${field} w-28`} /></label>
          <label className="block flex-1 min-w-[160px]"><span className={label}>Label</span><input value={ns.label} onChange={(e) => setNs({ ...ns, label: e.target.value })} placeholder="Years rolling" className={field} /></label>
          <button onClick={async () => { if (ns.value && ns.label && await post({ type: "stat", data: { ...ns, sortOrder: stats.length } })) setNs({ value: "", label: "" }); }} className="btn btn-ghost h-10 px-4 text-sm">Add stat</button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg">Meet the Team</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={label}>Section eyebrow</span><input value={tEyebrow} onChange={(e) => setTEyebrow(e.target.value)} className={field} /></label>
          <label className="block"><span className={label}>Empty-state copy (when no members)</span><input value={emptyCopy} onChange={(e) => setEmptyCopy(e.target.value)} className={field} /></label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={async () => setTsMsg(await post({ type: "teamSection", data: { eyebrow: tEyebrow, emptyCopy } }) ? "✓ Saved" : "Error")} className="btn btn-ghost h-9 px-4 text-sm">Save section text</button>
          {tsMsg && <span className="text-sm font-semibold text-pay">{tsMsg}</span>}
        </div>

        <div className="mt-5 space-y-2 border-t border-line pt-4">
          {team.length === 0 && <p className="text-sm text-muted">No team members yet — the homepage shows the placeholder &amp; empty copy above. Add members below to show real photos.</p>}
          {team.map((m) => <TeamRow key={m.id} m={m} post={post} />)}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block"><span className={label}>Name</span><input value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} className={`${field} w-40`} /></label>
          <label className="block"><span className={label}>Role</span><input value={nm.role} onChange={(e) => setNm({ ...nm, role: e.target.value })} className={`${field} w-40`} /></label>
          <label className="block flex-1 min-w-[160px]"><span className={label}>Photo URL/path</span><input value={nm.photo} onChange={(e) => setNm({ ...nm, photo: e.target.value })} placeholder="/team/name.webp" className={field} /></label>
          <button onClick={async () => { if (nm.name && await post({ type: "team", data: { ...nm, sortOrder: team.length } })) setNm({ name: "", role: "", photo: "" }); }} className="btn btn-ghost h-10 px-4 text-sm">Add member</button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ s, post }: { s: Stat; post: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [value, setValue] = useState(s.value);
  const [lbl, setLbl] = useState(s.label);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-28 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt" />
      <input value={lbl} onChange={(e) => setLbl(e.target.value)} className="h-9 flex-1 min-w-[140px] rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt" />
      <button onClick={() => post({ type: "stat", id: s.id, data: { value, label: lbl, sortOrder: s.sortOrder } })} className="text-xs font-semibold text-volt hover:underline">Save</button>
      <button onClick={() => post({ type: "stat", op: "delete", id: s.id })} className="text-xs font-semibold text-muted hover:text-sale">Delete</button>
    </div>
  );
}
function TeamRow({ m, post }: { m: TeamMember; post: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(m.name);
  const [role, setRole] = useState(m.role);
  const [photo, setPhoto] = useState(m.photo);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-36 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt" />
      <input value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-36 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt" />
      <input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="/team/x.webp" className="h-9 flex-1 min-w-[140px] rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt" />
      <button onClick={() => post({ type: "team", id: m.id, data: { name, role, photo, sortOrder: m.sortOrder } })} className="text-xs font-semibold text-volt hover:underline">Save</button>
      <button onClick={() => post({ type: "team", op: "delete", id: m.id })} className="text-xs font-semibold text-muted hover:text-sale">Delete</button>
    </div>
  );
}
