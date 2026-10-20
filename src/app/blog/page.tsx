import type { Metadata } from "next";
import { PageHeader, PageExtras } from "@/components/PageContent";
import { pageMetadata } from "@/lib/page-content";
import Link from "next/link";
import Image from "next/image";
import { BLOG_POSTS } from "@/data/blog";

function CoverFallback({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 via-ink-2 to-ink p-6 text-center">
      <div>
        <div className="font-display text-sm uppercase tracking-[0.3em] text-volt">The Tyre Mall</div>
        <div className="mx-auto mt-2 h-px w-10 bg-volt/50" />
        <div className="mt-2 line-clamp-2 font-display text-lg text-fg/80">{title}</div>
      </div>
    </div>
  );
}

const BASE_META: Metadata = {
  title: "Blog — Tyre Tips, Guides & News",
  description:
    "The Tyre Mall blog — expert tyre guides, buying advice, safety tips and news for South African drivers, fleets and enthusiasts.",
  alternates: { canonical: "/blog" },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("blog", BASE_META);
}

export default function BlogPage() {
  const posts = BLOG_POSTS;
  const [featured, ...rest] = posts;

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="max-w-2xl">
        <PageHeader page="blog" className="" eyebrow="Tips, guides & news" silver="THE" green="BLOG"
          intro={<>Expert tyre advice for South African drivers — choosing, fitting, caring for and getting the most out
          of your tyres and wheels.</>} />
      </div>
      <PageExtras page="blog" position="top" />

      {posts.length === 0 ? (
        <p className="mt-10 text-muted">New articles are on the way. Check back soon.</p>
      ) : (
        <>
          {/* featured */}
          <Link href={`/blog/${featured.slug}`} className="group mt-10 block overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="grid lg:grid-cols-2">
              <div className="relative aspect-[16/10] overflow-hidden">
                {featured.cover ? (
                  <Image src={featured.cover} alt={featured.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:1024px) 100vw, 50vw" />
                ) : (
                  <CoverFallback title={featured.title} />
                )}
              </div>
              <div className="flex flex-col justify-center p-6 lg:p-8">
                <span className="eyebrow">Latest · {featured.date}</span>
                <h2 className="mt-2 font-display text-2xl text-fg group-hover:text-volt sm:text-3xl">{featured.title}</h2>
                <p className="mt-3 text-sm text-muted">{featured.excerpt}</p>
                <span className="mt-4 text-sm font-bold text-volt">Read article →</span>
              </div>
            </div>
          </Link>

          {/* grid */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="group card glow-hover overflow-hidden p-0">
                <div className="relative aspect-[16/10] overflow-hidden">
                  {p.cover ? (
                    <Image src={p.cover} alt={p.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:640px) 100vw, 33vw" />
                  ) : (
                    <CoverFallback title={p.title} />
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">{p.date}</span>
                  <h3 className="mt-1 font-display text-lg text-fg group-hover:text-volt">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      <PageExtras page="blog" position="bottom" className="mt-10" />
    </div>
  );
}
