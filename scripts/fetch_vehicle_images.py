"""Download vehicle images referenced by the Simulator Master sheet into
/public/vehicles, under neutral slugs derived from the 'Vehicle Image Reference'
column (e.g. "Abarth 500 (2008-2016)" -> abarth-500-2008-2016.webp). The source
URL is never used in the stored filename. Only missing slugs are fetched.

Usage: python3 scripts/fetch_vehicle_images.py <xlsx> <out_dir>
"""
import openpyxl, re, os, sys, time, io, urllib.request
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") if s else ""


wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb["Simulator Master"]
it = ws.iter_rows(values_only=True)
hdr = next(it)
idx = {n: i for i, n in enumerate(hdr)}

pairs = {}  # slug -> url (first wins)
for r in it:
    ref = r[idx["Vehicle Image Reference"]]
    url = r[idx["Image Link (Google Drive)"]]
    if ref and url:
        s = slug(str(ref))
        if s and s not in pairs:
            pairs[s] = str(url)

have = {os.path.splitext(f)[0] for f in os.listdir(OUT)}
missing = [(s, u) for s, u in pairs.items() if s not in have]
print(f"{len(pairs)} distinct images, {len(have & set(pairs))} already local, {len(missing)} to fetch")

ok, fail = 0, 0
for i, (s, url) in enumerate(missing, 1):
    dest = os.path.join(OUT, s + ".webp")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        # keep it small — these are thumbnails on cards
        img.thumbnail((640, 480), Image.LANCZOS)
        img.save(dest, "WEBP", quality=82, method=6)
        ok += 1
        print(f"  [{i}/{len(missing)}] {s}.webp")
    except Exception as e:
        fail += 1
        print(f"  [{i}/{len(missing)}] FAIL {s}: {e}")
    time.sleep(0.3)

print(f"done: {ok} saved, {fail} failed")
