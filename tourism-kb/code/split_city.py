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

# Child slug o day duoc TRU khoi parent (subtractive carve) — mac dinh carve la ADDITIVE (giu parent).
# Chi bat khi child la diem den DOC LAP, xa lom tam parent, gay nhieu itinerary parent (vd Vung Tau ~95km +
# Con Dao ~180km deu do vao ho-chi-minh sau sap nhap 2025 -> auto-marquee seed nham cum bien, chon lap lai
# loi trung tam SG). Opt-in tung slug => moi parent khac giu additive nhu cu (0 regression). Diem-den THOI
# (nha-hang/khach-san engine re-filter theo centroid chuyen -> leak vo hai). LUU Y: subtract doc parent goc
# TRONG cung 1 run (child carve TRUOC, tru parent SAU); chay lai split_city.py doc lap can re-export parent
# truoc (rebuild_tourism.py da lo: export_planner -> split_city moi lan).
SUBTRACT_FROM_PARENT = {"vung-tau", "con-dao"}

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
    ("ho-chi-minh", "vung-tau", "Vũng Tàu", 10.35, 107.08),
    ("ho-chi-minh", "con-dao", "Côn Đảo", 8.683, 106.607),   # đặc khu đảo (sáp nhập TP.HCM 2025) — điểm đến độc lập

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


def carve_area(a, load_fn=load):
    """Tach MOT khu tu mot entry areas.json (registry-driven carve). Tra ve (slug, ten, sub_dd, sub_nh,
    sub_ks, meta) hoac None neu bo qua (thieu field / parent khong co export / qua it diem den). Tach
    rieng ham nay (khong inline trong vong lap) de test duoc voi fixture tong hop, khong dung KB that —
    logic subscript PHAI dung .get() (a["parent"]/a["center"]["lat"] cu se raise KeyError/TypeError
    tren entry hong thay vi crash toan bo pipeline).
    """
    if not isinstance(a, dict):
        return None
    slug = a.get("slug")
    if not slug:
        return None
    parent = a.get("parent")
    ten = a.get("displayName", slug)
    center_raw = a.get("center")
    if not isinstance(center_raw, dict):
        center_raw = {}
    lat, lon = center_raw.get("lat"), center_raw.get("lon")
    if not parent or lat is None or lon is None:
        print("  SKIP %-14s (%s): thieu parent/center trong areas.json" % (slug, ten))
        return None
    center = (lat, lon)
    allow = set(a.get("wardAllow") or [])
    dd = load_fn(parent, "diem-den.json") or []
    nh = load_fn(parent, "nha-hang.json") or []
    ks = load_fn(parent, "khach-san.json") or []
    meta = load_fn(parent, "meta.json") or {}
    if not dd:
        print("  SKIP %-14s (%s): parent %s khong co export" % (slug, ten, parent))
        return None
    sub_dd = [r for r in dd if ward_of(r) in allow]
    sub_nh = [r for r in nh if near(r, center, R_ANU)]
    sub_ks = [r for r in ks if near(r, center, R_ANU)]
    if len(sub_dd) < 8:
        print("  SKIP %-14s (%s): chi %d diem den" % (slug, ten, len(sub_dd)))
        return None
    return slug, ten, center, sub_dd, sub_nh, sub_ks, meta


def subtract_from_parent(pdd, pmeta, drop_ids):
    """PURE (khong I/O): tru diem-den da carve ra child (SUBTRACT_FROM_PARENT) khoi parent goc.
    Tra ve (kept, new_meta, removed, warnings). Cap nhat so_luong.diem_den + ghi_chu tren BAN COPY
    cua pmeta (khong mutate input). Tach rieng khoi main() de test duoc voi fixture, giong carve_area.
    warnings != [] khi so_luong sai kieu (co nhung khong phai dict) -> caller PHAI in canh bao: neu am
    tham bo qua thi diem-den.json co the co 309 diem con meta.so_luong.diem_den giu 446 cu (drift), va
    drift do se khong thay trong log CI (lesson could-not-test / named-const: mot no-op phai keu ra)."""
    drop = set(drop_ids)
    kept = [r for r in pdd if r.get("id") not in drop]
    removed = len(pdd) - len(kept)
    warnings = []
    new_meta = dict(pmeta)
    sl = new_meta.get("so_luong")
    if isinstance(sl, dict):
        sl = dict(sl)
        sl["diem_den"] = len(kept)
        new_meta["so_luong"] = sl
    elif sl is not None:  # co so_luong nhung sai kieu -> KHONG cap nhat duoc => canh bao (khong am tham)
        warnings.append("so_luong kieu %s (khong phai dict) -> diem_den meta KHONG cap nhat, co the drift"
                        % type(sl).__name__)
    _note = "da tach %d diem-den ra child doc lap (%s)" % (removed, ", ".join(sorted(SUBTRACT_FROM_PARENT)))
    _gc = new_meta.get("ghi_chu")
    new_meta["ghi_chu"] = (_gc + [_note]) if isinstance(_gc, list) else ([_note] if _gc is None else [str(_gc), _note])
    return kept, new_meta, removed, warnings


def main():
    carved_ids = {}  # parent slug -> set(id diem-den da carve ra child subtractive) => tru khoi parent cuoi ham
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
        if slug in SUBTRACT_FROM_PARENT:
            carved_ids.setdefault(parent, set()).update(r["id"] for r in sub_dd)
        pid = sum(1 for r in sub_dd if (r.get("external_ids") or {}).get("google_place_id"))
        inmat = 0
        ids = set((meta.get("osrm_diem_den") or {}).get("ids") or [])
        inmat = sum(1 for r in sub_dd if r["id"] in ids)
        print("  OK  %-14s (%-12s) dd=%2d nh=%3d ks=%3d | place_id=%2d matrix=%d/%d"
              % (slug, ten, len(sub_dd), len(sub_nh), len(sub_ks), pid, inmat, len(sub_dd)))

    # ── Carve REGISTRY-DRIVEN tu trip-planner/lib/planner/areas.json ────────────────────────────
    # Nguon DUY NHAT ve khu du lich trong tinh sap nhap (dong bo voi engine TS). Moi khu co "slug" ->
    # carve slug rieng bang WARD-ALLOW (chinh xac hon ban kinh khi 2 town <22km). ADDITIVE (khong tru
    # parent lan nay — carve nua voi lam parent te hon; fame-seed engine da lo parent-query dung khu).
    # Subtractive hoan toi khi phu du khu 1 parent. Nha-hang/khach-san lay ban kinh quanh center (dia
    # chi ward khong sach). Entry areas.json hong (thieu key / kieu sai) -> .get()-defensive + skip,
    # khong crash ca pipeline (xem carve_area()).
    _areas_p = os.path.join("trip-planner", "lib", "planner", "areas.json")
    try:
        _AREAS = json.load(io.open(_areas_p, encoding="utf-8")).get("areas", [])
    except (FileNotFoundError, KeyError, TypeError, json.JSONDecodeError):
        _AREAS = []
        print("  (areas.json khong thay hoac loi doc -> bo qua carve registry)")

    for a in _AREAS:
        carved = carve_area(a)
        if carved is None:
            continue
        slug, ten, center, sub_dd, sub_nh, sub_ks, meta = carved
        parent = a.get("parent")
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
        if slug in SUBTRACT_FROM_PARENT:
            carved_ids.setdefault(parent, set()).update(r["id"] for r in sub_dd)
        ids = set((meta.get("osrm_diem_den") or {}).get("ids") or [])
        inmat = sum(1 for r in sub_dd if r["id"] in ids)
        print("  OK  %-14s (%-12s) dd=%2d nh=%3d ks=%3d | matrix=%d/%d"
              % (slug, ten, len(sub_dd), len(sub_nh), len(sub_ks), inmat, len(sub_dd)))

    # ── SUBTRACTIVE: tru diem-den da carve ra child (SUBTRACT_FROM_PARENT) khoi parent ─────────────
    # Doc parent GOC (child da carve o tren tu cung ban goc trong run nay), loc bo id da carve qua
    # subtract_from_parent() (pure, test duoc), ghi lai. Chi diem-den. Parent khong co child subtractive
    # -> khong dung toi. removed==0 (vd re-run standalone khi parent da bi tru) -> bo qua, khong ghi de.
    for parent, drop in carved_ids.items():
        pdd = load(parent, "diem-den.json") or []
        pmeta = load(parent, "meta.json") or {}
        kept, new_meta, removed, warnings = subtract_from_parent(pdd, pmeta, drop)
        if removed == 0:
            continue
        for w in warnings:
            print("  WARN %-14s %s" % (parent, w))
        write(parent, "diem-den.json", kept)
        write(parent, "meta.json", new_meta)
        print("  SUB %-14s diem-den %d -> %d (tru %d ra child)" % (parent, len(pdd), len(kept), removed))


if __name__ == "__main__":
    main()
