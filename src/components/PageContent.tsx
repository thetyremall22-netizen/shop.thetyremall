import Link from "next/link";
import type { ReactNode } from "react";
import { getPageContent, type PageOverride } from "@/lib/page-content";
import { cleanShopLink } from "@/lib/shop-url";

/** Inline formatting for admin-written text: **bold** and [link](url). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:|tel:)[^\s)]+)\)/g;
  let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${n++}`} className="text-fg">{m[1]}</strong>);
    else {
      const href = cleanShopLink(m[3]);
      out.push(/^\//.test(href)
        ? <Link key={`${keyBase}-${n++}`} href={href} className="font-semibold text-volt hover:underline">{m[2]}</Link>
        : <a key={`${keyBase}-${n++}`} href={href} className="font-semibold text-volt hover:underline" {...(/^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Simple, safe text formatting: "## " heading, "- " bullets, blank line = new
 *  paragraph, **bold**, [link text](/page or https://…). No raw HTML. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-muted sm:text-base ${className}`}>
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h3 key={i} className="font-display text-xl text-fg">{inline(b.slice(3), `h${i}`)}</h3>;
        const lines = b.split("\n");
        if (lines.every((l) => /^[-•]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-•]\s+/, ""), `l${i}-${j}`)}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, `p${i}-${j}`)}</span>)}</p>;
      })}
    </div>
  );
}

/** Landing page header. Shows the admin's text where set, else the page's
 *  built-in text (passed as props). */
export async function PageHeader({
  page, eyebrow, silver, green, intro, className = "max-w-2xl", h1Class = "skew-italic mt-1 font-display text-5xl leading-[0.9] sm:text-7xl", introClass = "mt-4 text-base text-muted sm:text-lg", eyebrowNode, children,
}: {
  page: string; eyebrow?: string; silver: string; green: string; intro?: ReactNode; className?: string; h1Class?: string; introClass?: string;
  /** Custom eyebrow element (e.g. a pill) used when the admin hasn't set one. */
  eyebrowNode?: ReactNode;
  children?: ReactNode;
}) {
  const o = await getPageContent(page);
  return (
    <div className={className}>
      {o.eyebrow ? <span className="eyebrow">{o.eyebrow}</span> : eyebrowNode ?? (eyebrow ? <span className="eyebrow">{eyebrow}</span> : null)}
      <h1 className={h1Class}>
        <span className="text-chrome">{o.silver || silver}</span> <span className="text-volt-grad">{o.green || green}</span>
      </h1>
      {o.intro ? <div className={introClass}><RichText text={o.intro} className="!text-[length:inherit] !text-muted" /></div> : intro ? <p className={introClass}>{intro}</p> : null}
      {children}
    </div>
  );
}

/** Optional admin banner + extra content block for a landing page. */
export async function PageExtras({ page, position, className = "mt-8" }: { page: string; position: "top" | "bottom"; className?: string }) {
  const o: PageOverride = await getPageContent(page);
  const showBanner = position === "top" && o.banner.src;
  const showExtra = o.extraPosition === position && (o.extraHeading || o.extraBody);
  if (!showBanner && !showExtra) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={o.banner.src} alt={o.banner.alt} width={2000} height={668} loading="lazy" className="h-auto w-full" />
  );
  return (
    <div className={`space-y-6 ${className}`}>
      {showBanner && (
        <div className="overflow-hidden rounded-2xl border border-line">
          {o.banner.href
            ? (/^\//.test(o.banner.href) ? <Link href={o.banner.href} aria-label={o.banner.alt}>{img}</Link> : <a href={o.banner.href} target="_blank" rel="noopener noreferrer" aria-label={o.banner.alt}>{img}</a>)
            : img}
        </div>
      )}
      {showExtra && (
        <section className="card p-6">
          {o.extraHeading && <h2 className="font-display text-2xl text-volt">{o.extraHeading}</h2>}
          {o.extraBody && <RichText text={o.extraBody} className={o.extraHeading ? "mt-3" : ""} />}
        </section>
      )}
    </div>
  );
}
