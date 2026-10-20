import type { Metadata } from "next";
import { Suspense } from "react";
import { RecoverCart } from "@/components/RecoverCart";

export const metadata: Metadata = { title: "Restoring your cart", robots: { index: false, follow: false } };

export default function RecoverPage() {
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-16 text-center">
      <Suspense fallback={<p className="text-muted">Restoring your cart…</p>}>
        <RecoverCart />
      </Suspense>
    </div>
  );
}
