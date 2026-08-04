# -*- coding: utf-8 -*-
"""Tim quan ban MON DAC TRUNG Da Lat, tren du lieu da tai ve. Khong cham mang.

BAY DA GAP: bo dau roi so khop la hong. Trong tieng Viet:
    "Sửa chữa"  -> sua chua      "Sữa chua"   -> sua chua     (tiem sua xe = quan sua chua)
    "Kem bôi da"-> kem boi da    "Kem bơ"     -> kem bo       ("kem bo" nam trong "kem boi")
    "Cà Phê Phố"-> ca phe pho    "Phở"        -> pho
Nen o day GIU NGUYEN DAU va doi hoi bien tu.

─────────────────────────────────────────────────────────────────────────────
BA LOI CUA BAN DAU, va vi sao cach sua la nhu duoi:

1. XEP THEO SO QUAN DAO NGUOC CAU TRA LOI cho "an gi o Da Lat".
   Dan dau la Lẩu 229, Phở 90, Bánh mì 71, Ốc 62, Bún bò/Cháo/Cơm tấm 124 —
   mon co o MOI thanh pho Viet Nam. Con mon dac trung Da Lat nam cuoi: bánh
   tráng nướng 24, sữa đậu nành 9, kem bơ 7, xiên bẩn 6, trứng nướng 2.
   Nguoi doc quet tu tren xuong se tu van khach an pho o Da Lat.
   -> Them truong `nhom`, va xep TRONG TUNG NHOM.

2. BAY MON NOI TIENG THIEU HOAN TOAN. Do bang quet tu khoa:
       lẩu gà lá é   61   <- lau noi tieng nhat Da Lat, bi hut vao nhom "Lẩu"
                              chung nen vo hinh. Nhieu co so hon ca banh can
                              (48) va nem nuong (28).
       hồng treo gió 47   <- dac san mang ve so mot, vang mat han
       cơm lam       23 · cà phê nông trại 13 · mứt 10 · bánh bèo 9 · rượu vang 8

3. KHONG CO TRUC "an tai cho" vs "mang ve". Hong treo gio, mut, ruou vang, tra
   atiso, ca phe khong phai bua an. "An gi" va "mua gi mang ve" la hai cau hoi
   khac nhau.

Va: chua tung LOC QUAN DA DONG CUA. Hien may la 0 trung, nhung do la may chu
khong phai thiet ke — dung cung lo da sua o lop nha hang.
─────────────────────────────────────────────────────────────────────────────

Chay:  python tourism-kb/code/sweep_monan.py <thu-muc-raw>
"""
import json, os, sys, io, re, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "mon_an_dalat.json")

DS = "đặc sản Đà Lạt"      # an tai cho, gan nhu chi co o day
PT = "món phổ thông"       # co o moi thanh pho, chi la "cung co o Da Lat"
MV = "đặc sản mang về"     # mua ve lam qua, khong phai bua an

# (ten hien thi, nhom, cac bien the viet co dau)
DISHES = [
    # ── đặc sản Đà Lạt ──────────────────────────────────────────────────────
    ("Bánh tráng nướng", DS, ["bánh tráng nướng"]),
    ("Lẩu gà lá é", DS, ["lá é"]),
    ("Bánh căn", DS, ["bánh căn"]),
    ("Bánh ướt lòng gà", DS, ["bánh ướt lòng gà", "bánh ướt"]),
    ("Nem nướng", DS, ["nem nướng"]),
    ("Sữa đậu nành", DS, ["sữa đậu nành", "sữa đậu"]),
    ("Kem bơ", DS, ["kem bơ"]),
    ("Trứng nướng", DS, ["trứng nướng"]),
    ("Xiên nướng / xiên bẩn", DS, ["xiên nướng", "xiên bẩn"]),
    ("Bánh mì xíu mại", DS, ["xíu mại"]),
    ("Dâu tây (vườn / quán)", DS, ["dâu tây"]),
    ("Atisô (món / trà)", DS, ["atisô", "actiso", "atiso"]),
    ("Cơm lam · gà nướng", DS, ["cơm lam", "ống tre"]),
    ("Chè hé", DS, ["chè hé"]),
    ("Khoai lang nướng · bắp nướng", DS, ["khoai lang nướng", "bắp nướng"]),
    # ── món phổ thông ───────────────────────────────────────────────────────
    ("Lẩu (các loại khác)", PT, ["lẩu"]),
    ("Phở", PT, ["phở"]),
    ("Bánh mì", PT, ["bánh mì"]),
    ("Ốc", PT, ["ốc"]),
    ("Bún bò", PT, ["bún bò"]),
    ("Cháo", PT, ["cháo"]),
    ("Cơm tấm", PT, ["cơm tấm"]),
    ("Chè", PT, ["chè"]),
    ("Sữa chua", PT, ["sữa chua"]),
    ("Bánh bèo", PT, ["bánh bèo"]),
    # ── đặc sản mang về ─────────────────────────────────────────────────────
    ("Hồng treo gió · hồng sấy", MV, ["hồng treo", "hồng sấy", "hồng giòn", "hồng dẻo"]),
    ("Mứt Đà Lạt", MV, ["mứt"]),
    ("Rượu vang Đà Lạt", MV, ["rượu vang"]),
    ("Cà phê nông trại · cà phê chồn", MV, ["cà phê chồn", "coffee farm",
                                            "nông trại cà phê", "rang xay"]),
    ("Bơ sáp", MV, ["bơ sáp"]),
]

# Ten chua cac tu nay thi khong phai hang an, du co ten mon trong do.
NOT_FOOD = ["sửa chữa", "sửa xe", "kem bôi", "kem dưỡng", "mỹ phẩm", "spa", "thẩm mỹ",
            "bảo hiểm", "bất động sản", "vật liệu", "điện máy", "điện thoại", "ngân hàng",
            "phụ tùng", "xây dựng", "nội thất", "in ấn", "quảng cáo", "vận tải",
            "bán đất", "ký gửi", "cho thuê đất", "sang nhượng"]


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


# Cum PHU DINH: tu mon dung nghia nhung cum chua no lai la thu khac.
#   "đồi chè"  = doi TRA, khong phai mon CHE  ("Cafe Đồi chè Điện gió")
#   "vườn chè" · "trà atisô" o day la san pham mang ve, khong phai mon an tai cho
PHU_DINH = {
    "chè": ("đồi chè", "vườn chè", "nông trại chè", "đồi trà"),
    "mứt": ("mứt gừng cay",),      # de mo rong, hien chua can
}


def has_dish(name, variants):
    """Khop CO DAU, co bien tu hai dau, va khong nam trong cum phu dinh.

    Bien tu tranh 'ốc' khop vao 'Ngọc'. Cum phu dinh tranh 'chè' khop vao
    'đồi chè' — cung ho bay voi 'sữa chua'/'sửa chữa', chi o cap CUM thay vi
    cap DAU.
    """
    n = " " + (name or "").lower().strip() + " "
    for v in variants:
        v = v.strip()
        pat = r"(?<![0-9A-Za-zÀ-ỹ])" + re.escape(v) + r"(?![0-9A-Za-zÀ-ỹ])"
        if not re.search(pat, n):
            continue
        if any(bad in n for bad in PHU_DINH.get(v, ())):
            continue
        return True
    return False


def is_food_place(r):
    nm = (r.get("name") or "").lower()
    if any(bad in nm for bad in NOT_FOOD):
        return False
    cat = str(r.get("category") or "").lower()
    BAD_CAT = ("repair", "auto", "phone", "real_estate", "insurance", "bank", "spa",
               "beauty", "construction", "advertis", "logistics", "school", "hospital")
    return not any(b in cat for b in BAD_CAT)


ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))

# Quan DA DONG CUA — doc tu lop nha hang. Gioi thieu mot quan da dong la loi te
# nhat tai lieu nay co the mac.
DONG = set()
_p = os.path.join(RAW, "nha_hang.json")
if os.path.exists(_p):
    _nh = json.load(io.open(_p, encoding="utf-8"))
    DONG = ({fold(r["ten"]) for r in _nh["quan"] if r.get("da_dong_cua")}
            | {fold(r["ten"]) for r in _nh.get("dong_cua_ngoai_danh_sach", [])})

print(f"quét {len(ovt)} dòng Overture · {len(DONG)} quán đã đóng cửa để loại\n")

# `Lẩu gà lá é` phai bat TRUOC nhom `Lẩu` chung roi loai khoi nhom do — neu
# khong, 61 co so lá é bi hut vao 229 va bien mat.
la_e = {(r.get("name") or "").strip().lower()
        for r in ovt if has_dish(r.get("name"), ["lá é"])}

found, seen_names, n_dong = {}, set(), 0
for label, nhom, variants in DISHES:
    hits = []
    for r in ovt:
        nm = r.get("name")
        if not nm or not has_dish(nm, variants) or not is_food_place(r):
            continue
        if label.startswith("Lẩu (các loại khác)") and nm.strip().lower() in la_e:
            continue                      # da tinh o "Lẩu gà lá é"
        if fold(nm) in DONG:
            n_dong += 1
            continue
        key = (nm.strip().lower(), round(r["lat"], 4))
        if key in seen_names:
            continue
        seen_names.add(key)
        hits.append({
            "ten": nm.strip(), "loai": r.get("category"),
            "lat": r["lat"], "lon": r["lon"],
            "dia_chi": r.get("address"),
            "dien_thoai": (r.get("phones") or [None])[0],
            "facebook": (r.get("socials") or [None])[0],
            "tin_cay": r.get("confidence"),
        })
    hits.sort(key=lambda x: (not x["dien_thoai"], -(x["tin_cay"] or 0)))
    found[label] = {"nhom": nhom, "quan": hits}

json.dump(found, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

tot = sum(len(v["quan"]) for v in found.values())
for nhom in (DS, PT, MV):
    rows = [(k, v) for k, v in found.items() if v["nhom"] == nhom and v["quan"]]
    rows.sort(key=lambda x: -len(x[1]["quan"]))
    print(f"── {nhom.upper()} ──")
    print(f"{'Món':30s}{'Quán':>6s}{'SĐT':>6s}   Ví dụ")
    for label, v in rows:
        q = v["quan"]
        tel = sum(1 for h in q if h["dien_thoai"])
        print(f"{label:30s}{len(q):6d}{tel:6d}   " + " · ".join(h["ten"][:22] for h in q[:2]))
    print()

print(f"TỔNG: {tot} quán · {len([1 for v in found.values() if v['quan']])} món "
      f"· loại {n_dong} lượt quán đã đóng cửa")
print(f"saved -> {OUT}")
