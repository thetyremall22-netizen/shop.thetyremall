import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { WhatsAppGateButton } from "@/components/WhatsAppGate";
import { Chevron, WhatsApp } from "@/components/icons";
import { shopHref, brandPath, WHEELS_CATEGORY } from "@/lib/shop-url";
import { similarFor, type Wanted } from "@/lib/retired-products";

/** An old product address whose product we no longer list: say so, and show
 *  the closest products we do sell (same size / rim first). */
export async function RetiredProduct({ wanted }: { wanted: Wanted | null }) {
  const { items, exact } = await similarFor(wanted, 8);
  const wheel = wanted?.kind === "wheel";
  const label = wanted?.label ?? "This product";
  const size = wanted?.width && wanted.rim ? (wanted.profile ? `${wanted.width}/${wanted.profile} R${wanted.rim}` : `${wanted.width} R${wanted.rim}`) : null;

  const links: { href: string; text: string }[] = [];
  if (!wheel && size) {
    const u = new URLSearchParams({ type: "tyre", width: wanted!.width!, rim: wanted!.rim! });
    if (wanted!.profile) u.set("profile", wanted!.profile);
    links.push({ href: shopHref(u), text: `All ${size} tyres` });
  }
  if (wheel) {
    const u = new URLSearchParams({ category: WHEELS_CATEGORY });
    if (wanted?.rim) u.set("rim", wanted.rim);
    links.push({ href: shopHref(u), text: wanted?.rim ? `All ${wanted.rim}" mag wheels` : "All mag wheels" });
  }
  if (wanted?.brand) links.push({ href: `/brand/${brandPath(wanted.brand).split("/").pop()}/`, text: `${wanted.brand} ${wheel ? "wheels" : "tyres"}` });
  if (!links.length) links.push({ href: "/shop", text: "Shop all tyres & wheels" });

  return (
    <div className="container-x py-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <Link href="/shop" className="hover:text-volt">Shop</Link>
        <Chevron width={12} height={12} />
        <span className="line-clamp-1 text-fg">{label}</span>
      </nav>

      <div className="mt-5 rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-ink-2 to-ink-2 p-6 sm:p-10">
        <span className="inline-flex items-center rounded-full bg-volt/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-volt ring-1 ring-volt/30">Currently unavailable</span>
        <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">{label}</h1>
        <p className="mt-3 max-w-2xl text-base text-muted">
          {wanted ? "This product isn't available on our new website right now" : "We couldn't find this product on our new website"}
          {exact ? <> — but we have <b className="text-fg">similar {wheel ? "mag wheels" : "tyres"}{size ? ` in ${size}` : wanted?.rim ? ` in ${wanted.rim}"` : ""}</b> ready to order below.</> : <>. Have a look at these instead, or ask us and we&apos;ll try to source it for you.</>}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {links.map((l) => <Link key={l.href} href={l.href} className="btn btn-volt h-11 px-5">{l.text}</Link>)}
          <WhatsAppGateButton
            message={`Hi The Tyre Mall! I'm looking for: ${label}. Can you help?`}
            lead={{ source: "whatsapp-enquiry", productName: label }}
            className="btn btn-ghost h-11 px-5">
            <WhatsApp width={18} height={18} /> Ask us to find it
          </WhatsAppGateButton>
        </div>
      </div>

      {items.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-3xl">{exact ? `Similar ${wheel ? "mag wheels" : "tyres"} you can buy today` : "Popular right now"}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
