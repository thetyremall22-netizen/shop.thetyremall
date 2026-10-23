#!/usr/bin/env python3
"""Old WooCommerce products that aren't in the new shop (from a Merchant Center
"Product page unavailable" issue report CSV) → src/data/retired-products.json.

Each gets its old address, /product/<slug>, worked out the way the old site
made product slugs from titles, so old links (Google Shopping, search, ads)
land on a "no longer available — here are similar products" page instead of a
dead end.   Usage:  python3 scripts/import-retired-products.py report.csv
"""
import csv, json, os, re, sqlite3, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "src", "data", "retired-products.json")

def slug(title: str) -> str:
    s = title.lower().replace("&amp;", "").replace("&", "")
    s = re.sub(r"[^a-z0-9\s/._-]", "", s)
    s = re.sub(r"[\s/._]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")

rows = list(csv.reader(open(sys.argv[1], encoding="utf-8-sig")))
head = next(i for i, r in enumerate(rows) if r and r[0] == "Product ID")
live = set()
db = os.path.join(ROOT, ".data", "ttm.db")
if os.path.exists(db):
    live = {r[0] for r in sqlite3.connect(f"file:{db}?mode=ro", uri=True).execute("SELECT id FROM products")}
existing = json.load(open(OUT)) if os.path.exists(OUT) else []
out = {r["id"]: r for r in existing}
for r in rows[head + 1:]:
    m = re.match(r"gla_(\d+)$", r[0].strip())
    if not m or int(m.group(1)) in live:
        continue
    pid = int(m.group(1))
    out[pid] = {"id": pid, "title": r[1].strip(), "slug": slug(r[1])}
data = sorted(out.values(), key=lambda x: x["id"])
json.dump(data, open(OUT, "w"), separators=(",", ":"))
print(f"{len(data)} retired products → {os.path.relpath(OUT, ROOT)}")
