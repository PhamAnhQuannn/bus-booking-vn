# -*- coding: utf-8 -*-
"""S1 — gan KHACH SAN va QUAN AN gan cho tung diem den. Khong cham mang.

Founder dua khung moi: moi diem den kem khoi khach san 3 bac gia x 3 khach san
va khoi quan an 3 bac gia x 3 quan. Ba agent tham dinh doc lap hoi tu vao cung
bon ket luan, va do luong xac nhan ca bon:

1. SO LUONG CO DINH 3x3 KHONG LAP DUOC. Do tren du lieu thuc: chi 24/36 diem
   lap du 3 bac x 3 khach san; NAM diem lap duoc 0 bac (Dinh Langbiang, Giao Xu
   Langbiang, KDL Lang Biang, Thung Lung Vang, Suoi Vang) vi khong co co so luu
   tru dang ky nao trong 5 km. Han muc co dinh tao ap luc noi chuan xac minh de
   "cho du 9". Nen o day: SO LUONG BIEN, bo bac rong.

2. TRUNG LAP. Neu in 9 khach san moi diem: 60 khach san khac nhau chiem 230
   luot in — moi cai lap 3,8 lan, va `TTC Premium Đà Lạt` xuat hien o 18/36
   diem. Trung tam Da Lat chi vai km nen "khach san gan X" hoi tu ve cung mot
   ro. Nen: toi da 2 moi bac, con bang chu day du nam o muc 4.

3. BAC GIA CHO NHA HANG khong ton tai — 0/5.559 quan co gia. Va tieu de bac gia
   TU NO la mot khang dinh du kien: "Quán đắt: 500.000-1.000.000₫/người" doc y
   nhu du lieu da xac minh du moi dong ben duoi trong. Nen: nhom quan theo LOAI
   MON, la thu co that.

4. `Rating` = 0 o ca ba cap. Khong tinh o day, khong in o dau.

Chay:  python scripts/tourism/gan_lan_can.py <thu-muc-raw>
"""
import json, os, sys, io, math
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "lan_can.json")

BAN_KINH_KS = 5000        # m — ngoai 5 km thi khong con goi la "gan"
BAN_KINH_QUAN = 2000
MAX_MOI_BAC = 2           # khach san moi bac gia
MAX_MOI_LOAI = 3          # quan moi loai mon

# Bac gia phong/dem. Moc tu chinh phan bo cua 213 ban ghi co gia: trung vi
# 300.000, nen 300k va 1tr chia ba nhom co so luong dung nghia.
BAC = [("Cao cấp", 1_000_000, 10 ** 12),
       ("Trung bình", 300_000, 1_000_000),
       ("Bình dân", 0, 300_000)]

# Nhom quan theo LOAI MON — thay cho bac gia, vi gia quan an khong ton tai.
LOAI_QUAN = [
    ("Quán Việt", {"vietnamese_restaurant", "noodles_restaurant", "soup_restaurant",
                   "eat_and_drink", "diner", "food_stand", "food", "restaurant"}),
    ("Lẩu · nướng · hải sản", {"barbecue_restaurant", "bar_and_grill_restaurant",
                               "seafood_restaurant", "chicken_restaurant", "steakhouse"}),
    ("Cà phê · trà", {"coffee_shop", "cafe", "tea_room", "bubble_tea",
                      "smoothie_juice_bar", "hong_kong_style_cafe"}),
    ("Bánh · tráng miệng", {"bakery", "desserts", "ice_cream_shop", "delicatessen"}),
    ("Món chay", {"vegetarian_restaurant", "health_food_restaurant"}),
]


def hav(a1, o1, a2, o2):
    R = 6371000.0
    p1, p2 = math.radians(a1), math.radians(a2)
    dp, dl = p2 - p1, math.radians(o2 - o1)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def km(m):
    return f"{m/1000:.1f} km".replace(".", ",") if m >= 950 else f"{int(round(m/50)*50)} m"


def tien(n):
    return f"{n:,}".replace(",", ".") + "₫" if n else None


picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
lt = json.load(io.open(os.path.join(RAW, "luu_tru.json"), encoding="utf-8"))["co_so"]
nh = json.load(io.open(os.path.join(RAW, "nha_hang.json"), encoding="utf-8"))["quan"]

# Bo moi co so DA DONG CUA truoc khi tinh. Gioi thieu mot noi da dong la loi te
# nhat tai lieu nay co the mac — khach di toi noi roi moi biet.
ks = [r for r in lt if r.get("lat") and not r.get("da_dong_cua")]
qa = [r for r in nh if r.get("lat") and not r.get("da_dong_cua")]
print(f"{len(picked)} điểm đến · {len(ks)} cơ sở lưu trú có toạ độ · {len(qa)} quán còn mở\n")

# ── Vi sao KHONG chan lap ─────────────────────────────────────────────────
# Toi da thu chan mot khach san o 6 lan. No ha dinh tu 12 xuong 11 va trung binh
# tu 3,0 xuong 2,9 — gan nhu vo ich, va viec do lo ra nguyen nhan that:
#
#     Cao cap  (>1tr)   10 co so toan Da Lat,  7 co toa do
#     Trung binh       124 co so,             70 co toa do
#     Binh dan (<300k)  78 co so,             43 co toa do
#
# Bac cao cap rut tu vung 7 co so cho ca 36 diem den, nen trung lap la BAT BUOC
# VE MAT SO HOC, khong phai loi thuat toan. Chan lap chi che mat dieu do.
#
# Nen thay vi chan, IN RA con so: moi bac ghi ro co bao nhieu co so trong ban
# kinh va bao nhieu tren toan thanh pho. Nguoi doc thay ngay vi sao cung mot ten
# lap lai, va do la thong tin that ve Da Lat.
VUNG_BAC = {t: sum(1 for r in ks if r["gia_min"] and lo <= r["gia_min"] < hi)
            for t, lo, hi in BAC}
for _t, _n in VUNG_BAC.items():
    print(f"  bậc {_t:12s} {_n:3d} cơ sở có toạ độ trên toàn Đà Lạt")
print()

out, dem_ks, thieu_ks = {}, Counter(), []
for p in picked:
    # ── khach san, chia bac gia, SO LUONG BIEN ──────────────────────────────
    gan = sorted(((hav(p["lat"], p["lon"], h["lat"], h["lon"]), h) for h in ks),
                 key=lambda t: t[0])
    trong_bk = [(d, h) for d, h in gan if d <= BAN_KINH_KS]
    bac_out = []
    for ten, lo, hi in BAC:
        rows = [(d, h) for d, h in trong_bk if h["gia_min"] and lo <= h["gia_min"] < hi]
        if not rows:
            continue                    # bo bac rong, khong in khoi trong
        bac_out.append({
            "ten": ten, "tong": len(rows), "tong_thanh_pho": VUNG_BAC[ten],
            "khach_san": [{
                "ten": h["ten"], "dia_chi": (h["dia_chi"] or "").split(",")[0],
                "khoang_cach": km(d),
                "gia": tien(h["gia_min"]) + (("–" + tien(h["gia_max"]))
                                             if h["gia_max"] and h["gia_max"] != h["gia_min"] else ""),
                "so_phong": h["so_phong"], "dien_thoai": h["dien_thoai"],
                "tham_dinh": h["tham_dinh"],
            } for d, h in rows[:MAX_MOI_BAC]],
        })
        for d, h in rows[:MAX_MOI_BAC]:
            dem_ks[h["ten"]] += 1

    # Diem khong co co so nao trong ban kinh: NOI RA khoang trong, khong in khoi
    # rong. Nam diem thuoc dien nay va do la dac diem that cua dia ly, khong
    # phai thieu du lieu.
    khong_co = None
    if not bac_out:
        khong_co = (f"Không có cơ sở lưu trú đăng ký trong {BAN_KINH_KS//1000} km."
                    + (f" Gần nhất: {gan[0][1]['ten']}, cách {km(gan[0][0])}."
                       if gan else ""))

    # ── quan an, nhom theo LOAI MON (khong phai bac gia) ────────────────────
    gan_q = sorted(((hav(p["lat"], p["lon"], q["lat"], q["lon"]), q) for q in qa),
                   key=lambda t: t[0])
    trong_q = [(d, q) for d, q in gan_q if d <= BAN_KINH_QUAN]
    loai_out = []
    for ten, cats in LOAI_QUAN:
        rows = [(d, q) for d, q in trong_q if q["hang_muc"] in cats]
        # Uu tien quan CO SO DIEN THOAI: so goi la thu duy nhat bien mot dong
        # du lieu thanh mot viec lam duoc.
        rows.sort(key=lambda t: (not t[1]["dien_thoai"], t[0]))
        if not rows:
            continue
        loai_out.append({
            "ten": ten, "tong": len(rows),
            "quan": [{"ten": q["ten"], "dia_chi": q["dia_chi"],
                      "khoang_cach": km(d), "dien_thoai": q["dien_thoai"],
                      "mon": q["mon"]} for d, q in rows[:MAX_MOI_LOAI]],
        })

    out[p["id"]] = {"bac_khach_san": bac_out, "khong_co_khach_san": khong_co,
                    "loai_quan": loai_out,
                    "tong_ks_trong_bk": len(trong_bk), "tong_quan_trong_bk": len(trong_q)}
    if khong_co:
        thieu_ks.append(p["name"])

json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

n_bac = sum(len(v["bac_khach_san"]) for v in out.values())
n_ks = sum(len(b["khach_san"]) for v in out.values() for b in v["bac_khach_san"])
n_q = sum(len(l["quan"]) for v in out.values() for l in v["loai_quan"])
print(f"khối khách sạn: {n_bac} bậc · {n_ks} lượt in  (khung 3×3 sẽ là 324)")
print(f"khối quán ăn  : {n_q} lượt in")
print(f"\nđiểm KHÔNG có cơ sở lưu trú trong {BAN_KINH_KS//1000} km: {len(thieu_ks)}")
for t in thieu_ks:
    print(f"   {t}")
print(f"\nkhách sạn khác nhau được in: {len(dem_ks)} · lặp nhiều nhất:")
for k, v in dem_ks.most_common(5):
    print(f"   {v:3d} lần  {k[:42]}")
print(f"   lặp trung bình {n_ks/max(len(dem_ks),1):.1f} lần")
print(f"   trùng lặp là BẮT BUỘC — bậc cao cấp chỉ có {VUNG_BAC['Cao cấp']} cơ sở có toạ")
print(f"   độ trên toàn Đà Lạt, chia cho 36 điểm đến. Mỗi bậc in kèm con số này.")
print(f"\nsaved -> {OUT}")
