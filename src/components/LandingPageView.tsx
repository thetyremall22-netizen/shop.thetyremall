import Image from "next/image";
import Link from "next/link";
import { queryProducts } from "@/lib/catalogue";
import { findCategory, getSpecialBySlug } from "@/lib/special-categories";
import { SpecialEnded } from "@/components/SpecialEnded";
import { categoryPath } from "@/lib/shop-url";
import { videoSource, type LandingPage, type PageSection } from "@/lib/landing-pages";
import { ProductCard } from "@/components/ProductCard";
import { LinkedText } from "@/components/LinkedText";
import { Chevron } from "@/components/icons";

/** A landing page made in Admin → Pages: banner, then its sections in order. */
export function LandingPageView({ page }: { page: LandingPage }) {
  return (
    <div className="container-x py-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <span className="line-clamp-1 text-fg">{page.title}</span>
      </nav>

      <div className="relative mt-4 overflow-hidden rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-ink-2 to-ink-2">
        {page.heroImage && (
          <Image src={page.heroImage} alt="" fill fetchPriority="high" loading="eager" unoptimized={!page.heroImage.startsWith("/")} sizes="100vw" className="object-cover opacity-35" />
        )}
        <div className="relative p-8 sm:p-12">
          <h1 className="skew-italic font-display text-4xl leading-[0.95] sm:text-6xl">{page.title}</h1>
          {page.subtitle && <p className="mt-4 max-w-2xl text-base text-fg/85 sm:text-lg">{page.subtitle}</p>}
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {page.sections.map((s) => <Section key={s.id} s={s} />)}
      </div>
    </div>
  );
}

function Heading({ text }: { text?: string }) {
  return text ? <h2 className="font-display text-3xl">{text}</h2> : null;
}

async function Section({ s }: { s: PageSection }) {
  if (s.type === "text") {
    const paras = (s.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (!s.heading && !paras.length) return null;
    return (
      <section className="card p-6 sm:p-8">
        <Heading text={s.heading} />
        <div className={`${s.heading ? "mt-4 " : ""}max-w-3xl space-y-4 text-[15px] leading-relaxed text-fg/90`}>
          {paras.map((p, i) => <p key={i} className="whitespace-pre-line"><LinkedText text={p} linkClassName="font-semibold text-volt hover:underline" /></p>)}
        </div>
      </section>
    );
  }

  if (s.type === "image") {
    if (!s.image) return null;
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.image} alt={s.alt || s.heading || ""} loading="lazy" className="w-full rounded-2xl border border-line object-cover" />
    );
    return (
      <section>
        <Heading text={s.heading} />
        <figure className={s.heading ? "mt-4" : ""}>
          {s.link ? <a href={s.link} {...(/^https?:/i.test(s.link) ? { target: "_blank", rel: "noopener" } : {})}>{img}</a> : img}
          {s.caption && <figcaption className="mt-2 text-sm text-muted">{s.caption}</figcaption>}
        </figure>
      </section>
    );
  }

  if (s.type === "video") {
    const v = s.video ? videoSource(s.video) : null;
    if (!v) return null;
    return (
      <section>
        <Heading text={s.heading} />
        <div className={`${s.heading ? "mt-4 " : ""}aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black`}>
          {v.kind === "iframe"
            ? <iframe src={v.src} title={s.heading || "Video"} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            : <video src={v.src} controls preload="metadata" className="h-full w-full" />}
        </div>
        {s.caption && <p className="mt-2 text-sm text-muted">{s.caption}</p>}
      </section>
    );
  }

  // products from a category (built-in, special or sale)
  if (!s.category) return null;
  const cat = await findCategory(s.category);
  const heading = s.heading || cat?.name || "Shop the specials";
  if (!cat) {
    // The special/sale has ended (or not started): say so and show current deals.
    const special = await getSpecialBySlug(s.category);
    if (special) return <SpecialEnded special={special} limit={s.limit ?? 8} heading={s.heading || special.name} />;
    return (
      <section className="card p-6 sm:p-8">
        <Heading text={heading} />
        <p className="mt-2 text-sm text-muted">These specials aren&apos;t running right now. <Link href="/shop" className="font-semibold text-volt hover:underline">Browse the shop →</Link></p>
      </section>
    );
  }
  const result = await queryProducts({ category: cat.slug, perPage: s.limit ?? 12, page: 1, inStock: false });
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading text={heading} />
        {result.total > result.items.length && (
          <Link href={categoryPath(cat.slug)} className="text-sm font-bold text-volt hover:underline">View all {result.total.toLocaleString()} →</Link>
        )}
      </div>
      {s.body && <p className="mt-2 max-w-3xl text-sm text-muted"><LinkedText text={s.body} linkClassName="font-semibold text-volt hover:underline" /></p>}
      {result.items.length ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No products in this category yet. <Link href="/shop" className="font-semibold text-volt hover:underline">Browse the shop →</Link></p>
      )}
    </section>
  );
}
