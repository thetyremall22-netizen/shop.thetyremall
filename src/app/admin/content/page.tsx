import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ContentManager } from "@/components/admin/ContentManager";
import { getStoryRaw, getTeamSectionRaw, listStats, listTeam } from "@/lib/site-content";

export const instant = false;

export default async function AdminContent() {
  await requirePermission("content.edit");
  const [story, teamSection, stats, team] = await Promise.all([getStoryRaw(), getTeamSectionRaw(), listStats(), listTeam()]);
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Homepage content</h1>
      <p className="mt-1 text-sm text-muted">The &quot;Our Story&quot; text, the stat tiles, and the Meet the Team section. Changes appear on the storefront within a few seconds.</p>
      <div className="mt-6 max-w-3xl">
        <ContentManager story={story} teamSection={teamSection} stats={stats} team={team} />
      </div>
    </AdminShell>
  );
}
