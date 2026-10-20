import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BLOG_POSTS } from "@/data/blog";

const SITE = "https://thetyremall.co.za";

export const instant = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: "Article not found" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.excerpt, images: post.cover ? [post.cover] : [] },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.iso || undefined,
    image: post.cover ? [`${SITE}${post.cover}`] : undefined,
    author: { "@type": "Organization", name: "The Tyre Mall" },
    publisher: { "@type": "Organization", name: "The Tyre Mall" },
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  return (
    <article className="container-x py-10 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      <nav className="text-sm text-muted">
        <Link href="/blog" className="hover:text-volt">← All articles</Link>
      </nav>

      <header className="mx-auto mt-4 max-w-3xl">
        <span className="eyebrow">{post.date}</span>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted">{post.excerpt}</p>}
      </header>

      {post.cover && (
        <div className="relative mx-auto mt-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-2xl border border-line bg-ink-2">
          <Image src={post.cover} alt={post.title} fill className="object-cover" sizes="(max-width:1024px) 100vw, 1024px" priority />
        </div>
      )}

      <div
        className="prose-ttm mx-auto mt-8 max-w-3xl"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {more.length > 0 && (
        <div className="mx-auto mt-14 max-w-5xl border-t border-line pt-8">
          <h2 className="font-display text-2xl">More from the blog</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {more.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="group card glow-hover p-5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">{p.date}</span>
                <h3 className="mt-1 font-display text-lg text-fg group-hover:text-volt">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
