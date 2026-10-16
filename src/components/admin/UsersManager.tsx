"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "super_admin" | "manager" | "editor" | "viewer";
const ROLE_OPTS: { v: Role; label: string }[] = [
  { v: "super_admin", label: "Super Admin" },
  { v: "manager", label: "Manager" },
  { v: "editor", label: "Editor" },
  { v: "viewer", label: "Viewer (read-only)" },
];
const roleLabel = (r: string) => ROLE_OPTS.find((o) => o.v === r)?.label ?? r;

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: number | null;
}

const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<number, string>>({});
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");

  async function create() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, role, password }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setMsg(`✓ Added ${email}`); setEmail(""); setName(""); setPassword(""); setRole("editor"); router.refresh(); }
      else setMsg(d.error ?? "Couldn't add user.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function patch(id: number, body: Record<string, unknown>, okText: string) {
    setRowMsg((m) => ({ ...m, [id]: "" }));
    const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setRowMsg((m) => ({ ...m, [id]: res.ok ? okText : (d.error ?? "Failed") }));
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Add staff member</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@thetyremall.co.za" className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`mt-1 ${field}`}>
              {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Temporary password (min 10 chars)</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${field}`} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={create} disabled={busy || !email || !name || password.length < 10} className="btn btn-volt px-5 disabled:opacity-50">{busy ? "Adding…" : "Add staff member"}</button>
          {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
        </div>
        <p className="mt-2 text-xs text-muted">Share the temporary password with them securely — they can change it later. Roles control exactly what they can do.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Staff</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Last login</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No staff accounts yet — add your first above.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold text-fg">{u.name || "—"}{u.id === currentUserId && <span className="ml-1.5 badge badge-muted">you</span>}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select value={u.role} disabled={u.id === currentUserId} onChange={(e) => patch(u.id, { role: e.target.value }, "✓ role updated")}
                    className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt disabled:opacity-60" title={u.id === currentUserId ? "You can't change your own role" : ""}>
                    {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.active
                    ? <span className="badge badge-pay">active</span>
                    : <span className="badge badge-sale">disabled</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-ZA") : "never"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    {u.id !== currentUserId && (
                      <button onClick={() => patch(u.id, { active: !u.active }, u.active ? "✓ disabled" : "✓ enabled")} className="text-xs font-semibold text-muted hover:text-volt">
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    )}
                    {resetFor === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="new password" className="h-8 w-36 rounded border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-volt" />
                        <button onClick={async () => { if (resetPw.length < 10) { setRowMsg((m) => ({ ...m, [u.id]: "Min 10 chars" })); return; } await patch(u.id, { password: resetPw }, "✓ password set"); setResetFor(null); setResetPw(""); }} className="text-xs font-bold text-volt">Save</button>
                        <button onClick={() => { setResetFor(null); setResetPw(""); }} className="text-xs text-muted">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setResetFor(u.id); setResetPw(""); }} className="text-xs font-semibold text-muted hover:text-volt">Set password</button>
                    )}
                    {rowMsg[u.id] && <span className={`text-xs font-semibold ${rowMsg[u.id].startsWith("✓") ? "text-pay" : "text-sale"}`}>{rowMsg[u.id]}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
