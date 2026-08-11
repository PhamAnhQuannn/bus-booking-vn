# -*- coding: utf-8 -*-
"""Resolve danh sach diem den CURATE (dia_diem_config.DIEM_CHOT[slug]) -> toa do that
tu Overture (+ Wikidata fallback) -> guide_data.json. Thay chon tu dong (noisy).

Moi entry curate khop MOT diem Overture theo ten (alt fragment / token) GAN hint nhat;
khong khop -> Wikidata; van khong -> dung hint (ghi nguon 'curated hint'). Khong bia.
So diem = so entry resolve duoc (bien thien theo city). Khong can dedup (list da curate).
"""
import json, os, sys, io, math, time, unicodedata, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of, DIEM_CHOT

RAW = sys.argv[1]
C = cfg(RAW)
SLUG = slug_of(RAW)
PREFIX = C["id_prefix"]
CLON, CLAT = C["center"]
BUILD_DATE = time.strftime("%d/%m/%Y")
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}
GENERIC = {"chua", "thap", "nha", "tho", "bai", "bien", "cho", "den", "mieu", "cong",
           "vien", "khu", "danh", "thang", "nui", "dam", "di", "tich", "vinh", "hon",
           "bao", "tang", "cau", "dao", "ban", "vuon", "hoa", "cua", "the", "va"}
EXCLUDE_NAME = ("can ho", "chung cu", "apartment", "condotel", "villa", "biet thu",
                "khach san", " hotel", "resort", "homestay", "guesthouse", "nha nghi",
                "motel", "toa nha", "van phong", "office", "cong ty", "showroom",
                "spa center", "massage", "cafe", "coffee", "nha hang", "restaurant",
                "cho thue", "for rent", "du an ")
MAX_HINT_M = 3500        # khop Overture chi nhan neu trong ban kinh nay quanh hint
# Chi nhan diem Overture co category ATTRACTION THAT (tranh bam tiem tattoo/nha khach
# /shop cung ten gan landmark). Khong khop attraction -> dung hint coord (chinh chu).
ATTR_CATS = {
    "landmark_and_historical_building", "monument", "memorial", "historic_site", "castle",
    "fort", "palace", "buddhist_temple", "hindu_temple", "temple", "shrine", "monastery",
    "church_cathedral", "catholic_church", "cathedral", "pentecostal_church",
    "evangelical_church", "church", "beach", "beach_resort", "park", "botanical_garden",
    "garden", "museum", "history_museum", "science_museum", "art_museum",
    "decorative_arts_museum", "childrens_museum", "amusement_park", "water_park",
    "theme_park", "zoo", "aquarium", "lake", "reservoir", "waterfall", "island",
    "scenic_lookout", "viewpoint", "mountain", "cable_car", "market", "night_market",
    "flea_market", "farmers_market", "public_market", "attractions_and_activities",
    "tourist_attraction", "bridge", "pier", "harbor", "plaza", "tower",
}


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def toks(name):
    return {t for t in fold(name).split() if len(t) > 2 and t not in GENERIC}


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def area_of(lat, lon):
    d = hav((CLAT, CLON), (lat, lon))
    if d < 2500:
        return "Trung tâm"
    brg = (math.degrees(math.atan2(lon - CLON, lat - CLAT)) + 360) % 360
    dirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"]
    return dirs[int((brg + 22.5) % 360 // 45)]


def osrm_table(coords):
    s = ";".join("%f,%f" % (lon, lat) for lon, lat in coords)
    url = "https://router.project-osrm.org/table/v1/driving/%s?annotations=duration,distance" % s
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            d = json.load(r)
        return d.get("durations"), d.get("distances")
    except Exception as e:
        print("OSRM table loi:", type(e).__name__, "- dung haversine")
        return None, None


# ── nap nguon ──────────────────────────────────────────────────────────────
ov = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))
ov = [r for r in ov if r.get("lat") is not None and r.get("lon") is not None and r.get("name")]
# Wikidata: parse binding -> (label, lat, lon, img, qid)
wd = []
try:
    wdj = json.load(io.open(os.path.join(RAW, "wikidata.json"), encoding="utf-8"))
    for b in wdj.get("results", {}).get("bindings", []):
        c = b.get("coord", {}).get("value", "")
        if not c.startswith("Point("):
            continue
        try:
            lon, lat = [float(x) for x in c[6:-1].split()]
        except Exception:
            continue
        lab = b.get("viLabel", {}).get("value") or b.get("itemLabel", {}).get("value", "")
        wd.append((lab, lat, lon))
except FileNotFoundError:
    pass

curated = DIEM_CHOT.get(SLUG, [])
if not curated:
    print("KHONG co DIEM_CHOT cho slug", SLUG); sys.exit(1)
print("curate: %d diem" % len(curated))


def match_overture(entry):
    """Diem Overture khop ten (alt/token) GAN hint nhat, khong phai luu tru/thuong mai."""
    hint = entry.get("hint")
    frags = [fold(a) for a in entry.get("alt", [])] + [fold(entry["ten"])]
    dtok = toks(entry["ten"]) | set().union(*[toks(a) for a in entry.get("alt", [])]) if entry.get("alt") else toks(entry["ten"])
    best = None
    for r in ov:
        fn = fold(r["name"])
        if any(x in fn for x in EXCLUDE_NAME):
            continue
        if (r.get("category") or "").lower() not in ATTR_CATS:   # phai la attraction that
            continue
        hit = any(fr and fr in fn for fr in frags) or (dtok and dtok <= toks(r["name"]))
        if not hit:
            continue
        d = hav(hint, (r["lat"], r["lon"])) if hint else 0
        if hint and d > MAX_HINT_M:
            continue
        score = (-(r.get("confidence") or 0.5), d)   # gan hint + conf cao
        if best is None or (d, -(r.get("confidence") or 0)) < (best[1], -(best[0].get("confidence") or 0)):
            best = (r, d)
    return best


def match_wikidata(entry):
    hint = entry.get("hint")
    frags = [fold(a) for a in entry.get("alt", [])] + [fold(entry["ten"])]
    best = None
    for lab, lat, lon in wd:
        fn = fold(lab)
        if not any(fr and fr in fn for fr in frags):
            continue
        d = hav(hint, (lat, lon)) if hint else 0
        if hint and d > MAX_HINT_M:
            continue
        if best is None or d < best[1]:
            best = ((lab, lat, lon), d)
    return best


picked = []
report = []
for e in curated:
    ov_m = match_overture(e)
    src, lat, lon, web, tel, addr, conf = None, None, None, None, None, None, None
    if ov_m:
        r, d = ov_m
        lat, lon = float(r["lat"]), float(r["lon"])
        web = (r.get("websites") or [None])[0]
        tel = (r.get("phones") or [None])[0]
        addr = r.get("address")
        conf = r.get("confidence")
        src = ["Overture"]
        report.append("  OK   %-30s Overture %4dm  (%s)" % (e["ten"][:30], round(d), (r.get("name") or "")[:30]))
    else:
        wd_m = match_wikidata(e)
        if wd_m:
            (lab, lat, lon), d = wd_m
            src = ["Wikidata"]
            report.append("  OK   %-30s Wikidata %4dm  (%s)" % (e["ten"][:30], round(d), lab[:30]))
        elif e.get("hint"):
            lat, lon = e["hint"]
            src = ["curated hint"]
            report.append("  HINT %-30s dung toa do curate (khong khop Overture/Wikidata)" % e["ten"][:30])
        else:
            report.append("  SKIP %-30s khong toa do" % e["ten"][:30])
            continue
    picked.append({
        "name": e["ten"], "lat": lat, "lon": lon, "loai_vn": e["loai"], "loai_phu": [],
        "kind": None, "conf": conf, "src": src, "web": web, "tel": tel, "addr": addr,
        "closed": "", "alt": e.get("alt", []), "hours": "", "fee": "", "ele": "",
        "anchor": None, "anchor_m": None, "kinds": [], "nhom": "chinh",
        "csdl_gia_min": None, "csdl_gia_max": None, "csdl_tham_dinh": None,
    })

print("\n".join(report))
print("\nresolve duoc: %d/%d" % (len(picked), len(curated)))

# ── area + OSRM matrix + near + id ─────────────────────────────────────────
for c in picked:
    c["area"] = area_of(c["lat"], c["lon"])
coords = [(CLON, CLAT)] + [(c["lon"], c["lat"]) for c in picked]
dur, dist = osrm_table(coords)
n = len(picked)
for i, c in enumerate(picked):
    if dist and dur and dist[0][i + 1] is not None:
        c["km"] = round(dist[0][i + 1] / 1000.0, 4)
        c["min"] = round(dur[0][i + 1] / 60.0, 4)
    else:
        km = hav((CLAT, CLON), (c["lat"], c["lon"])) / 1000.0 * 1.3
        c["km"], c["min"] = round(km, 4), round(km / 30 * 60, 4)
    c["osrm_row"] = bool(dist)

picked.sort(key=lambda c: (c["area"], c["min"]))
for i, c in enumerate(picked, 1):
    c["id"] = "%s-%02d" % (PREFIX, i)

near = {}
for i, c in enumerate(picked):
    others = []
    for j, o in enumerate(picked):
        if i == j:
            continue
        if dist and dur and dist[i + 1][j + 1] is not None:
            km, mn = dist[i + 1][j + 1] / 1000.0, dur[i + 1][j + 1] / 60.0
        else:
            km = hav((c["lat"], c["lon"]), (o["lat"], o["lon"])) / 1000.0 * 1.3
            mn = km / 30 * 60
        others.append((o["id"], round(km, 2), round(mn, 1)))
    others.sort(key=lambda x: x[1])
    near[c["id"]] = [list(x) for x in others[:3]]

matrix = None
if dist and dur:
    ok = all(dur[i + 1][j + 1] is not None for i in range(n) for j in range(n))
    if ok:
        matrix = {"ids": [c["id"] for c in picked],
                  "durations": [[round(dur[i + 1][j + 1]) for j in range(n)] for i in range(n)],
                  "distances": [[round(dist[i + 1][j + 1]) for j in range(n)] for i in range(n)]}

guide = {"build_date": BUILD_DATE, "xep_hang": [c["id"] for c in picked], "picked": picked,
         "near": near, "matrix": matrix, "csdl_gia": {}}
outp = os.path.join(RAW, "guide_data.json")
tmp = outp + ".tmp"
json.dump(guide, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, outp)
print("\nguide_data.json -> %s  (%d diem)  matrix=%s" % (outp, n, bool(matrix)))
print("khu vuc:", dict(Counter(c["area"] for c in picked)))
print("loai:", dict(Counter(c["loai_vn"] for c in picked)))
