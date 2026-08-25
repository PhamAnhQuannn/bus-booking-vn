# -*- coding: utf-8 -*-
"""Tach tinh MEGA -> city-unit chat (loc ban kinh tam cum). City-unit ke thua OSRM matrix cua parent
(subset ID ⊂ parent matrix -> drive-time that, khong chay lai OSRM), + place_id/trai_nghiem da enrich.

UNITS = 13 cum tuong minh (tam+ban kinh+ten tu density-probe 2026-08-09). Ghi
tourism-kb/export/<slug>/ qua kiem_loi_ra (da trong .gitignore + G8). Chay TU GOC REPO:
    python tourism-kb/code/split_city.py
"""
import os, io, sys, json, math, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duong_dan_ra as _dr

R_DD = 22.0     # ban kinh diem den (km)
R_ANU = 27.0    # ban kinh nha hang/khach san (rong hon chut)

# Tinh sap nhap MEGA co cac thi xa ranh gioi SAT nhau (vd Sa Pa <-> TP Lao Cai ~19km < R_DD) -> loc
# ban kinh THUAN keo diem thi xa khac vao => RO. Voi cac slug o WARD_ALLOW, loc diem-den theo KHU HANH
# CHINH (ward: Phuong/Xa/Thi tran dau tien trong full_address) thay ban kinh. Nha-hang/khach-san giu
# ban kinh (engine tu loc lai theo centroid chuyen di nen leak vo hai). Dong bo voi adminKey() ben
# trip-planner/lib/planner/plan.ts.
_WARD_RE = re.compile(r"^(Phường|Xã|Thị trấn)\s+\S")


def ward_of(r):
    full = ((r.get("address") or {}).get("full_address")) or ""
    for seg in full.split(","):
        s = seg.strip()
        if _WARD_RE.match(s):
            return s.lower()
    return None


WARD_ALLOW = {
    # Sa Pa (thi xa cu) = cac phuong/xa Sa Pa; loai Phuong Lao Cai (TP Lao Cai ~19km).
    "sa-pa": {"phường sa pa", "xã tả van", "xã hoàng liên", "xã mường hoa",
              "xã tả phìn", "xã ngũ chỉ sơn", "xã bản hồ", "xã liên minh"},
}


def hav(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


# parent, slug moi, ten hien thi, tam(lat,lon)
UNITS = [
    ("an-giang", "phu-quoc", "Phú Quốc", 10.26, 103.94),
    ("an-giang", "chau-doc", "Châu Đốc", 10.57, 105.05),
    ("quang-ninh", "ha-long", "Hạ Long", 20.95, 107.10),
    ("quang-ninh", "mong-cai", "Móng Cái", 21.48, 108.01),
    ("quang-ninh", "van-don", "Vân Đồn", 21.07, 107.42),
    ("quang-tri", "dong-hoi", "Đồng Hới", 17.60, 106.36),
    ("quang-tri", "dong-ha", "Đông Hà", 16.82, 107.10),
    ("ca-mau", "ca-mau-tp", "Cà Mau", 9.09, 105.04),
    ("ca-mau", "mui-ca-mau", "Mũi Cà Mau", 8.57, 104.82),
    ("dak-lak", "tuy-hoa", "Tuy Hòa", 13.27, 109.25),
    ("gia-lai", "quy-nhon", "Quy Nhơn", 13.89, 109.11),
    ("dong-nai", "vung-tau", "Vũng Tàu", 10.87, 107.10),
    ("tay-ninh", "tay-ninh-tp", "Tây Ninh", 11.25, 106.20),
    ("lao-cai", "sa-pa", "Sa Pa", 22.34, 103.84),
    # Hub city-unit carve từ tỉnh phủ=0 (density-probe 2026-08-24) — lõi tham quan chặt.
    ("dien-bien", "dien-bien-phu", "Điện Biên Phủ", 21.398, 103.032),
    ("ha-giang", "dong-van", "Đồng Văn", 23.227, 105.202),
    ("nghe-an", "vinh", "Vinh", 18.708, 105.584),
    ("cao-bang", "cao-bang-tp", "Cao Bằng", 22.701, 106.191),
    ("thanh-hoa", "thanh-hoa-tp", "Thanh Hóa", 19.904, 105.858),
    ("lang-son", "lang-son-tp", "Lạng Sơn", 21.856, 106.747),
]


def load(parent, fn):
    p = os.path.join("tourism-kb", "export", parent, fn)
    return json.load(io.open(p, encoding="utf-8")) if os.path.exists(p) else None


def co(r):
    c = r.get("coordinates") or {}
    return c.get("latitude"), c.get("longitude")


def near(r, center, rad):
    la, lo = co(r)
    return la is not None and hav(center, (la, lo)) <= rad


def write(slug, fn, data):
    p = _dr.kiem_loi_ra(os.path.join("tourism-kb", "export", slug, fn))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    json.dump(data, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, p)


for parent, slug, ten, lat, lon in UNITS:
    center = (lat, lon)
    dd = load(parent, "diem-den.json") or []
    nh = load(parent, "nha-hang.json") or []
    ks = load(parent, "khach-san.json") or []
    meta = load(parent, "meta.json") or {}
    allow = WARD_ALLOW.get(slug)
    sub_dd = [r for r in dd if ward_of(r) in allow] if allow else [r for r in dd if near(r, center, R_DD)]
    sub_nh = [r for r in nh if near(r, center, R_ANU)]
    sub_ks = [r for r in ks if near(r, center, R_ANU)]
    if len(sub_dd) < 8:
        print("  SKIP %-14s (%s): chi %d diem den" % (slug, ten, len(sub_dd)))
        continue
    m = dict(meta)                                   # copy parent (giu osrm_diem_den matrix — subset ID lookup)
    m["dia_diem"] = slug
    m["tam"] = {"lat": lat, "lon": lon}
    m["so_luong"] = {"diem_den": len(sub_dd), "nha_hang": len(sub_nh), "khach_san": len(sub_ks),
                     "khach_san_chi_dia_chi": 0}
    _note = "city-unit tach tu %s (ban kinh %gkm)" % (parent, R_DD)
    _gc = meta.get("ghi_chu")
    m["ghi_chu"] = (_gc + [_note]) if isinstance(_gc, list) else ([_note] if _gc is None else [str(_gc), _note])
    write(slug, "diem-den.json", sub_dd)
    write(slug, "nha-hang.json", sub_nh)
    write(slug, "khach-san.json", sub_ks)
    write(slug, "meta.json", m)
    pid = sum(1 for r in sub_dd if (r.get("external_ids") or {}).get("google_place_id"))
    inmat = 0
    ids = set((meta.get("osrm_diem_den") or {}).get("ids") or [])
    inmat = sum(1 for r in sub_dd if r["id"] in ids)
    print("  OK  %-14s (%-12s) dd=%2d nh=%3d ks=%3d | place_id=%2d matrix=%d/%d"
          % (slug, ten, len(sub_dd), len(sub_nh), len(sub_ks), pid, inmat, len(sub_dd)))


# ── Carve REGISTRY-DRIVEN tu trip-planner/lib/planner/areas.json ────────────────────────────────
# Nguon DUY NHAT ve khu du lich trong tinh sap nhap (dong bo voi engine TS). Moi khu co "slug" ->
# carve slug rieng bang WARD-ALLOW (chinh xac hon ban kinh khi 2 town <22km). ADDITIVE (khong tru parent
# lan nay — carve nua voi lam parent te hon; fame-seed engine da lo parent-query dung khu). Subtractive
# hoan toi khi phu du khu 1 parent. Nha-hang/khach-san lay ban kinh quanh center (dia chi ward khong sach).
_areas_p = os.path.join("trip-planner", "lib", "planner", "areas.json")
try:
    _AREAS = json.load(io.open(_areas_p, encoding="utf-8")).get("areas", [])
except FileNotFoundError:
    _AREAS = []
    print("  (areas.json khong thay -> bo qua carve registry)")

for a in _AREAS:
    slug = a.get("slug")
    if not slug:
        continue
    parent, ten = a["parent"], a.get("displayName", slug)
    center = (a["center"]["lat"], a["center"]["lon"])
    allow = set(a.get("wardAllow") or [])
    dd = load(parent, "diem-den.json") or []
    nh = load(parent, "nha-hang.json") or []
    ks = load(parent, "khach-san.json") or []
    meta = load(parent, "meta.json") or {}
    if not dd:
        print("  SKIP %-14s (%s): parent %s khong co export" % (slug, ten, parent))
        continue
    sub_dd = [r for r in dd if ward_of(r) in allow]
    sub_nh = [r for r in nh if near(r, center, R_ANU)]
    sub_ks = [r for r in ks if near(r, center, R_ANU)]
    if len(sub_dd) < 8:
        print("  SKIP %-14s (%s): chi %d diem den" % (slug, ten, len(sub_dd)))
        continue
    m = dict(meta)
    m["dia_diem"] = slug
    m["tam"] = {"lat": center[0], "lon": center[1]}
    m["so_luong"] = {"diem_den": len(sub_dd), "nha_hang": len(sub_nh), "khach_san": len(sub_ks),
                     "khach_san_chi_dia_chi": 0}
    _note = "carve tu %s (ward-allow registry, areas.json)" % parent
    _gc = meta.get("ghi_chu")
    m["ghi_chu"] = (_gc + [_note]) if isinstance(_gc, list) else ([_note] if _gc is None else [str(_gc), _note])
    write(slug, "diem-den.json", sub_dd)
    write(slug, "nha-hang.json", sub_nh)
    write(slug, "khach-san.json", sub_ks)
    write(slug, "meta.json", m)
    ids = set((meta.get("osrm_diem_den") or {}).get("ids") or [])
    inmat = sum(1 for r in sub_dd if r["id"] in ids)
    print("  OK  %-14s (%-12s) dd=%2d nh=%3d ks=%3d | matrix=%d/%d"
          % (slug, ten, len(sub_dd), len(sub_nh), len(sub_ks), inmat, len(sub_dd)))
