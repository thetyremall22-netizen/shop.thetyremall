import openpyxl, json, re, sys
from collections import OrderedDict

SRC = sys.argv[1]
OUT = sys.argv[2]

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb["Simulator Master"]
rows = ws.iter_rows(values_only=True)
hdr = next(rows)
idx = {name: i for i, name in enumerate(hdr)}

def g(r, name):
    v = r[idx[name]]
    return str(v).strip() if v is not None and str(v).strip() != "" else None

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') if s else ""

groups = OrderedDict()
for r in rows:
    make = g(r, "Make"); model = g(r, "Model")
    if not make or not model:
        continue
    gen = g(r, "Generation") or ""
    trim = g(r, "Engine / Trim") or ""
    key = (make, model, gen, trim)
    grp = groups.get(key)
    if grp is None:
        grp = groups[key] = {"make": make, "model": model, "gen": gen, "trim": trim,
                             "years": set(), "tyres": [], "rims": [], "pcd": None, "bore": None,
                             "ref": None, "label": None}
    yr = g(r, "Year")
    if yr and yr.isdigit():
        grp["years"].add(int(yr))
    for col in ("OE Tyre Size (Option 1)", "Tyre Size (Option 2)", "Tyre Size (Option 3)"):
        t = g(r, col)
        if t and t not in grp["tyres"]:
            grp["tyres"].append(t)
    for col in ("OE Rim Size (Option 1)", "Rim Size (Option 2)", "Rim Size (Option 3)"):
        t = g(r, col)
        if t and t not in grp["rims"]:
            grp["rims"].append(t)
    if not grp["pcd"]:
        grp["pcd"] = g(r, "PCD (Bolt Pattern)")
    if not grp["bore"]:
        grp["bore"] = g(r, "Centre Bore (mm)")
    if not grp["ref"]:
        grp["ref"] = g(r, "Vehicle Image Reference")
    if not grp["label"]:
        grp["label"] = g(r, "Image Year Range")

out = []
for grp in groups.values():
    yrs = sorted(grp["years"])
    yf = yrs[0] if yrs else None
    yt = yrs[-1] if yrs else None
    label = grp["label"] or (f"{yf}-{yt}" if yf else "")
    image = slug(grp["ref"]) if grp["ref"] else ""
    out.append({
        "make": grp["make"], "model": grp["model"], "gen": grp["gen"], "trim": grp["trim"],
        "yearFrom": yf, "yearTo": yt,
        "tyres": grp["tyres"], "rims": grp["rims"],
        "pcd": grp["pcd"] or "", "bore": grp["bore"] or "",
        "image": image, "label": label,
    })

json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("entries:", len(out))
print("makes:", len({v["make"] for v in out}))
print("sample:", json.dumps(out[0], ensure_ascii=False))
# Hilux sanity
hil = [v for v in out if v["make"]=="Toyota" and v["model"]=="Hilux"]
print("Toyota Hilux variants:", len(hil))
