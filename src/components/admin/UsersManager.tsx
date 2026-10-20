"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";

type Role = "super_admin" | "manager" | "editor" | "viewer";
const ROLE_OPTS: { v: Role; label: string; help: string }[] = [
  { v: "super_admin", label: "Super Admin", help: "Everything, including staff accounts, payments and settings." },
  { v: "manager", label: "Manager", help: "Products, orders, emails, leads, content and coupons. No staff, payments or settings." },
  { v: "editor", label: "Editor", help: "Products and website content. Can view leads." },
  { v: "viewer", label: "Viewer (read-only)", help: "Can look at products, orders, emails, leads and content, but not change anything." },
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

type Pending =
  | { kind: "role"; user: UserRow; role: Role }
  | { kind: "active"; user: UserRow }
  | { kind: "password"; user: UserRow; password: string }
  | { kind: "reset"; user: UserRow }
  | { kind: "create" };

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<number, string>>({});
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ id: number; body: Record<string, unknown>; message: string } | null>(null);

  async function patch(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error ?? "Failed" };
  }

  async function confirmYes() {
    if (!pending) return;
    setBusy(true);
    if (pending.kind === "create") {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password: mode === "password" ? password : "", sendInvite: mode === "invite" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(mode === "invite"
          ? (d.invited ? `✓ Added ${email} and emailed them a link to set their password.` : `✓ Added ${email}, but the invite email couldn't be sent. Use “Email reset link” below.`)
          : `✓ Added ${email}. Share the temporary password with them securely.`);
        setEmail(""); setName(""); setPassword(""); setRole("editor");
        router.refresh();
      } else setMsg(d.error ?? "Couldn't add user.");
    } else if (pending.kind === "reset") {
      const res = await fetch(`/api/admin/users/${pending.user.id}/send-reset`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      setRowMsg((m) => ({ ...m, [pending.user.id]: res.ok ? "✓ link emailed" : d.error ?? "Failed" }));
    } else {
      const u = pending.user;
      const body = pending.kind === "role" ? { role: pending.role } : pending.kind === "active" ? { active: !u.active } : { password: pending.password };
      const r = await patch(u.id, body);
      setRowMsg((m) => ({ ...m, [u.id]: r.ok ? "✓ saved" : r.error ?? "Failed" }));
      if (r.ok) {
        if (pending.kind === "role") setUndo({ id: u.id, body: { role: u.role }, message: `${u.name || u.email} is now ${roleLabel(pending.role)}` });
        if (pending.kind === "active") setUndo({ id: u.id, body: { active: u.active }, message: `${u.name || u.email} ${u.active ? "disabled" : "enabled"}` });
        if (pending.kind === "password") { setResetFor(null); setResetPw(""); }
        router.refresh();
      }
    }
    setBusy(false);
    setPending(null);
  }

  const confirmTitle = !pending ? "" :
    pending.kind === "create" ? `Add ${name || email} as ${roleLabel(role)}?` :
    pending.kind === "reset" ? `Email ${pending.user.email} a link to set a new password?` :
    pending.kind === "active" ? `${pending.user.active ? "Disable" : "Enable"} ${pending.user.name || pending.user.email}?` :
    "Are you sure you want to change this?";

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Add staff member</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@thetyremall.co.za" className={`mt-1 ${field}`} /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-muted">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`mt-1 ${field}`}>
              {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">{ROLE_OPTS.find((o) => o.v === role)?.help}</span></label>
        </div>
        <fieldset className="mt-4 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" name="pwmode" checked={mode === "invite"} onChange={() => setMode("invite")} className="mt-1 accent-[var(--color-volt)]" />
            <span><b className="text-fg">Email them a link to set their own password</b> <span className="text-muted">(recommended; the link lasts 3 days)</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="pwmode" checked={mode === "password"} onChange={() => setMode("password")} className="mt-1 accent-[var(--color-volt)]" />
            <span><b className="text-fg">I&apos;ll set a temporary password</b> <span className="text-muted">(min 10 characters; they can change it with “Forgot password?”)</span></span>
          </label>
          {mode === "password" && (
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" className={`${field} max-w-sm`} />
          )}
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => { setMsg(null); setPending({ kind: "create" }); }} disabled={!email || !name || (mode === "password" && password.length < 10)} className="btn btn-volt px-5 disabled:opacity-50">Add staff member</button>
          {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
        </div>
        <p className="mt-2 text-xs text-muted">Staff can only be added here by a Super Admin. Nobody can request access from the login page. Anyone can use “Forgot password?” on the login page to reset their own password by email.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[680px] text-sm">
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
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No staff accounts yet. Add your first above.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold text-fg">{u.name || "—"}{u.id === currentUserId && <span className="ml-1.5 badge badge-muted">you</span>}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select value={u.role} disabled={u.id === currentUserId} onChange={(e) => setPending({ kind: "role", user: u, role: e.target.value as Role })}
                    className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt disabled:opacity-60" title={u.id === currentUserId ? "You can't change your own role" : ""}>
                    {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.active ? <span className="badge badge-pay">active</span> : <span className="badge badge-sale">disabled</span>}
                  {u.lastLoginAt == null && u.active && <div className="mt-1 text-xs text-muted">hasn&apos;t signed in yet</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-ZA") : "never"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    {u.active && (
                      <button onClick={() => setPending({ kind: "reset", user: u })} className="text-xs font-semibold text-muted hover:text-volt">
                        {u.lastLoginAt == null ? "Resend invite email" : "Email reset link"}
                      </button>
                    )}
                    {resetFor === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="new password" className="h-8 w-36 rounded border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-volt" />
                        <button onClick={() => { if (resetPw.length < 10) { setRowMsg((m) => ({ ...m, [u.id]: "Min 10 chars" })); return; } setPending({ kind: "password", user: u, password: resetPw }); }} className="text-xs font-bold text-volt">Save</button>
                        <button onClick={() => { setResetFor(null); setResetPw(""); }} className="text-xs text-muted">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setResetFor(u.id); setResetPw(""); }} className="text-xs font-semibold text-muted hover:text-volt">Set password myself</button>
                    )}
                    {u.id !== currentUserId && (
                      <button onClick={() => setPending({ kind: "active", user: u })} className={`text-xs font-semibold ${u.active ? "text-muted hover:text-sale" : "text-muted hover:text-volt"}`}>
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    )}
                    {rowMsg[u.id] && <span className={`text-xs font-semibold ${rowMsg[u.id].startsWith("✓") ? "text-pay" : "text-sale"}`}>{rowMsg[u.id]}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!pending} busy={busy} title={confirmTitle} onNo={() => setPending(null)} onYes={confirmYes}
        danger={pending?.kind === "active" && pending.user.active}
        yesLabel={pending?.kind === "reset" ? "Yes, send" : pending?.kind === "create" ? "Yes, add" : "Yes, change it"}>
        {pending?.kind === "role" && <ChangeList changes={[{ label: pending.user.email, from: roleLabel(pending.user.role), to: roleLabel(pending.role) }]} />}
        {pending?.kind === "active" && <p>{pending.user.active ? "They won't be able to sign in until you enable them again." : "They'll be able to sign in again."}</p>}
        {pending?.kind === "password" && <p>Their current password stops working immediately.</p>}
        {pending?.kind === "create" && <p>{mode === "invite" ? `${email} will get an email with a link to set their password.` : "Share the temporary password with them securely."}</p>}
      </ConfirmDialog>
      {undo && (
        <UndoBar message={undo.message} onClose={() => setUndo(null)}
          onUndo={async () => { await patch(undo.id, undo.body); router.refresh(); }} />
      )}
    </div>
  );
}
