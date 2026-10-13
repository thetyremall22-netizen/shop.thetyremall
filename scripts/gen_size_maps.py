import json, re, sys
from collections import defaultdict

prods = json.load(open("src/data/products.json"))

def norm(v):
    if v is None: return ""
    s = str(v).strip().replace(",", ".").replace('"', "").replace("'", "")
    s = s.replace("J", "").replace("mm", "").strip()
    return s

def num(s):
    try: return float(s)
    except: return 1e9

def sort_nums(xs):
    return sorted(set(xs), key=lambda x: (num(x), x))

# ---- tyre size parser (fallback when attrs blank) ----
TYRE_RE = re.compile(r'(\d{2,3}(?:\.\d+)?)\s*[/xX]\s*(\d{1,2}(?:\.\d+)?)\s*[a-zA-Z]{0,2}[rR]?\s*(\d{2}(?:\.\d+)?)')
def parse_tyre(size):
    if not size: return (None, None, None)
    m = TYRE_RE.search(size.replace(" ", ""))
    if m: return (m.group(1), m.group(2), m.group(3))
    return (None, None, None)

# ================= TYRE MAP: width -> profile -> [rims] =================
tmap = defaultdict(lambda: defaultdict(set))
tcount = 0
# per-option product counts (for "45 (12)" labels in the size filters)
cnt_w = defaultdict(int)     # width            -> # products
cnt_wp = defaultdict(int)    # width|profile     -> # products
cnt_wpr = defaultdict(int)   # width|profile|rim -> # products
for p in prods:
    if p.get("type") != "tyre": continue
    s = p.get("specs") or {}
    w, pr, r = norm(s.get("width")), norm(s.get("profile")), norm(s.get("rim"))
    if not (w and pr and r):
        pw, pp, prr = parse_tyre(s.get("size") or "")
        w = w or (pw or ""); pr = pr or (pp or ""); r = r or (prr or "")
    if w and pr and r:
        tmap[w][pr].add(r)
        tcount += 1
        cnt_w[w] += 1
        cnt_wp[f"{w}|{pr}"] += 1
        cnt_wpr[f"{w}|{pr}|{r}"] += 1

tyre_out = {}
for w in sort_nums(tmap.keys()):
    tyre_out[w] = {pr: sort_nums(tmap[w][pr]) for pr in sort_nums(tmap[w].keys())}
combos = sum(len(rs) for w in tyre_out.values() for rs in w.values())
json.dump(tyre_out, open("src/data/tyre-size-map.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"TYRE map: {len(tyre_out)} widths, {combos} (width,profile,rim) combos, {tcount} skus mapped")

counts_out = {"w": dict(cnt_w), "wp": dict(cnt_wp), "wpr": dict(cnt_wpr)}
json.dump(counts_out, open("src/data/tyre-size-counts.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"TYRE counts: {len(cnt_w)} widths, {len(cnt_wp)} width|profile, {len(cnt_wpr)} width|profile|rim")

# ================= WHEEL MAP: rim -> pcd -> [rim widths] =================
def norm_pcd(v):
    return str(v).strip().lower().replace("*", "x").replace("/", "x").replace(" ", "")
wmap = defaultdict(lambda: defaultdict(set))
for p in prods:
    if p.get("type") != "wheel": continue
    s = p.get("specs") or {}
    r = norm(s.get("rim")); width = norm(s.get("width")); pcd_raw = s.get("pcd") or ""
    if not (r and pcd_raw): continue
    for pcd in str(pcd_raw).split("|"):
        pcd = norm_pcd(pcd)
        if not pcd: continue
        if width: wmap[r][pcd].add(width)
wheel_out = {}
for r in sort_nums(wmap.keys()):
    wheel_out[r] = {pcd: sort_nums(wmap[r][pcd]) for pcd in sorted(wmap[r].keys())}
json.dump(wheel_out, open("src/data/wheel-size-map.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"WHEEL map: {len(wheel_out)} rim sizes")

# ---- compare to attached fixtures (optional — skipped if the fixture is absent) ----
def flatten_tyre(m):
    return {(norm(w), norm(pr), norm(r)) for w,prs in m.items() for pr,rs in prs.items() for r in rs}
try:
    fix = json.load(open("/Users/tracymargetts/Downloads/tyre-size-map.json"))
    gen_set, fix_set = flatten_tyre(tyre_out), flatten_tyre(fix)
    print(f"TYRE vs fixture: generated {len(gen_set)} combos, fixture {len(fix_set)}, overlap {len(gen_set & fix_set)}, only-in-gen {len(gen_set-fix_set)}, only-in-fix {len(fix_set-gen_set)}")
except FileNotFoundError:
    print("TYRE vs fixture: skipped (no Downloads fixture)")
# spot checks from acceptance tests
print("225 profiles:", list(tyre_out.get("225",{}).keys()))
print("225/45 rims:", tyre_out.get("225",{}).get("45"))
print("265/65 rims:", tyre_out.get("265",{}).get("65"))
print("wheel 17 PCDs:", list(wheel_out.get("17",{}).keys()))
print("wheel 17 6x139.7 widths:", wheel_out.get("17",{}).get("6x139.7"))
