"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage, fitImageToCanvas, MEDIA_LIMITS, type Canvas } from "./image-compress";

interface MediaItem { id: number; kind: string; title: string; width: number; height: number; bytes: number }

/** Pick an image for the website: from the Media library, or upload a new one
 *  (auto-compressed to ≤300 KB / 2000px and saved to the library). */
export function ImagePicker({ value, onChange, label = "Image", hint, fit, previewClass = "h-16 w-28" }: {
  value: string; onChange: (src: string) => void; label?: string; hint?: string;
  /** Fit uploads into this exact canvas (e.g. brand logos) instead of just compressing. */
  fit?: Canvas;
  previewClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // For fixed-size slots (banners): the chosen image's real size, so an old or
  // wrong-sized one is flagged and can be resized in one click.
  const [dims, setDims] = useState<{ src: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!fit?.exact || !value) return;
    const i = new Image();
    i.onload = () => setDims({ src: value, w: i.naturalWidth, h: i.naturalHeight });
    i.src = value;
  }, [fit?.exact, value]);
  const fits = (w: number, h: number) => !fit?.exact || (w === fit.width && h === fit.height);
  const wrongSize = !!(fit?.exact && value && dims && dims.src === value && !fits(dims.w, dims.h));

  async function resizeCurrent() {
    setBusy(true); setErr(null);
    const blob = await fetch(value).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    if (!blob) { setBusy(false); setErr("Couldn't load the current image to resize it. Upload a new one instead."); return; }
    await upload(new File([blob], `banner-${fit!.width}x${fit!.height}.webp`, { type: blob.type || "image/webp" }));
  }

  async function load() {
    const r = await fetch("/api/admin/media?kind=image").then((x) => x.json()).catch(() => ({ items: [] }));
    setItems(r.items ?? []);
  }
  useEffect(() => { if (open && items === null) void load(); }, [open, items]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setErr(null);
    const c = fit ? await fitImageToCanvas(file, fit) : await compressImage(file, MEDIA_LIMITS);
    if ("error" in c) { setErr(c.error); setBusy(false); return; }
    const res = await fetch("/api/admin/media", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "image", title: file.name, dataUrl: c.dataUrl, width: c.width, height: c.height }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) { setErr(d.error ?? "Upload failed."); return; }
    onChange(`/api/media/${d.id}`);
    setItems(null);
    setOpen(false);
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <div className="flex items-start gap-3">
        <div className={`grid ${previewClass} shrink-0 place-items-center overflow-hidden rounded-lg border border-line ${fit?.mode === "contain" ? "bg-white p-1" : "bg-surface-2"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className={`size-full ${fit?.mode === "contain" ? "object-contain" : "object-cover"}`} /> : <span className="text-xs text-faint">none</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(!fit || fit.mode === "cover") && <button type="button" onClick={() => setOpen(!open)} className="btn btn-dark h-9 px-3 text-xs">{open ? "Close library" : "Choose from Media"}</button>}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-volt-outline h-9 px-3 text-xs">{busy ? "Uploading…" : "Upload new"}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {wrongSize && fit && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sale/40 bg-sale/10 p-2 text-xs">
          <span className="font-semibold text-sale">This image is {dims!.w} × {dims!.h} px — it should be {fit.width} × {fit.height} px.</span>
          <button type="button" onClick={resizeCurrent} disabled={busy} className="btn btn-volt-outline h-8 px-3 text-xs">{busy ? "Resizing…" : `Resize to ${fit.width} × ${fit.height}`}</button>
          <span className="text-muted">Then click Save.</span>
        </div>
      )}
      {err && <p className="mt-1 text-xs font-semibold text-sale">{err}</p>}
      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-line p-2">
          {items === null ? <p className="text-xs text-muted">Loading…</p> : items.length === 0 ? (
            <p className="text-xs text-muted">No images in the Media library yet. Use “Upload new”.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((m) => {
                const ok = fits(m.width, m.height);
                return (
                <button key={m.id} type="button" disabled={!ok} onClick={() => { onChange(`/api/media/${m.id}`); setOpen(false); }}
                  className={`overflow-hidden rounded-md border text-left ${!ok ? "cursor-not-allowed opacity-40" : value === `/api/media/${m.id}` ? "border-volt" : "border-line hover:border-volt"}`}
                  title={ok ? m.title : `${m.title} — wrong size (needs ${fit!.width} × ${fit!.height} px)`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${m.id}`} alt={m.title} loading="lazy" className="aspect-[3/1] w-full object-cover" />
                  <span className={`block truncate px-1 py-0.5 text-[10px] ${ok ? "text-muted" : "text-sale"}`}>{m.width}×{m.height} · {Math.round(m.bytes / 1024)} KB{ok ? "" : " · wrong size"}</span>
                </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
