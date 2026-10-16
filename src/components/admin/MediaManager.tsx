"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface MediaItem {
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  youtubeId: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: number;
}

interface Limits { maxBytes: number; targetBytes: number; maxDim: number }

const card = "rounded-xl border border-line bg-surface p-4";
const btnSm = "rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-fg";

function fmtBytes(n: number) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Downscale + re-encode an image file to WebP under the byte target. */
async function compress(file: File, L: Limits): Promise<{ dataUrl: string; width: number; height: number } | { error: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read that image."));
      i.src = url;
    });
    let w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(1, L.maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const draw = (dw: number, dh: number, q: number) => {
      const c = document.createElement("canvas");
      c.width = dw; c.height = dh;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, dw, dh);
      return c.toDataURL("image/webp", q);
    };
    const bytesOf = (d: string) => Math.floor(((d.split(",")[1] || "").length * 3) / 4);

    let dw = w, dh = h, q = 0.85;
    let dataUrl = draw(dw, dh, q);
    if (!dataUrl) return { error: "Your browser couldn't process that image." };
    // lower quality first, then shrink dimensions, until under target (or floor)
    let guard = 0;
    while (bytesOf(dataUrl) > L.targetBytes && guard++ < 12) {
      if (q > 0.5) q -= 0.1;
      else { dw = Math.round(dw * 0.85); dh = Math.round(dh * 0.85); }
      const next = draw(dw, dh, q);
      if (!next) break;
      dataUrl = next;
    }
    if (bytesOf(dataUrl) > L.maxBytes) return { error: `Still ${Math.round(bytesOf(dataUrl) / 1024)}KB after compression — try a simpler image.` };
    return { dataUrl, width: dw, height: dh };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function MediaManager({ items, total, totalBytes, page, pages, limits }: {
  items: MediaItem[]; total: number; totalBytes: number; page: number; pages: number; limits: Limits;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    let ok = 0; const errs: string[] = [];
    for (const file of Array.from(files)) {
      const r = await compress(file, limits);
      if ("error" in r) { errs.push(`${file.name}: ${r.error}`); continue; }
      const res = await fetch("/api/admin/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "image", title: file.name, dataUrl: r.dataUrl, width: r.width, height: r.height }),
      });
      if (res.ok) ok++; else { const j = await res.json().catch(() => ({})); errs.push(`${file.name}: ${j.error || res.statusText}`); }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    setMsg(errs.length ? { t: "err", m: `${ok} uploaded. ${errs.join(" · ")}` } : { t: "ok", m: `${ok} image${ok === 1 ? "" : "s"} uploaded.` });
    router.refresh();
  }

  async function addVideo() {
    if (!ytUrl.trim()) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/media", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", title: ytTitle, youtubeUrl: ytUrl }),
    });
    setBusy(false);
    if (res.ok) { setYtUrl(""); setYtTitle(""); setMsg({ t: "ok", m: "Video added." }); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg({ t: "err", m: j.error || "Couldn't add video." }); }
  }

  async function del(id: number, label: string) {
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else setMsg({ t: "err", m: "Delete failed." });
  }

  const copyUrl = (id: number) => {
    const u = `${location.origin}/api/media/${id}`;
    navigator.clipboard?.writeText(u);
    setMsg({ t: "ok", m: "Image URL copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      {/* uploaders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h2 className="font-display text-lg">Upload images</h2>
          <p className="mt-1 text-xs text-muted">
            Auto-compressed to WebP, max {limits.maxDim}px and ~{Math.round(limits.maxBytes / 1024)}KB each —
            sized to the site&apos;s banners so uploads never slow the store down. JPG / PNG / WebP.
          </p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple
            disabled={busy} onChange={(e) => onPickFiles(e.target.files)}
            className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-volt file:px-4 file:py-2 file:text-sm file:font-bold file:text-volt-ink hover:file:brightness-110 disabled:opacity-50" />
        </div>
        <div className={card}>
          <h2 className="font-display text-lg">Add a video</h2>
          <p className="mt-1 text-xs text-muted">Paste a YouTube link — videos embed from YouTube, nothing heavy is stored here.</p>
          <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="Title (optional)"
            className="mt-3 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-volt" />
          <div className="mt-2 flex gap-2">
            <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…"
              className="h-10 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-volt" />
            <button onClick={addVideo} disabled={busy || !ytUrl.trim()} className="btn btn-volt px-4 disabled:opacity-50">Add</button>
          </div>
        </div>
      </div>

      {msg && <div className={`rounded-lg border p-3 text-sm ${msg.t === "ok" ? "border-volt/40 bg-volt/10 text-volt" : "border-sale/40 bg-sale/10 text-sale"}`}>{msg.m}</div>}
      {busy && <div className="text-sm text-muted">Working…</div>}

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{total.toLocaleString()} item{total === 1 ? "" : "s"} · {fmtBytes(totalBytes)} stored</span>
      </div>

      {/* gallery */}
      {items.length === 0 ? (
        <p className="text-sm text-muted">No media yet. Upload an image or add a video above.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="relative aspect-video bg-surface-2">
                {it.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${it.id}`} alt={it.title} className="size-full object-contain" loading="lazy" />
                ) : (
                  <a href={`https://youtu.be/${it.youtubeId}`} target="_blank" rel="noopener noreferrer" className="group block size-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://img.youtube.com/vi/${it.youtubeId}/hqdefault.jpg`} alt={it.title} className="size-full object-cover" loading="lazy" />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-11 place-items-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-110">▶</span>
                    </span>
                  </a>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold text-fg" title={it.title}>{it.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {it.kind === "image" ? `${it.width}×${it.height} · ${fmtBytes(it.bytes)}` : "YouTube video"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {it.kind === "image" ? (
                    <>
                      <a href={`/api/media/${it.id}?dl=1`} className={btnSm}>Download</a>
                      <button onClick={() => copyUrl(it.id)} className={btnSm}>Copy URL</button>
                    </>
                  ) : (
                    <a href={`https://youtu.be/${it.youtubeId}`} target="_blank" rel="noopener noreferrer" className={btnSm}>Open</a>
                  )}
                  <button onClick={() => del(it.id, it.title)} className="rounded-lg border border-sale/40 px-2.5 py-1 text-xs font-semibold text-sale hover:bg-sale/10">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <a href={`/admin/media?page=${page - 1}`} className="btn btn-ghost h-9 px-4 text-sm">← Prev</a>}
            {page < pages && <a href={`/admin/media?page=${page + 1}`} className="btn btn-ghost h-9 px-4 text-sm">Next →</a>}
          </div>
        </div>
      )}
    </div>
  );
}
