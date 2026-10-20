"use client";

import { formatPrice } from "@/lib/format";
import { WhatsApp } from "./icons";
import { WhatsAppGateButton } from "./WhatsAppGate";

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
  const productUrl = typeof window !== "undefined" ? `${window.location.origin}/product/${slug}` : `/product/${slug}`;
  const message = () =>
    [
      "Hi The Tyre Mall! I'd like to enquire about this tyre:",
      name,
      [size ? `Size: ${size}` : null, sku ? `SKU: ${sku}` : null].filter(Boolean).join(" · "),
      `Price: ${formatPrice(price)} per tyre${setPrice ? ` (Set of 4: ${formatPrice(setPrice)})` : ""}`,
      productUrl,
    ].filter(Boolean).join("\n");

  return (
    <WhatsAppGateButton
      message={message}
      lead={{ source: "whatsapp-enquiry", productName: name, sku, price, productUrl }}
      className={`btn flex items-center justify-center gap-2 border border-[#25D366]/60 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 ${className}`}
    >
      <WhatsApp width={18} height={18} /> WhatsApp us
    </WhatsAppGateButton>
  );
}
