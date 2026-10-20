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

/** Brand logos: every logo uses the same shape as the built-in ones (320 × 208,
 *  stored at 2× = 640 × 416 for sharp screens). */
export interface Canvas { width: number; height: number; padding: number; maxBytes: number; mode?: "contain" | "cover"; label?: string }

export const LOGO_CANVAS: Canvas = { width: 640, height: 416, padding: 0.08, maxBytes: 80_000, mode: "contain", label: "640 × 416 px (3:2)" };
// Home page images — the same sizes as the artwork already on the site. Uploads
// are cropped to fill the shape from the centre and compressed to ≤300 KB.
export const BANNER_CANVAS: Canvas = { width: 2000, height: 668, padding: 0, maxBytes: 300_000, mode: "cover", label: "2000 × 668 px (3:1)" };
export const TILE_CANVAS: Canvas = { width: 2000, height: 750, padding: 0, maxBytes: 300_000, mode: "cover", label: "2000 × 750 px (8:3)" };
export const HERO_CANVAS: Canvas = { width: 1920, height: 820, padding: 0, maxBytes: 300_000, mode: "cover", label: "1920 × 820 px" };

/** Guidance text shown beside an upload for a fixed-size image. */
export function canvasHint(c: Canvas, extra = ""): string {
  return c.mode === "cover"
    ? `Size: ${c.label}. Any photo is cropped to this exact shape from the centre and compressed to ${Math.round(c.maxBytes / 1000)} KB or less automatically, so keep important text and products near the middle. JPG, PNG or WebP.${extra ? " " + extra : ""}`
    : `Size: ${c.label}. Any logo is fitted onto this shape automatically.${extra ? " " + extra : ""}`;
}

/** Fit any image (any size or shape) centred inside a fixed canvas with even
 *  padding and a transparent background, so uploads all come out uniform. */
export async function fitImageToCanvas(
  file: File,
  c: Canvas,
): Promise<{ dataUrl: string; width: number; height: number } | { error: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read that image."));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = c.width; canvas.height = c.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { error: "Your browser couldn't process that image." };
    const boxW = c.width * (1 - 2 * c.padding), boxH = c.height * (1 - 2 * c.padding);
    // contain = whole image inside the box (logos); cover = fill the shape and
    // crop the overflow from the centre (banners, tiles, hero).
    const scale = c.mode === "cover"
      ? Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight)
      : Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, Math.round((c.width - w) / 2), Math.round((c.height - h) / 2), w, h);
    let q = 0.9;
    let dataUrl = canvas.toDataURL("image/webp", q);
    const bytesOf = (d: string) => Math.floor(((d.split(",")[1] || "").length * 3) / 4);
    while (bytesOf(dataUrl) > c.maxBytes && q > 0.35) { q -= 0.08; dataUrl = canvas.toDataURL("image/webp", q); }
    if (bytesOf(dataUrl) > c.maxBytes) return { error: c.mode === "cover" ? "That image is too detailed to get under the size limit. Try a simpler image." : "That logo is too detailed to compress. Try a simpler PNG or SVG export." };
    return { dataUrl, width: c.width, height: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
