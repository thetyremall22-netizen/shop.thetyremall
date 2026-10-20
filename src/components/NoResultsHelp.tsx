"use client";

import Link from "next/link";
import { SHOP_EMAIL, SHOP_PHONE_DISPLAY } from "@/lib/shop-config";
import { WhatsApp } from "./icons";
import { WhatsAppGateButton } from "./WhatsAppGate";

const GREETING =
  "Hey! 👋 I see you couldn't find what you were looking for — I'm here to help! Tell me your tyre size (like 205/55R16) or your vehicle, and I'll find it. Or reach our sales team any time.";

export function NoResultsHelp({ query }: { query?: string }) {
  const waText = query
    ? `Hi The Tyre Mall! I searched for "${query}" but couldn't find it — can you help?`
    : "Hi The Tyre Mall! I couldn't find the tyre I was looking for — can you help?";

  function openTyrone() {
    window.dispatchEvent(new CustomEvent("ttm:tyrone", { detail: { botSay: GREETING } }));
  }

  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-volt/15 text-2xl">🔍</div>
      <h2 className="mt-4 font-display text-2xl">No results{query ? <> for &ldquo;{query}&rdquo;</> : ""}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Don&apos;t worry — we stock 7,000+ tyres &amp; mags and can get almost anything. Let Tyrone help, or talk
        to our sales team directly.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <button onClick={openTyrone} className="btn btn-volt h-11 px-5">💬 Chat with Tyrone</button>
        <WhatsAppGateButton
          message={waText}
          lead={{ source: "whatsapp-chat" }}
          className="btn h-11 border border-[#25D366]/60 bg-[#25D366]/10 px-5 text-[#25D366] hover:bg-[#25D366]/20"
        >
          <WhatsApp width={17} height={17} /> WhatsApp us
        </WhatsAppGateButton>
        <a href={`mailto:${SHOP_EMAIL}?subject=${encodeURIComponent(`Tyre enquiry${query ? ` — ${query}` : ""}`)}`} className="btn btn-ghost h-11 px-5">
          Email sales
        </a>
      </div>

      <p className="mt-4 text-xs text-muted">
        <a href={`mailto:${SHOP_EMAIL}`} className="font-semibold text-fg hover:text-volt">{SHOP_EMAIL}</a>
        {" · "}
        <a href="tel:0780088788" className="font-semibold text-fg hover:text-volt">{SHOP_PHONE_DISPLAY}</a>
        {" · Mon–Fri 8am–5pm"}
      </p>

      <Link href="/shop" className="mt-5 inline-block text-sm font-bold text-volt hover:underline">Browse all tyres →</Link>
    </div>
  );
}
