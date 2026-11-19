import "server-only";
import { getSettings } from "./settings";

// Structured data (schema.org JSON-LD) for pages that aren't product pages:
// who The Tyre Mall is (home page) and where a listing sits (category pages).
// Product pages have their own Product markup in lib/merchant.ts.

const SITE = "https://thetyremall.co.za";

/** "0780088788" → "+27-78-008-8788" (schema.org prefers international format). */
function intlPhone(tel: string): string | undefined {
  const d = tel.replace(/\D/g, "");
  if (!d) return undefined;
  const local = d.startsWith("27") ? d.slice(2) : d.replace(/^0/, "");
  return `+27-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
}

/** Organization + WebSite (with the shop search) for the home page. */
export async function homeJsonLd() {
  const s = await getSettings();
  const phone = intlPhone(s.contact.phoneTel);
  const sameAs = Object.values(s.social).filter((u) => /^https?:\/\//.test(u));
  const address = s.contact.addressLines.split("\n").map((l) => l.trim()).filter(Boolean)[0];
  return [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${SITE}/#organization`,
      name: "The Tyre Mall",
      url: `${SITE}/`,
      logo: `${SITE}/brand/logo-real-sm.webp`,
      description: "South Africa's largest online tyre supplier: car, SUV, 4x4 and truck tyres and mag wheels, delivered nationwide.",
      ...(s.contact.email ? { email: s.contact.email } : {}),
      ...(phone ? { telephone: phone } : {}),
      ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "ZA" } } : {}),
      areaServed: { "@type": "Country", name: "South Africa" },
      ...(phone || s.contact.email
        ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", areaServed: "ZA", availableLanguage: "English", ...(phone ? { telephone: phone } : {}), ...(s.contact.email ? { email: s.contact.email } : {}) } }
        : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: "The Tyre Mall",
      url: `${SITE}/`,
      publisher: { "@id": `${SITE}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE}/shop?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** CollectionPage + breadcrumb for a listing page (category, brand, all tyres…). */
export function listingJsonLd(name: string, path: string) {
  const url = `${SITE}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    isPartOf: { "@id": `${SITE}/#website` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE}/shop` },
        { "@type": "ListItem", position: 3, name, item: url },
      ],
    },
  };
}

/** A <script type="application/ld+json"> body that can't break out of the tag. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
