"""Refresh src/data/products.json from a WooCommerce CSV export.

- Existing products (matched by slug): update price / stock / onSale only; keep
  their derived fields (brand, type, specs, image, descriptions, categories, id).
- New products (not in the current catalogue): build a full record from the CSV.
- Products no longer in the published CSV set are dropped.
- Also rewrites meta.json counts and refreshes categories.json counts.

Usage: python3 -I scripts/update_catalogue.py <csv> [products.json] [out_dir]
Prints the new slugs + their image URLs (TAB-separated) to stderr for the image
fetch step, and a summary to stdout.
"""
import csv, json, re, sys, html
from collections import Counter

CSV = sys.argv[1]
PRODUCTS = sys.argv[2] if len(sys.argv) > 2 else "src/data/products.json"
OUT = sys.argv[3] if len(sys.argv) > 3 else "src/data"

cur = json.load(open(PRODUCTS))
cur_by_slug = {p["slug"]: p for p in cur}
cats = json.load(open(f"{OUT}/categories.json"))
name_to_slug = {c["name"].strip().lower(): c["slug"] for c in cats}


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def minor(s):
    s = (s or "").strip()
    try:
        return round(float(s) * 100)
    except ValueError:
        return 0


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def first_image_url(field):
    if not field:
        return None
    seg = field.split("|")[0]
    url = seg.split(" ! ")[0].strip()
    return url if url.startswith("http") else None


def cat_slugs(field):
    out = []
    for raw in (field or "").split("|"):
        name = raw.strip().split(">")[-1].strip()
        if not name:
            continue
        slug = name_to_slug.get(name.lower()) or slugify(name)
        if slug not in out:
            out.append(slug)
    return out


rows = list(csv.DictReader(open(CSV, newline="", encoding="utf-8", errors="replace")))
published = [r for r in rows if r.get("post_status") == "Published" and not (r.get("post_parent") or "").strip()]
csv_by_slug = {}
for r in published:
    s = (r.get("post_name") or "").strip()
    if s and s not in csv_by_slug:
        csv_by_slug[s] = r

out_products = []
new_images = []  # (slug, url)
updated_price = updated_stock = new_count = kept_untouched = 0


def row_fields(r):
    reg = minor(r.get("regular_price"))
    sale_raw = (r.get("sale_price") or "").strip()
    sale = minor(sale_raw) if sale_raw else reg
    on_sale = bool(sale_raw and 0 < sale < reg)
    price = sale if on_sale else reg
    in_stock = (r.get("stock_status") or "").strip() == "instock"
    try:
        qty = int(float(r.get("stock") or ""))
    except ValueError:
        qty = None
    return reg, sale, on_sale, price, in_stock, qty


# 1. Keep EVERY current product (wheels + tyres not in this export stay intact),
#    overlaying price/stock from the CSV where the slug matches.
for p0 in cur:
    r = csv_by_slug.get(p0["slug"])
    if not r:
        out_products.append(p0)  # not in the tyre export → leave untouched (e.g. mag wheels)
        kept_untouched += 1
        continue
    reg, sale, on_sale, price, in_stock, qty = row_fields(r)
    p = dict(p0)
    if reg > 0:
        if p.get("price") != price or p.get("regularPrice") != reg:
            updated_price += 1
        p["price"], p["regularPrice"], p["salePrice"], p["onSale"] = price, reg, sale, on_sale
    if p.get("inStock") != in_stock or p.get("stockQty") != qty:
        updated_stock += 1
    p["inStock"], p["stockQty"] = in_stock, qty
    out_products.append(p)

# 2. Add products new in the CSV.
for slug, r in csv_by_slug.items():
    if slug in cur_by_slug:
        continue
    reg, sale, on_sale, price, in_stock, qty = row_fields(r)
    if True:
        new_count += 1
        title = (r.get("post_title") or "").strip()
        catslugs = cat_slugs(r.get("tax:product_cat"))
        is_wheel = any("mag" in c or "wheel" in c for c in catslugs) or "mag" in title.lower()
        w = (r.get("attribute:pa_tyre-width") or "").strip()
        pr = (r.get("attribute:pa_tyre-profile") or "").strip()
        rim = (r.get("attribute:pa_rim-size") or "").strip()
        size = f"{w}/{pr}R{rim}" if (w and pr and rim) else ((r.get("attribute:pa_tyre-size") or "").strip())
        specs = {"width": w, "profile": pr, "rim": rim, "size": size}
        brand = (r.get("tax:pwb-brand") or "").split("|")[0].strip() or title.split(" ")[0].title()
        try:
            pid = int(r.get("ID") or "0")
        except ValueError:
            pid = 0
        img_url = first_image_url(r.get("images"))
        img_path = f"/products/{slug}.webp" if img_url else None
        if img_url:
            new_images.append((slug, img_url))
        out_products.append({
            "id": pid, "name": title, "slug": slug, "sku": (r.get("sku") or "").strip(),
            "brand": brand, "type": "wheel" if is_wheel else "tyre",
            "price": price, "regularPrice": reg, "salePrice": sale, "onSale": on_sale,
            "image": img_path, "thumb": img_path,
            "shortDescription": strip_html(r.get("post_excerpt"))[:220],
            "description": strip_html(r.get("post_content")),
            "categories": catslugs, "specs": specs,
            "inStock": in_stock, "stockQty": qty, "rating": 0, "reviews": 0,
        })

# ---- write products.json ----
json.dump(out_products, open(f"{OUT}/products.json", "w"), ensure_ascii=False, separators=(",", ":"))

# ---- regenerate meta.json ----
def numsort(xs):
    return sorted({x for x in xs if x}, key=lambda v: (float(re.sub(r"[^0-9.]", "", v) or 1e9), v))

tyres = [p for p in out_products if p["type"] == "tyre"]
wheels = [p for p in out_products if p["type"] == "wheel"]
brandc = Counter(p["brand"] for p in out_products if p.get("brand"))
meta = {
    "productCount": len(out_products),
    "brands": [{"name": n, "count": c} for n, c in brandc.most_common()],
    "widths": numsort(p["specs"].get("width", "") for p in tyres),
    "profiles": numsort(p["specs"].get("profile", "") for p in tyres),
    "rims": numsort(p["specs"].get("rim", "") for p in tyres),
    "wheelRims": numsort(p["specs"].get("rim", "") for p in wheels),
    "wheelWidths": numsort(p["specs"].get("width", "") for p in wheels),
    "wheelBrands": sorted({p["brand"] for p in wheels if p.get("brand")}),
    "pcds": sorted({p["specs"].get("pcd", "") for p in wheels if p["specs"].get("pcd")}),
    "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
}
json.dump(meta, open(f"{OUT}/meta.json", "w"), ensure_ascii=False, indent=2)

# ---- refresh category counts ----
catcount = Counter()
for p in out_products:
    for c in p.get("categories", []):
        catcount[c] += 1
for c in cats:
    c["count"] = catcount.get(c["slug"], 0)
json.dump(cats, open(f"{OUT}/categories.json", "w"), ensure_ascii=False, indent=2)

kept_not_in_csv = sum(1 for p in out_products if p["slug"] not in csv_by_slug)
print(f"products: {len(out_products)} (new {new_count}, price-updated {updated_price}, stock-updated {updated_stock}, kept-not-in-export {kept_not_in_csv})")
print(f"brands: {len(meta['brands'])} | tyres {len(tyres)} | wheels {len(wheels)}")
print(f"new products needing images: {len(new_images)}")
for slug, url in new_images:
    sys.stderr.write(f"{slug}\t{url}\n")
