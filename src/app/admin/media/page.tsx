import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";
import { listMedia, MAX_IMAGE_BYTES, IMAGE_TARGET_BYTES, MAX_IMAGE_DIMENSION } from "@/lib/media";

export const instant = false;

export default async function AdminMedia({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("content.edit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, totalBytes, perPage } = await listMedia({ page, perPage: 24 });
  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Media</h1>
      <p className="mt-1 text-sm text-muted">Images and videos for the site. Images are auto-compressed on upload so the store stays fast; videos embed from YouTube. Every item is listed here to download or delete.</p>
      <div className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        <b className="text-fg">Where do these show on the website?</b> Images appear wherever you choose them:
        home page marketing banners, the hero background and the Tyres/Wheels tiles (<a href="/admin/content" className="font-semibold text-volt hover:underline">Content → Home page</a>),
        and banners on landing pages (<a href="/admin/content?tab=pages" className="font-semibold text-volt hover:underline">Content → Landing pages</a>).
        For a YouTube video on the home page, paste its link in Content → Home page → Featured video. Uploading here on its own doesn&apos;t change the website.
      </div>
      <div className="mt-6">
        <MediaManager
          items={rows}
          total={total}
          totalBytes={totalBytes}
          page={page}
          pages={pages}
          limits={{ maxBytes: MAX_IMAGE_BYTES, targetBytes: IMAGE_TARGET_BYTES, maxDim: MAX_IMAGE_DIMENSION }}
        />
      </div>
    </AdminShell>
  );
}
