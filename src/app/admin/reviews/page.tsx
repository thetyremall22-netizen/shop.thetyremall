import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { getRatingSummary, listReviews } from "@/lib/reviews";

export const instant = false;

export default async function AdminReviews() {
  await requirePermission("content.edit");
  const [summary, reviews] = await Promise.all([getRatingSummary(), listReviews()]);
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Reviews &amp; ratings</h1>
      <p className="mt-1 text-sm text-muted">The homepage star rating and the customer testimonials. Changes appear on the storefront within a few seconds.</p>
      <div className="mt-6">
        <ReviewsManager summary={summary} reviews={reviews} />
      </div>
    </AdminShell>
  );
}
