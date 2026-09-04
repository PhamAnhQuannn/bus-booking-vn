# -*- coding: utf-8 -*-
"""Slim builder DA THANH PHO — sinh guide_data.json (picked 36 + near + matrix) tu
Overture, cho city moi (Nha Trang, Da Nang...). Thay build_destinations_md +
build_huong_dan (voo gan cung Da Lat: import an_ngu_data/hoat_dong_data, CSDL,
sinh .docx). Chi lam PHAN CHON DIEM cho scope diem-den+anh.

Sau buoc nay chay chuoi neutral: enrich_wikidata (gan QID/P18/mo ta) -> enrich_mo_ta
-> enrich_facilities -> enrich_osrm_nearest -> enrich_anh -> fetch_anh -> export_planner.

Da Lat GIU nguyen pipeline cu (build_huong_dan); builder nay CHI cho city moi.
"""
import json, os, sys, io, math, time, unicodedata, urllib.request
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of

RAW = sys.argv[1]
C = cfg(RAW)
SLUG = slug_of(RAW)
PREFIX = C["id_prefix"]
CLON, CLAT = C["center"]
BUILD_DATE = time.strftime("%d/%m/%Y")
MAX_ALLOW = 24                                          # cap force-include allowlist
MAX_DIEM = int(os.environ.get("MAX_DIEM", "600"))       # gan uncap: threshold SCORE_MIN moi la gioi han that
# (HCM ~439 la tinh dong nhat — 600 du headroom, KHONG tinh nao bi cat; duoi 0.45 co it noise metro, chap nhan)
SCORE_MIN = float(os.environ.get("SCORE_MIN") or C.get("score_min") or 0.45)  # env > per-tinh config > default
# 0.45 = calibrate pilot Quang Ninh (freeze): base tier1.0=0.40; doi HOI it nhat 1 tin hieu (name:en/wiki/
# heritage/attraction/contact). Tinh MONG (it POI co tag wiki) ha nguong qua score_min trong dia_diem_config.
DEDUP_M = 130
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}

# OSM tag -> loai_vn. NGUON = OSM (sweep_osm_diem_den.py), khong con Overture (POI thuong mai
# ~80% rac). place_of_worship + historic religious -> phan Chua/Nha tho/Den-Mieu theo ten.
CAT_TIER = {
    "Thác nước": 1.0, "Hồ / Đập": 1.0, "Chùa / Thiền viện": 1.0, "Nhà thờ": 1.0,
    "Bảo tàng": 1.0, "Dinh thự / Di tích": 1.0, "Công viên / Vườn hoa": 1.0,
    "Bãi biển": 1.0, "Điểm ngắm cảnh": 1.0, "Khu vui chơi": 1.0, "Cáp treo": 1.0,
    "Khu du lịch giải trí (vui chơi trả phí)": 1.0,
    "Hang động": 1.0, "Đảo": 1.0, "Vườn quốc gia / Khu bảo tồn": 1.0, "Điểm tham quan": 0.9,
    "Đền / Miếu": 0.9, "Suối nước nóng": 0.8,
    "Chợ / Mua sắm": 0.8, "Núi / Đèo / Đường mòn": 0.6, "Khác": 0.1,
}


def _tho_loai(name):
    """place_of_worship / historic religious -> Chua | Nha tho | Den-Mieu theo ten tieng Viet."""
    f = fold(name)
    if any(w in f for w in ("nha tho", "giao xu", "giao ho", "thanh duong", "church", "cathedral")):
        return "Nhà thờ"
    if any(w in f for w in ("den", "mieu", "dinh ", "phu ", "lang ", "am ", "nghe ")):
        return "Đền / Miếu"
    return "Chùa / Thiền viện"   # chua/thien vien/tu/pagoda/monastery mac dinh


# KDL giai tri tra phi — seed famous mis-tag (Dai Nam la tourism=attraction, khong phai
# theme_park) + keyword. Hep, do-dem (rule hit-rate); KHONG dung "khu du lich" rong.
_GIAITRI_SUB = ("cong vien nuoc", "theme park", "cong vien giai tri")
_GIAITRI_SEED = ("dai nam", "suoi tien", "dam sen", "vinwonders", "vinpearl", "ba na",
                 "suoi vang", "sun world", "asia park", "grand world")
_LOAI_GIAITRI = "Khu du lịch giải trí (vui chơi trả phí)"


def map_loai(tags, name):
    """OSM tags -> loai_vn (uu tien place>tourism-cu the>historic>natural>leisure>worship).
    Tra None -> bo (khong phai diem den: coastline linear, historic=yes mo ho, artwork nho...)."""
    t = tags
    fn = fold(name)
    if any(s in fn for s in _GIAITRI_SUB) or any(s in fn for s in _GIAITRI_SEED):
        return _LOAI_GIAITRI                          # A2: seed ten (bat ca ban mis-tag)
    if t.get("place") in ("island", "islet"):
        return "Đảo"
    tr = t.get("tourism")
    if tr == "museum" or tr == "gallery":
        return "Bảo tàng"
    if tr == "viewpoint":
        return "Điểm ngắm cảnh"
    if tr in ("theme_park", "water_park"):
        return _LOAI_GIAITRI                          # A1: theme/water park -> loai moi
    if tr in ("zoo", "aquarium"):
        return "Khu vui chơi"
    if tr == "attraction":
        return "Điểm tham quan"
    if tr in ("artwork",):
        return None                                   # tuong nho le -> bo (nhieu, gia tri thap)
    h = t.get("historic")
    if h in ("church", "temple", "monastery", "shrine"):
        return _tho_loai(name)
    if h in ("castle", "fort", "palace", "citywalls", "city_gate", "tower", "manor",
             "monument", "memorial", "ruins", "archaeological_site", "battlefield"):
        return "Dinh thự / Di tích"
    nat = t.get("natural")
    if nat in ("peak", "volcano"):
        return "Núi / Đèo / Đường mòn"
    if nat == "waterfall" or t.get("waterway") == "waterfall":
        return "Thác nước"
    if nat == "beach":
        return "Bãi biển"
    if nat == "cave_entrance":
        return "Hang động"
    if nat in ("bay", "arch"):
        return "Điểm ngắm cảnh"
    if nat == "hot_spring":
        return "Suối nước nóng"
    le = t.get("leisure")
    if le in ("park", "garden"):
        return "Công viên / Vườn hoa"
    if le == "nature_reserve" or t.get("boundary") == "national_park":
        return "Vườn quốc gia / Khu bảo tồn"
    if t.get("amenity") == "place_of_worship":
        return _tho_loai(name)
    return None                                        # natural=coastline/wetland, historic=yes -> bo


def osm_score(loai, tags):
    """Diem noi tieng: cat_tier + tin hieu wiki/heritage/attraction/ten-quoc-te/lien-he."""
    t = tags
    s = 0.40 * CAT_TIER.get(loai, 0.3)
    if t.get("wikidata") or t.get("wikipedia"):
        s += 0.28
    if t.get("heritage") or t.get("heritage:operator"):
        s += 0.12
    if t.get("tourism") == "attraction":
        s += 0.10
    if t.get("name:en") or t.get("int_name"):
        s += 0.08
    if t.get("website") or t.get("phone"):
        s += 0.05
    return min(s, 1.0)


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


# Ten bao hieu KHONG phai diem tham quan (chung cu/luu tru/thuong mai) — category
# 'landmark_and_historical_building' cua Overture lan ca toa nha; loc theo ten.
EXCLUDE_NAME = ("can ho", "chung cu", "apartment", "condotel", "villa", "biet thu",
                "khach san", " hotel", "resort", "homestay", "guesthouse", "guest house",
                "nha nghi", "motel", "plaza", "toa nha", "building", "van phong", "office",
                "cong ty", " ltd", "showroom", "can du an", "du an", "shophouse",
                "spa", "massage", "cafe", "coffee", "quan ", "nha hang", "restaurant",
                "ban le", "cho thue", "for rent")

# Ten RAC exact-match (fold) — quang cao/garbage/cong toa nha, loc khi soi 4 tinh mong 2026-08-09.
# Exact-fold (khong substring) -> an toan, khong dinh ten that o tinh khac.
DROP_NAMES = {
    "hole cave view", "peak near tower", "home", "cong chinh", "cong phu",
    "xe dien thanh dong", "thanh dong solar", "xem dep tren trong che", "ta xua",
}

# tu chung khi so ten -> khong tinh la ten rieng (de gom trung)
GENERIC_NAME = {"chua", "thap", "nha", "tho", "bai", "bien", "pagoda", "temple", "beach",
                "cho", "den", "mieu", "cong", "vien", "cathedral", "church", "nha trang",
                "nhatrang", "vietnam", "vienam", "khu", "lich", "kdl", "danh", "thang",
                "co", "buddhist", "monastery", "the", "and", "nui", "dam", "di", "tich",
                "vinh", "hon", "bao", "tang", "museum", "park", "cong vien"}


def core(name):
    return frozenset(t for t in fold(name).split() if len(t) > 2 and t not in GENERIC_NAME)


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def area_of(lat, lon):
    """Cum khu vuc theo huong + khoang cach tu tam (da dang de per-area floor)."""
    d = hav((CLAT, CLON), (lat, lon))
    if d < 2000:
        return "Trung tâm"
    brg = (math.degrees(math.atan2(lon - CLON, lat - CLAT)) + 360) % 360
    dirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"]
    return dirs[int((brg + 22.5) % 360 // 45)]


def osrm_table(coords):
    """coords = [(lon,lat)...] -> (durations[][] giay, distances[][] met) hoac None."""
    s = ";".join("%f,%f" % (lon, lat) for lon, lat in coords)
    url = "https://router.project-osrm.org/table/v1/driving/%s?annotations=duration,distance" % s
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            d = json.load(r)
        return d.get("durations"), d.get("distances")
    except Exception as e:
        print("OSRM table loi:", type(e).__name__, "- dung haversine")
        return None, None


# ── ranh gioi tinh (boundary.geojson) → point-in-polygon clip ──────────────
# bbox chu nhat cua 1 tinh lan sang tinh ke (Quang Ninh <-> Hai Phong): giu 1 diem
# ngoai tinh = claim SAI provenance. Clip theo polygon that neu co boundary.geojson;
# khong co file -> khong clip (tuong thich nguoc city bbox chat: da-lat/nha-trang/da-nang).
def _load_boundary(raw):
    p = os.path.join(raw, "boundary.geojson")
    if not os.path.exists(p):
        return None
    g = json.load(io.open(p, encoding="utf-8"))
    t = g.get("type")
    if t == "Polygon":
        return [g["coordinates"]]
    if t == "MultiPolygon":
        return g["coordinates"]
    return None


def _pip_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def in_boundary(lon, lat, polys):
    if polys is None:
        return True
    for poly in polys:                       # poly = [outer_ring, hole1, ...]
        if _pip_ring(lon, lat, poly[0]) and not any(_pip_ring(lon, lat, h) for h in poly[1:]):
            return True
    return False


BOUNDARY = _load_boundary(RAW)
print("boundary:", "co (clip PIP)" if BOUNDARY else "khong (bbox only)")
_clipped = 0

# ── 1. ung vien tu OSM (sweep_osm_diem_den.py) ──────────────────────────────
_PRIM = ("tourism", "historic", "natural", "waterway", "leisure", "place", "amenity", "boundary")
osm = json.load(io.open(os.path.join(RAW, "osm_diem_den.json"), encoding="utf-8"))
cand = []
_no_loai = 0
for r in osm:
    name = (r.get("name") or "").strip()
    if not name:
        continue
    tags = r.get("tags") or {}
    loai = map_loai(tags, name)
    if not loai:
        _no_loai += 1
        continue
    if not core(name):                        # ten toan tu chung ("Miếu", "Chùa") -> bo
        continue
    if any(x in fold(name) for x in EXCLUDE_NAME):
        continue
    if fold(name) in DROP_NAMES:                   # ten rac exact (quang cao/garbage)
        continue
    lat, lon = r.get("lat"), r.get("lon")
    if lat is None or lon is None:
        continue
    if not in_boundary(float(lon), float(lat), BOUNDARY):
        _clipped += 1
        continue
    cand.append({
        "name": name, "lat": float(lat), "lon": float(lon),
        "loai_vn": loai, "loai_phu": [], "src": ["OSM"], "tags": tags, "conf": None,
        "kind": next(("%s=%s" % (k, tags[k]) for k in _PRIM if k in tags), None),
        "web": tags.get("website"), "tel": tags.get("phone"),
        "addr": None, "closed": "", "alt": [],
    })
print("ung vien OSM (da map loai): %d  (bo khong-loai: %d, clip ngoai tinh: %d)"
      % (len(cand), _no_loai, _clipped))

# ── 1b. ung vien NET-NEW tu CSDL /dest (da geocode) — chi dong khong trung OSM song
# qua dedup §2; in_boundary loai geocode sai tinh (guard that, khong tin geocode dung tinh). ──
_csdl_p = os.path.join(RAW, "csdl_dest.json")
_csdl_add = _csdl_clip = 0
if os.path.exists(_csdl_p):
    for r in json.load(io.open(_csdl_p, encoding="utf-8")):
        name = (r.get("ten") or "").strip()
        lat, lon = r.get("lat"), r.get("lon")
        if not name or lat is None or lon is None or not core(name):
            continue
        if any(x in fold(name) for x in EXCLUDE_NAME) or fold(name) in DROP_NAMES:
            continue
        if not in_boundary(float(lon), float(lat), BOUNDARY):
            _csdl_clip += 1
            continue
        cand.append({
            "name": name, "lat": float(lat), "lon": float(lon),
            "loai_vn": r.get("loai_vn") or "Điểm tham quan", "loai_phu": [],
            "src": ["CSDL"], "tags": {}, "conf": None, "kind": None,
            "web": None, "tel": None, "addr": r.get("dia_chi"), "closed": "", "alt": [],
            "csdl_tham_dinh": "nhà nước",
        })
        _csdl_add += 1
    print("ung vien CSDL net-new: +%d  (clip ngoai ranh: %d)" % (_csdl_add, _csdl_clip))

# ── 2. dedup theo fold-name + proximity ────────────────────────────────────
cand.sort(key=lambda c: (c.get("conf") or 0), reverse=True)
kept = []
for c in cand:
    f, cc = fold(c["name"]), core(c["name"])
    dup = None
    for k in kept:
        d = hav((c["lat"], c["lon"]), (k["lat"], k["lon"]))
        kf, kc = fold(k["name"]), core(k["name"])
        same = (
            (d < DEDUP_M and (f == kf or f in kf or kf in f)) or            # rat gan + ten long
            (d < 600 and cc and kc and (cc & kc)) or                        # gan + chung ten rieng
            (d < 900 and cc and kc and (cc <= kc or kc <= cc))              # cung phuc hop (ten con tap con)
        )
        if same:
            dup = k
            break
    if dup:
        dup["conf"] = max(dup.get("conf") or 0, c.get("conf") or 0)
    else:
        kept.append(c)
print("sau dedup: %d" % len(kept))

# ── 3. allowlist + score + area ────────────────────────────────────────────
for c in kept:
    f = fold(c["name"])
    c["allow"] = any(a in f for a in C["allowlist"])
    c["area"] = area_of(c["lat"], c["lon"])
    c["score"] = osm_score(c["loai_vn"], c.get("tags") or {})
    if c.get("csdl_tham_dinh"):                 # net-new nha nuoc = notable -> boost qua nguong
        c["score"] = min(1.0, c["score"] + 0.30)

# ── 4. chon ADAPTIVE: allowlist force + threshold score, KHONG san (cho phep 0) ──
# Bo TARGET=36 cung: moi tinh co so diem TU NHIEN rieng. Giu MOI candidate score>=SCORE_MIN
# (+ allowlist force cho landmark biet ten), cap MAX_DIEM chong metro tran. Tinh khong co
# diem dat nguong -> picked=[] (hop le, export bo qua). PER_AREA_FLOOR bo (no bom junk vao
# tinh vang, mau thuan "cho phep 0").
scores = sorted((c["score"] for c in kept), reverse=True)
if scores:
    def _pct(p):
        return scores[min(len(scores) - 1, int(len(scores) * p))]
    print("score kept: n=%d  max=%.3f  p25=%.3f  p50=%.3f  p75=%.3f  min=%.3f"
          % (len(scores), scores[0], _pct(0.25), _pct(0.50), _pct(0.75), scores[-1]))
    print("  >=SCORE_MIN(%.2f): %d   >=0.50: %d  >=0.58: %d  >=0.60: %d"
          % (SCORE_MIN, sum(s >= SCORE_MIN for s in scores),
             sum(s >= 0.50 for s in scores), sum(s >= 0.58 for s in scores),
             sum(s >= 0.60 for s in scores)))

picked, taken = [], set()


def take(c):
    if id(c) not in taken:
        taken.add(id(c))
        picked.append(c)


# allowlist force-include, chi MOT dai dien / manh allowlist (chan khuech dai trung ten)
allow = sorted([c for c in kept if c["allow"]], key=lambda c: -c["score"])
seen_frag = set()
for c in allow:
    frags = {a for a in C["allowlist"] if a in fold(c["name"])}
    if frags & seen_frag:
        continue
    seen_frag |= frags
    take(c)
    if len(picked) >= MAX_ALLOW:
        break
# threshold: moi diem con lai dat SCORE_MIN
for c in sorted(kept, key=lambda c: -c["score"]):
    if c["score"] >= SCORE_MIN:
        take(c)
# cap theo score
picked.sort(key=lambda c: -c["score"])
picked = picked[:MAX_DIEM]
print("da chon: %d  (allowlist %d, threshold>=%.2f, cap %d)"
      % (len(picked), sum(1 for c in picked if c["allow"]), SCORE_MIN, MAX_DIEM))

# ── 5. OSRM: km/min tu tam + matrix + near ─────────────────────────────────
picked.sort(key=lambda c: (c["area"], hav((CLAT, CLON), (c["lat"], c["lon"]))))
coords = [(CLON, CLAT)] + [(c["lon"], c["lat"]) for c in picked]
dur, dist = osrm_table(coords)
n = len(picked)
for i, c in enumerate(picked):
    if dist and dur:
        c["km"] = round((dist[0][i + 1] or 0) / 1000.0, 4)
        c["min"] = round((dur[0][i + 1] or 0) / 60.0, 4)
    else:
        km = hav((CLAT, CLON), (c["lat"], c["lon"])) / 1000.0 * 1.3
        c["km"], c["min"] = round(km, 4), round(km / 30 * 60, 4)
    c["anchor"], c["anchor_m"], c["osrm_row"] = None, None, bool(dist)
    c["hours"] = c["fee"] = c["ele"] = ""
    c["conf"] = c.get("conf")
    c["kinds"] = [c["kind"]] if c.get("kind") else []
    c["nhom"] = "chinh"
    c["csdl_gia_min"] = c["csdl_gia_max"] = None
    c["csdl_tham_dinh"] = c.get("csdl_tham_dinh")   # giu co net-new §1b; §5b se set them cho OSM

# ── 5b. overlay CSDL: co "nha nuoc tham dinh" cho diem trung register /dest (cung tinh) ──
# csdl_dest.json KHONG co toa do -> match theo ten (fold + core token), trong 1 tinh.
# Chi la co provenance (rui ro thap); parse_csdl_dest.py da bucket theo slug.
_csdl_path = os.path.join(RAW, "csdl_dest.json")
if os.path.exists(_csdl_path):
    _csdl = json.load(io.open(_csdl_path, encoding="utf-8"))
    _cidx = [(fold(r["ten"]), core(r["ten"])) for r in _csdl if r.get("ten")]
    _n_ov = 0
    for c in picked:
        cf, cc = fold(c["name"]), core(c["name"])
        # PRECISION > recall: co provenance sai = claim bia. Chi khop khi ten trung that:
        # fold bang nhau HOAC tap token-rieng bang nhau (>=2 token, tranh "Chua Ba" trung nhieu).
        for kf, kc in _cidx:
            if cf == kf or (cc and cc == kc and len(cc) >= 2):
                c["csdl_tham_dinh"] = "nhà nước"
                _n_ov += 1
                break
    print("CSDL overlay: %d/%d diem co nha nuoc tham dinh (nguon /dest: %d)"
          % (_n_ov, len(picked), len(_csdl)))

# id: theo (area, min tu tam)
picked.sort(key=lambda c: (c["area"], c["min"]))
# R0 GUARD (id-stability): tai su dung id tu export LAN TRUOC theo fold-ten. enrichment.json/nominatim.json
# key theo id ordinal nay; neu doi thanh phan picked -> id dich -> enrichment gan NHAM diem (bug BLOCKER).
# Giu id cu cho record khop; chi cap id moi (tiep sau max ordinal) cho record moi. Lan dau (chua export) ->
# ordinal tu 1 nhu cu. Bo qua id seed (-S<n>, khong phai ordinal thuan). Xem issue planner-builddiemden-id-reassignment.
_prior_id = {}
_prior_path = os.path.join(RAW, "..", "..", "..", "export", SLUG, "diem-den.json")
try:
    for _r in json.load(io.open(_prior_path, encoding="utf-8")):
        _pid = _r.get("id") or ""
        _suf = _pid.rsplit("-", 1)[-1]
        if _pid.startswith(PREFIX + "-") and _suf.isdigit():
            _prior_id.setdefault(fold(_r.get("name", "")), _pid)   # ten dau tien giu id (nhanh trung ten -> id moi)
except (FileNotFoundError, ValueError):
    pass
_used = set()
_maxn = 0
for c in picked:                                   # pass 1: tai dung id cu
    pid = _prior_id.get(fold(c["name"]))
    if pid and pid not in _used:
        c["id"] = pid
        _used.add(pid)
        _maxn = max(_maxn, int(pid.rsplit("-", 1)[-1]))
_nxt = _maxn + 1
for c in picked:                                   # pass 2: id moi cho record chua khop
    if not c.get("id"):
        c["id"] = "%s-%02d" % (PREFIX, _nxt)
        _used.add(c["id"])
        _nxt += 1

# near: 3 gan nhat tu matrix (hoac haversine)
near = {}
mat_ids = [c["id"] for c in picked]
for i, c in enumerate(picked):
    others = []
    for j, o in enumerate(picked):
        if i == j:
            continue
        if dist and dur:
            km = (dist[i + 1][j + 1] or 9e9) / 1000.0
            mn = (dur[i + 1][j + 1] or 0) / 60.0
        else:
            km = hav((c["lat"], c["lon"]), (o["lat"], o["lon"])) / 1000.0 * 1.3
            mn = km / 30 * 60
        others.append((o["id"], round(km, 2), round(mn, 1)))
    others.sort(key=lambda x: x[1])
    near[c["id"]] = [list(x) for x in others[:3]]

matrix = None
if dist and dur:
    sub_d = [[round(dur[i + 1][j + 1]) if dur[i + 1][j + 1] is not None else None for j in range(n)] for i in range(n)]
    sub_m = [[round(dist[i + 1][j + 1]) if dist[i + 1][j + 1] is not None else None for j in range(n)] for i in range(n)]
    matrix = {"ids": mat_ids, "durations": sub_d, "distances": sub_m}

# ── 6. ghi guide_data.json ─────────────────────────────────────────────────
guide = {"build_date": BUILD_DATE, "xep_hang": [], "picked": picked,
         "near": near, "matrix": matrix, "csdl_gia": {}}
outp = os.path.join(RAW, "guide_data.json")
tmp = outp + ".tmp"
json.dump(guide, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, outp)
print("\nguide_data.json -> %s  (%d diem)" % (outp, len(picked)))
from collections import Counter
print("theo khu vuc:", dict(Counter(c["area"] for c in picked)))
print("theo loai:", dict(Counter(c["loai_vn"] for c in picked)))
print("\n--- 36 diem ---")
for c in picked:
    print("  %s %-34s %-20s %-12s %.1fkm  allow=%s" % (
        c["id"], c["name"][:34], c["loai_vn"], c["area"], c["km"], "Y" if c["allow"] else ""))
