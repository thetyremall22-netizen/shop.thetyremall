"use client";

import { useEffect, useState } from "react";
import { Phone } from "./icons";

/** Tap-to-call on mobile only (item 41). On desktop the number is shown as
 *  plain text. Each mobile tap is logged for the weekly branch digest. */
export function StoreCallLink({
  storeId, storeName, phone, phoneTel,
}: { storeId: string; storeName: string; phone: string; phoneTel: string }) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    try {
      setMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    } catch {}
  }, []);

  function log() {
    fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "call", storeId, storeName }),
      keepalive: true,
    }).catch(() => {});
  }

  const inner = (
    <>
      <Phone width={16} height={16} className="text-volt" /> {phone}
    </>
  );

  if (mobile) {
    return (
      <a href={`tel:${phoneTel}`} onClick={log} className="inline-flex items-center gap-2 font-semibold text-fg hover:text-volt">
        {inner}
      </a>
    );
  }
  return <span className="inline-flex items-center gap-2 font-semibold text-fg" title="Tap to call on mobile">{inner}</span>;
}
