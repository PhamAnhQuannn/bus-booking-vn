# -*- coding: utf-8 -*-
"""Tang 2 — refine nhan trai_nghiem (chi loai MO HO) bang category Overture. Module chung.

Chi dong vao 2 loai catch-all cua tang 1: "Điểm tham quan" (fallback generic) + "Khu vui chơi".
Match diem den -> POI Overture cung TEN, GAN (matcher 2-truc kieu resolve_diem_den, boundary-aware),
category thuoc ATTR_CATS -> map OVT_EXP sang nhan tinh hon. Khong match tin cay -> giu nhan tang 1.
BAO THU + ADDITIVE: khong bao gio ha cap nhan da cu the (chi xet loai mo ho).

sweep_overture_vn.py import ATTR_CATS de loc S3; enrich_trai_nghiem.py import refine_label().
"""
import math
import unicodedata

# ── loai category.primary DUOC phep refine (catch-all mo ho cua tang 1) ─────────
AMBIG = {"Điểm tham quan", "Khu vui chơi"}

# ── matcher 2-truc (copy tu resolve_diem_den.py — self-contained) ───────────────
GENERIC = {"khu", "du", "lich", "diem", "danh", "thang", "canh", "cong", "vien", "ho",
           "nui", "thac", "chua", "den", "nha", "tho", "bao", "tang", "vuon", "quan",
           "the", "va", "cua", "cho"}
EXCLUDE_NAME = ("khach san", "hotel", "resort", "homestay", "hostel", "guest house",
                "spa center", "massage", "cafe", "coffee", "nha hang", "restaurant",
                "cho thue", "for rent", "du an ")

# Overture category chuan (CDLA) -> tap nhan hop le cho attraction that
ATTR_CATS = {
    "landmark_and_historical_building", "monument", "memorial", "historic_site", "castle",
    "fort", "palace", "buddhist_temple", "hindu_temple", "temple", "shrine", "monastery",
    "church_cathedral", "catholic_church", "cathedral", "pentecostal_church",
    "evangelical_church", "church", "beach", "beach_resort", "park", "botanical_garden",
    "garden", "museum", "history_museum", "science_museum", "art_museum",
    "decorative_arts_museum", "childrens_museum", "amusement_park", "water_park",
    "theme_park", "zoo", "aquarium", "lake", "reservoir", "waterfall", "island",
    "scenic_lookout", "viewpoint", "mountain", "cable_car", "market", "night_market",
    "flea_market", "farmers_market", "public_market", "art_gallery",
    "arts_and_entertainment", "bridge", "pier", "harbor", "plaza", "tower",
}

# Overture category -> nhan trai nghiem tinh (tai dung tu vung tang 1 + vai nhan moi).
# CHU Y: KHONG map "attractions_and_activities"/"tourist_attraction" — chung cung generic,
# refine sang generic khac = vo nghia -> bo qua (giu nhan tang 1).
OVT_EXP = {
    "museum": "Tham quan lịch sử / văn hóa",
    "history_museum": "Tham quan lịch sử / văn hóa",
    "science_museum": "Tham quan lịch sử / văn hóa",
    "childrens_museum": "Tham quan lịch sử / văn hóa",
    "art_museum": "Tham quan nghệ thuật / văn hóa",
    "decorative_arts_museum": "Tham quan nghệ thuật / văn hóa",
    "art_gallery": "Tham quan nghệ thuật / văn hóa",
    "buddhist_temple": "Tham quan tâm linh / kiến trúc",
    "hindu_temple": "Tham quan tâm linh / kiến trúc",
    "temple": "Tham quan tâm linh / kiến trúc",
    "shrine": "Tham quan tâm linh / kiến trúc",
    "monastery": "Tham quan tâm linh / kiến trúc",
    "church_cathedral": "Tham quan kiến trúc / tâm linh",
    "catholic_church": "Tham quan kiến trúc / tâm linh",
    "cathedral": "Tham quan kiến trúc / tâm linh",
    "pentecostal_church": "Tham quan kiến trúc / tâm linh",
    "evangelical_church": "Tham quan kiến trúc / tâm linh",
    "church": "Tham quan kiến trúc / tâm linh",
    # CHU Y: BO "landmark_and_historical_building" + "arts_and_entertainment" — qua generic,
    # nuot nham thac/park/theme-park/thuy-cung (diff review 2026-08-08). Chi giu loai CU THE.
    "monument": "Tham quan lịch sử / kiến trúc",
    "memorial": "Tham quan lịch sử / kiến trúc",
    "historic_site": "Tham quan lịch sử / kiến trúc",
    "castle": "Tham quan lịch sử / kiến trúc",
    "fort": "Tham quan lịch sử / kiến trúc",
    "palace": "Tham quan lịch sử / kiến trúc",
    "tower": "Tham quan lịch sử / kiến trúc",
    "waterfall": "Ngắm cảnh",
    "lake": "Ngắm cảnh / đi dạo",
    "reservoir": "Ngắm cảnh / đi dạo",
    "park": "Ngắm cảnh / chụp ảnh",
    "botanical_garden": "Ngắm cảnh / chụp ảnh",
    "garden": "Ngắm cảnh / chụp ảnh",
    "plaza": "Ngắm cảnh / chụp ảnh",
    "bridge": "Ngắm cảnh / chụp ảnh",
    "pier": "Ngắm cảnh / chụp ảnh",
    "harbor": "Ngắm cảnh / chụp ảnh",
    "mountain": "Ngắm cảnh / leo núi",
    "scenic_lookout": "Ngắm cảnh / leo núi",
    "viewpoint": "Ngắm cảnh / leo núi",
    "beach": "Ngắm cảnh / tắm biển",
    "beach_resort": "Ngắm cảnh / tắm biển",
    "island": "Ngắm cảnh / biển đảo",
    "amusement_park": "Vui chơi dịch vụ / ngắm cảnh",
    "water_park": "Vui chơi dịch vụ / ngắm cảnh",
    "theme_park": "Vui chơi dịch vụ / ngắm cảnh",
    "zoo": "Tham quan thiên nhiên / vui chơi",
    "aquarium": "Tham quan thiên nhiên / vui chơi",
    "cable_car": "Ngắm cảnh / vui chơi dịch vụ",
    "market": "Mua sắm / ăn uống / tham quan",
    "night_market": "Mua sắm / ăn uống / tham quan",
    "flea_market": "Mua sắm / ăn uống / tham quan",
    "farmers_market": "Mua sắm / ăn uống / tham quan",
    "public_market": "Mua sắm / ăn uống / tham quan",
}

MAX_M = 300.0   # coord export la diem da phan giai -> ban kinh chat (name la gate that su)


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


def _match(rec, ov_points):
    """rec (export diem-den) -> POI Overture khop ten + trong MAX_M; None neu khong tin cay.
    ov_points: list dict {name, category(lower), lat, lon, confidence}. Nen loc san theo bbox tinh."""
    names = [rec["name"]] + (rec.get("alternate_names") or [])
    frags = [fold(n) for n in names if n]
    dtok = set()
    for n in names:
        dtok |= toks(n)
    c = rec.get("coordinates") or {}
    hint = (c.get("latitude"), c.get("longitude"))
    if hint[0] is None or hint[1] is None:
        return None
    best = None
    for r in ov_points:
        cat = r.get("category")
        if cat not in ATTR_CATS or cat not in OVT_EXP:      # phai la attraction MAP DUOC (bo generic)
            continue
        fn = fold(r["name"])
        if any(x in fn for x in EXCLUDE_NAME):
            continue
        hit = any(fr and fr in fn for fr in frags) or (dtok and dtok <= toks(r["name"]))
        if not hit:
            continue
        d = hav(hint, (r["lat"], r["lon"]))
        if d > MAX_M:
            continue
        key = (d, -(r.get("confidence") or 0.0))
        if best is None or key < best[1]:
            best = (r, key)
    return best[0] if best else None


def refine_label(rec, ov_points):
    """Tra (nhan, nguon, ov_cat). nguon='overture' neu refine, else 'category' (giu tang 1)."""
    if rec.get("category", {}).get("primary") not in AMBIG:
        return None, "category", None
    m = _match(rec, ov_points)
    if not m:
        return None, "category", None
    lab = OVT_EXP.get(m.get("category"))
    if not lab:
        return None, "category", None
    return lab, "overture", m.get("category")
