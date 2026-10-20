import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ContentManager } from "@/components/admin/ContentManager";
import { HomeContentManager } from "@/components/admin/HomeContentManager";
import { PagesContentManager } from "@/components/admin/PagesContentManager";
import { getStoryRaw, getTeamSectionRaw, listStats, listTeam } from "@/lib/site-content";
import { readHomeRaw, HOME_DEFAULTS } from "@/lib/home-content";
import { readAllPagesRaw, PAGES } from "@/lib/page-content";
import { categories as BUILT_IN } from "@/lib/catalogue";
import { listSpecials, specialStatus } from "@/lib/special-categories";

export const instant = false;

const TABS = [
  { v: "home", label: "Home page" },
  { v: "story", label: "Our story & team" },
  { v: "pages", label: "Landing pages" },
];

export default async function AdminContent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("content.edit");
  // Landing pages are Super Admin only; Home page and Our story & team are
  // open to everyone who can edit content.
  const superAdmin = me.role === "super_admin";
  const sp = await searchParams;
  const tabs = TABS.filter((t) => t.v !== "pages" || superAdmin);
  const tab = tabs.some((t) => t.v === sp.tab) ? sp.tab! : "home";

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Website content</h1>
      <p className="mt-1 text-sm text-muted">Edit what customers see on the home page and the main landing pages. Product pages and the shop are managed in Products. Changes go live within a few seconds.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.v} href={t.v === "home" ? "/admin/content" : `/admin/content?tab=${t.v}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${tab === t.v ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="mt-6 max-w-4xl">
        {tab === "home" && await (async () => {
          const specials = await listSpecials();
          const categoryOptions = [
            ...specials.map((s) => ({ slug: s.slug, name: s.name, kind: s.kind, status: specialStatus(s) })),
            ...BUILT_IN.map((c) => ({ slug: c.slug, name: c.name, kind: "built-in" as const })),
          ];
          return <HomeContentManager initial={await readHomeRaw()} defaults={HOME_DEFAULTS} categoryOptions={categoryOptions} />;
        })()}
        {tab === "story" && await (async () => {
          const [story, teamSection, stats, team] = await Promise.all([getStoryRaw(), getTeamSectionRaw(), listStats(), listTeam()]);
          return <ContentManager story={story} teamSection={teamSection} stats={stats} team={team} />;
        })()}
        {tab === "pages" && <PagesContentManager pages={PAGES} initial={await readAllPagesRaw()} q={sp.q ?? ""} />}
      </div>
    </AdminShell>
  );
}
