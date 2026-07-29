# -*- coding: utf-8 -*-
"""Tim quan an vat / mon dac trung Da Lat theo TEN MON, tren du lieu da tai ve.

BAY DA GAP: bo dau roi so khop la hong. Trong tieng Viet:
    "Sửa chữa"  -> sua chua      "Sữa chua"   -> sua chua     (tiem sua xe = quan sua chua)
    "Kem bôi da"-> kem boi da    "Kem bơ"     -> kem bo       ("kem bo" nam trong "kem boi")
    "Cà Phê Phố"-> ca phe pho    "Phở"        -> pho
Nen o day GIU NGUYEN DAU va doi hoi bien tu. Ham fold() dung cho hop nhat dia diem
la dung cho viec do, nhung dem sang so khop mon an thi bien tiem sua xe thanh quan
sua chua.
"""
import json, os, sys, io, re, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "mon_an_dalat.json")

# (ten hien thi, cac bien the viet co dau)
DISHES = [
    ("Bánh tráng nướng", ["bánh tráng nướng"]),
    ("Bánh căn",         ["bánh căn"]),
    ("Bánh ướt lòng gà", ["bánh ướt lòng gà", "bánh ướt"]),
    ("Nem nướng",        ["nem nướng"]),
    ("Bún bò",           ["bún bò"]),
    ("Sữa đậu nành",     ["sữa đậu nành", "sữa đậu"]),
    ("Kem bơ",           ["kem bơ"]),
    ("Trứng nướng",      ["trứng nướng"]),
    ("Xiên nướng / xiên bẩn", ["xiên nướng", "xiên bẩn"]),
    ("Sữa chua",         ["sữa chua"]),
    ("Chè",              ["chè "]),
    ("Ốc",               ["ốc "]),
    ("Lẩu",              ["lẩu"]),
    ("Bánh mì",          ["bánh mì"]),
    ("Cơm tấm",          ["cơm tấm"]),
    ("Phở",              ["phở"]),
    ("Cháo",             ["cháo"]),
    ("Dâu tây",          ["dâu tây"]),
    ("Atisô",            ["atisô", "actiso", "atiso"]),
    ("Bánh mì xíu mại",  ["xíu mại"]),
]

# Tu khoa loai bo: ten chua cac tu nay thi khong phai hang an
NOT_FOOD = ["sửa chữa", "sửa xe", "kem bôi", "kem dưỡng", "mỹ phẩm", "spa", "thẩm mỹ",
            "bảo hiểm", "bất động sản", "vật liệu", "điện máy", "điện thoại", "ngân hàng",
            "phụ tùng", "xây dựng", "nội thất", "in ấn", "quảng cáo", "vận tải"]


def has_dish(name, variants):
    """Khop CO DAU, va phai co bien tu o hai dau — tranh 'ốc' khop vao 'Ngọc'."""
    n = " " + (name or "").lower().strip() + " "
    for v in variants:
        v = v.strip()
        # bien tu: khong phai chu cai tieng Viet o truoc va sau
        pat = r"(?<![0-9A-Za-zÀ-ỹ])" + re.escape(v) + r"(?![0-9A-Za-zÀ-ỹ])"
        if re.search(pat, n):
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
print(f"quet {len(ovt)} dong Overture\n")

found, seen_names = {}, set()
for label, variants in DISHES:
    hits = []
    for r in ovt:
        nm = r.get("name")
        if not nm or not has_dish(nm, variants) or not is_food_place(r):
            continue
        key = (nm.strip().lower(), round(r["lat"], 4), round(r["lon"], 4))
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
    hits.sort(key=lambda x: -(x["tin_cay"] or 0))
    found[label] = hits

json.dump(found, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

tot = sum(len(v) for v in found.values())
print(f"{'Món':26s}{'Quán':>6s}{'Có SĐT':>8s}{'Có FB':>7s}   Ví dụ")
for label, hits in sorted(found.items(), key=lambda x: -len(x[1])):
    if not hits:
        continue
    tel = sum(1 for h in hits if h["dien_thoai"])
    fb = sum(1 for h in hits if h["facebook"])
    print(f"{label:26s}{len(hits):6d}{tel:8d}{fb:7d}   " +
          " · ".join(h["ten"][:24] for h in hits[:2]))
print(f"\nTONG: {tot} quan, {len([k for k,v in found.items() if v])} mon")
print(f"saved -> {OUT}")
