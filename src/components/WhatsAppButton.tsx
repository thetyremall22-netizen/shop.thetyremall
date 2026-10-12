"use client";

import { formatPrice } from "@/lib/format";
import { whatsappHref } from "@/lib/shop-config";
import { WhatsApp } from "./icons";

export function WhatsAppButton({
  slug, name, sku, size, price, setPrice, className = "",
}: {
  slug: string;
  name: string;
  sku?: string;
  size?: string;
  price: number;
  setPrice?: number;
  className?: string;
}) {
  function go() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/product/${slug}`;
    const lines = [
      "Hi The Tyre Mall! I'd like to enquire about this tyre:",
      name,
      [size ? `Size: ${size}` : null, sku ? `SKU: ${sku}` : null].filter(Boolean).join(" · "),
      `Price: ${formatPrice(price)} per tyre${setPrice ? ` (Set of 4: ${formatPrice(setPrice)})` : ""}`,
      url,
    ].filter(Boolean);
    const message = lines.join("\n");

    // Log the enquiry (DB + email to the shop) — fire and forget.
    fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "whatsapp", productSlug: slug, productName: name, sku, price, productUrl: url, message }),
      keepalive: true,
    }).catch(() => {});

    window.open(whatsappHref(message), "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={go}
      className={`btn flex items-center justify-center gap-2 border border-[#25D366]/60 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 ${className}`}
    >
      <WhatsApp width={18} height={18} /> WhatsApp us
    </button>
  );
}
