"use client";

import Link from "next/link";

export function ProductsToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/admin/products/new" className="btn btn-volt h-9 px-4 text-sm">+ Add product</Link>
      <a href="/api/admin/products/export" className="btn btn-ghost h-9 px-4 text-sm">Export CSV</a>
      <Link href="/admin/products/import" className="btn btn-ghost h-9 px-4 text-sm">Import CSV</Link>
    </div>
  );
}
