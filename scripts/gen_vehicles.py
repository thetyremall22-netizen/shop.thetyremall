"""Ingest the per-year vehicle fitment data from Vehicle_Simulator_SA_Master.xlsx
(sheet 'Simulator Master', one row = one vehicle YEAR) into src/data/vehicles.json.

Groups rows by make/model/generation/trim AND the exact fitment (tyre + rim options
+ pcd) so rows with different sizes are never merged, and records the DISCRETE years
present for each group (gaps preserved — never a yearFrom..yearTo range). Pipe-packed
cells ("225/55 R17|225/50 R18") are split into separate options.

Usage: python3 scripts/gen_vehicles.py <xlsx> <out.json> [public_vehicles_dir]
"""
import openpyxl, json, re, sys, os
from collections import OrderedDict

SRC = sys.argv[1]
OUT = sys.argv[2]
IMG_DIR = sys.argv[3] if len(sys.argv) > 3 else "public/vehicles"

have_imgs = set()
if os.path.isdir(IMG_DIR):
    have_imgs = {os.path.splitext(f)[0] for f in os.listdir(IMG_DIR)}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") if s else ""


def norm_size(s):
    return re.sub(r"\s+", " ", s).strip()


def split_cell(v):
    """Pipe-packed cell -> list of normalised size strings (deduped, order kept)."""
    if not v:
        return []
    out = []
    for part in str(v).split("|"):
        p = norm_size(part)
        if p and p.lower() != "none" and p not in out:
            out.append(p)
    return out


wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb["Simulator Master"]
rows = ws.iter_rows(values_only=True)
hdr = next(rows)
idx = {name: i for i, name in enumerate(hdr)}


def g(r, name):
    v = r[idx[name]]
    s = str(v).strip() if v is not None else ""
    return s if s and s.lower() != "none" else None


groups = OrderedDict()
for r in rows:
    make = g(r, "Make"); model = g(r, "Model")
    if not make or not model:
        continue
    gen = g(r, "Generation")
    trim = g(r, "Engine / Trim")

    tyres = []
    for col in ("OE Tyre Size (Option 1)", "Tyre Size (Option 2)", "Tyre Size (Option 3)"):
        for t in split_cell(g(r, col)):
            if t not in tyres:
                tyres.append(t)
    rims = []
    for col in ("OE Rim Size (Option 1)", "Rim Size (Option 2)", "Rim Size (Option 3)"):
        for t in split_cell(g(r, col)):
            if t not in rims:
                rims.append(t)
    pcd = g(r, "PCD (Bolt Pattern)")

    # Fitment is part of the key so rows with different sizes never merge.
    key = (make, model, gen or "", trim or "", tuple(tyres), tuple(rims), pcd or "")
    grp = groups.get(key)
    if grp is None:
        grp = groups[key] = {
            "make": make, "model": model, "generation": gen, "trim": trim,
            "years": set(), "tyreOptions": tyres, "rimOptions": rims, "pcd": pcd,
            "bore": g(r, "Centre Bore (mm)"), "nutThread": g(r, "Wheel Nut Thread"),
            "boltThread": g(r, "Wheel Bolt Thread"),
            "imageLabel": g(r, "Vehicle Image Reference"),
            "imageYearRange": g(r, "Image Year Range"),
        }
    yr = g(r, "Year")
    if yr and yr.isdigit():
        grp["years"].add(int(yr))

out = []
for grp in groups.values():
    yrs = sorted(grp["years"], reverse=True)
    if not yrs:
        continue
    img_slug = slug(grp["imageLabel"]) if grp["imageLabel"] else ""
    image = img_slug if img_slug in have_imgs else None
    out.append({
        "make": grp["make"], "model": grp["model"],
        "generation": grp["generation"], "trim": grp["trim"],
        "years": yrs,
        "tyreOptions": grp["tyreOptions"], "rimOptions": grp["rimOptions"],
        "pcd": grp["pcd"], "bore": grp["bore"],
        "nutThread": grp["nutThread"], "boltThread": grp["boltThread"],
        "image": image, "imageLabel": grp["imageLabel"], "imageYearRange": grp["imageYearRange"],
    })

json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

# ---- stats / sanity ----
print("groups:", len(out))
print("makes:", len({v["make"] for v in out}))
print("with image:", sum(1 for v in out if v["image"]), "/", len(out))
print("blank pcd:", sum(1 for v in out if not v["pcd"]))
hil = [v for v in out if v["make"] == "Toyota" and v["model"] == "Hilux"]
yrs = sorted({y for v in hil for y in v["years"]}, reverse=True)
print("Hilux groups:", len(hil), "years:", yrs[:8], "...")
h21 = [v for v in hil if 2021 in v["years"]]
print("Hilux 2021 records:", len(h21))
for v in h21[:4]:
    print("   ", v["trim"], "·", v["generation"], "->", v["tyreOptions"])
baic = [v for v in out if v["make"] == "BAIC" and v["model"] == "X55"]
print("BAIC X55 tyreOptions:", [v["tyreOptions"] for v in baic][:2])
rs3 = [v for v in out if v["make"] == "Audi" and v["model"] == "RS3"]
print("Audi RS3 tyreOptions sample:", [v["tyreOptions"] for v in rs3][:2])
