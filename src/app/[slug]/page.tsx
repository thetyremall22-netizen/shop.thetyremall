import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedLandingPage, publishedLandingSlugs } from "@/lib/landing-pages";
import { LandingPageView } from "@/components/LandingPageView";

// Landing pages made in Admin → Pages, at thetyremall.co.za/<address>.
// The site's own pages (/about, /shop, /faq …) always come first; only an
// address that isn't one of those reaches here, and it shows a landing page
// only if one is published at that address — otherwise the normal "not found".
// Built on first visit and kept, then rebuilt the moment the page is saved.
export const instant = false;
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const slugs = await publishedLandingSlugs();
  // Cache Components needs at least one entry; this one is simply "not found".
  return (slugs.length ? slugs : ["ttm-landing-placeholder"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPublishedLandingPage(decodeURIComponent((await params).slug).toLowerCase());
  if (!page) return { title: "Page not found" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.subtitle || undefined,
    alternates: { canonical: `/${page.slug}` },
    openGraph: page.heroImage ? { images: [{ url: page.heroImage }] } : undefined,
  };
}

export default async function LandingPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPublishedLandingPage(decodeURIComponent((await params).slug).toLowerCase());
  if (!page) notFound();
  return <LandingPageView page={page} />;
}
