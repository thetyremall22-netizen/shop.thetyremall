// Client-side: downscale + re-encode an image to WebP under the media library's
// size limits before upload (keeps the site fast).
export interface Limits { maxBytes: number; targetBytes: number; maxDim: number }

/** The media library's limits (mirrors MAX_IMAGE_BYTES etc. in lib/media). */
export const MEDIA_LIMITS: Limits = { maxBytes: 300_000, targetBytes: 250_000, maxDim: 2000 };

/** Downscale + re-encode an image file to WebP under the byte target. */
export async function compressImage(file: File, L: Limits): Promise<{ dataUrl: string; width: number; height: number } | { error: string }> {
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
