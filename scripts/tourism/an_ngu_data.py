# -*- coding: utf-8 -*-
"""Chon loc lop LUU TRU + AN UONG cho ca hai bo dung. CHI CHON, KHONG DINH DANG.

Cung khuon voi `hoat_dong_data.py`: mot nguon chon loc, hai nguon dinh dang.
420 co so luu tru va 5.559 quan an khong in het duoc, va neu logic cat gon nam
trong ca hai bo dung thi ban .md va .docx se lech nhau ma khong ai biet.

BAT DOI XUNG GIUA HAI NHOM, va no quyet dinh in gi:

  LUU TRU  213 ban ghi GIA THAT tu dang ky nha nuoc + hang tham dinh
           (401 "nhà nước" / 19 "tự đăng ký"). Day la nhom DUY NHAT trong ca
           du an co gia kem dau tham dinh cua co quan quan ly, nen gia duoc
           ghi THANG, khong phai vao `gia_tham_khao` nhu gia tu blog.
  AN UONG  Khong gia, khong danh gia, tu bat ky nguon hop le nao. Nen gia tri
           nam o: CON MO KHONG · BAN MON GI · GOI SO NAO.
"""
import json, io, os, unicodedata
from collections import Counter

MAX_MOI_BAC = 10        # co so luu tru in ra moi bac gia
MAX_MOI_NHOM = 8        # quan an in ra moi nhom
MAX_DONG_CUA = 14       # so dong cua gan nhat in ra

# Bac gia phong/dem. Moc lay tu chinh phan bo: trung vi 300.000.
BAC_GIA = [("Bình dân", 0, 300_000), ("Trung bình", 300_000, 1_000_000),
           ("Cao cấp", 1_000_000, 10**12)]

# Gom hang muc Overture thanh nhom nguoi doc hieu duoc.
NHOM_QUAN = [
    ("Quán Việt", {"vietnamese_restaurant", "noodles_restaurant", "soup_restaurant",
                   "eat_and_drink", "diner", "food_stand", "food"}),
    ("Lẩu · nướng · hải sản", {"barbecue_restaurant", "bar_and_grill_restaurant",
                               "seafood_restaurant", "chicken_restaurant",
                               "steakhouse", "hot_pot"}),
    ("Cà phê · trà", {"coffee_shop", "cafe", "tea_room", "bubble_tea",
                      "smoothie_juice_bar", "hong_kong_style_cafe"}),
    ("Bánh · tráng miệng", {"bakery", "desserts", "ice_cream_shop", "delicatessen"}),
    ("Món chay", {"vegetarian_restaurant", "health_food_restaurant"}),
    ("Bếp nước ngoài", {"korean_restaurant", "japanese_restaurant", "thai_restaurant",
                        "chinese_restaurant", "indian_restaurant", "french_restaurant",
                        "italian_restaurant", "pizza_restaurant", "sushi_restaurant",
                        "asian_restaurant", "american_restaurant", "burger_restaurant",
                        "taiwanese_restaurant", "mediterranean_restaurant"}),
    ("Quán bar · pub", {"bar", "pub", "cocktail_bar", "beer_bar", "beer_garden",
                        "wine_bar", "gastropub", "sports_bar", "brewery", "sake_bar"}),
]


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def _tien(n):
    return f"{n:,}".replace(",", ".") + "₫" if n else None


def tai_luu_tru(raw_dir):
    p = os.path.join(raw_dir, "luu_tru.json")
    if not os.path.exists(p):
        return None
    d = json.load(io.open(p, encoding="utf-8"))
    cs = [r for r in d["co_so"] if not r.get("da_dong_cua")]

    bac = []
    for ten, lo, hi in BAC_GIA:
        rows = [r for r in cs if r["gia_min"] and lo <= r["gia_min"] < hi]
        rows.sort(key=lambda r: (r["tham_dinh"] != "nhà nước", -(r["so_phong"] or 0)))
        bac.append({
            "ten": ten, "tong": len(rows),
            "co_so": [{
                "ten": r["ten"], "loai": r["loai"],
                "gia": (_tien(r["gia_min"]) + ("–" + _tien(r["gia_max"])
                                               if r["gia_max"] and r["gia_max"] != r["gia_min"] else "")),
                "so_phong": r["so_phong"], "dien_thoai": r["dien_thoai"],
                "dia_chi": r["dia_chi"], "tham_dinh": r["tham_dinh"],
            } for r in rows[:MAX_MOI_BAC]],
        })

    tt = Counter(r["tham_dinh"] for r in d["co_so"])
    dong = [r for r in d["co_so"] if r.get("da_dong_cua")] + d.get("dong_cua_ngoai_dang_ky", [])
    dong.sort(key=lambda r: r["da_dong_cua"], reverse=True)
    return {
        "tong": len(d["co_so"]), "co_gia": sum(1 for r in cs if r["gia_min"]),
        "nha_nuoc": tt.get("nhà nước", 0), "tu_dang_ky": tt.get("tự đăng ký", 0),
        "co_so_phong": sum(1 for r in cs if r["so_phong"]),
        "co_dien_thoai": sum(1 for r in cs if r["dien_thoai"]),
        "bac": bac,
        "dong_cua": [{"ten": r["ten"], "ngay": r["da_dong_cua"]} for r in dong],
    }


def tai_an_uong(raw_dir):
    p = os.path.join(raw_dir, "nha_hang.json")
    if not os.path.exists(p):
        return None
    d = json.load(io.open(p, encoding="utf-8"))
    mo = [r for r in d["quan"] if not r.get("da_dong_cua")]

    nhom = []
    for ten, cats in NHOM_QUAN:
        rows = [r for r in mo if r["hang_muc"] in cats]
        # Xep theo do tin cay Overture, va uu tien quan CO SO DIEN THOAI — so
        # dien thoai la thu duy nhat bien mot dong du lieu thanh mot viec lam duoc.
        rows.sort(key=lambda r: (not r["dien_thoai"], -(r["tin_cay"] or 0)))
        nhom.append({
            "ten": ten, "tong": len(rows),
            "quan": [{"ten": r["ten"], "dien_thoai": r["dien_thoai"],
                      "dia_chi": r["dia_chi"], "mon": r["mon"]}
                     for r in rows[:MAX_MOI_NHOM]],
        })

    dong = [{"ten": r["ten"], "ngay": r["da_dong_cua"]}
            for r in d["quan"] if r.get("da_dong_cua")]
    dong += [{"ten": r["ten"], "ngay": r["da_dong_cua"]}
             for r in d.get("dong_cua_ngoai_danh_sach", [])]
    dong.sort(key=lambda r: r["ngay"], reverse=True)
    # Mot quan co the vao ca hai danh sach duoi hai cach viet ten
    # ("Gout Coffee & Pastry" tu Overture, "Gout Coffee" tu Foursquare). Khu
    # theo ten da bo dau + cung ngay dong — in hai lan lam nguoi doc tuong la
    # hai quan cung dong mot ngay.
    _da, _d2 = set(), []
    for r in dong:
        t = fold(r["ten"])
        k = next((x for x in _da if x in t or t in x), None)
        if k:
            continue
        _da.add(t)
        _d2.append(r)
    dong = _d2
    return {
        "tong_mo": len(mo), "tong_dong": len(dong),
        "co_dien_thoai": sum(1 for r in mo if r["dien_thoai"]),
        "nhom": [n for n in nhom if n["tong"]],
        "dong_cua": dong[:MAX_DONG_CUA],
        "ten_da_dong": {fold(r["ten"]) for r in dong},
    }
