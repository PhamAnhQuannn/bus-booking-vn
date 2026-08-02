# -*- coding: utf-8 -*-
"""P1 — dung lop HOAT DONG tu du lieu da co tren dia. Khong cham mang.

Vi sao lop nay ton tai: toan bo kho hien tai la DIA DIEM. Dia diem tra loi
"di dau". Khong co gi tra loi "lam gi" — va nguoi len ke hoach 3-5 ngay nghi
bang hoat dong, khong nghi bang toa do.

Hoat dong KHONG phai thuoc tinh cua dia diem: mot hoat dong dien ra o nhieu noi
(san may: nhieu doi), mot noi phuc vu nhieu hoat dong (ho Tuyen Lam: cheo SUP,
du thuyen, cam trai). Quan he nhieu-nhieu.

─────────────────────────────────────────────────────────────────────────────
BA LOI CUA BAN DAU, va vi sao cach sua la nhu duoi:

1. GOP LAN BA QUAN HE KHAC NHAU.
   "Đồ Phượt - Đồ dã ngoại" khop trekking; "Cửa Hàng Xe Đạp" khop dap xe. Ban
   DO cho mot hoat dong khong phai TO CHUC hoat dong do. Nay tach `vai_tro`:
       to_chuc  — dan khach di lam (Dalat Canyoning Highland)
       dia_diem — noi dien ra (Wind hill coffee quang cao san may)
       ban_do   — chi ban thiet bi  -> LOAI
   Ba thu nay trong bang tra ra giong nhau; chi doc TEN moi phan biet duoc.

2. TIN HANG MUC OVERTURE QUA MUC.
   `farmers_market` gan cho "Siêu thị Điện máy XANH".
   `sports_and_recreation_venue` gan cho "Tiệm Cơm HỒI ĐÓ".
   `beauty_and_spa` gan cho "Nối Mi Ngọc Vy" — noi mi khong phai hoat dong
   du lich. `attractions_and_activities` la THUNG CHUA CHUNG (99 hang, gom ca
   vuon dau), khong phai "don vi to chuc tour".
   Nay: chi dung hang muc HEP va da kiem; hang muc rong phai co them tu khoa
   trong ten moi tinh.

3. SAI NGUON CHO HOAT DONG THIEN NHIEN.
   "Tham quan thác" di tim trong TEN DOANH NGHIEP nen ra "Tám Trình Coffee".
   Thac va ho nam o kho DIA DIEM (merged_dalat.json), khong nam o kho doanh
   nghiep. Hai nguon khac nhau cho hai loai bang chung khac nhau.
─────────────────────────────────────────────────────────────────────────────

BAY TIENG VIET (chep tu sweep_monan.py, o day con nang hon vi tu ngan):
    "sup" nam trong "súp"/"supermarket" · "tour" nam trong "tourist"/"Tourism"
Nen: so khop GIU NGUYEN DAU + doi bien tu o hai dau.

Chay:  python scripts/tourism/sweep_hoat_dong.py <thu-muc-raw>
"""
import json, os, sys, io, re
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "hoat_dong.json")

# ── Vai tro cua mot co so doi voi mot hoat dong ─────────────────────────────
# Chi doc duoc tu TEN. Mot cua hang ban leu va mot cong ty dan di cam trai deu
# mang hang muc giong nhau va deu chua tu "cắm trại".
BAN_DO = ["cửa hàng", "shop", "tiệm", "siêu thị", "đại lý", "phụ kiện", "đồ dã ngoại",
          "đồ phượt", "thiết bị", "dụng cụ", "store", "mua bán", "sửa", "bảo dưỡng"]
TO_CHUC = ["tour", "tours", "du lịch", "lữ hành", "adventure", "travel", "dịch vụ",
           "công ty", "trải nghiệm", "cho thuê", "thuê"]


def vai_tro(name, cat):
    n = (name or "").lower()
    if any(b in n for b in BAN_DO):
        return "ban_do"
    if any(t in n for t in TO_CHUC) or cat in ("tours", "sightseeing_tour_agency"):
        return "to_chuc"
    return "dia_diem"


# ── Dinh nghia hoat dong ────────────────────────────────────────────────────
# (ten, nhom, tu khoa trong TEN, hang muc HEP, loai dia diem trong kho DIA DIEM)
#
# `hang muc HEP` = hang muc ma MOI hang mang no deu dung voi hoat dong. Hang muc
# rong (attractions_and_activities, beauty_and_spa, sports_and_recreation_venue,
# farmers_market) da bi bo — chung gan sai qua nhieu, xem khoi chu thich tren.
#
# Mua/gio/thoi luong CO Y de trong: phai den tu nguon co dan chung (P3 giay phep,
# P6 YouTube, hoac goi dien). "Cỏ hồng tháng 11-12" nghe dung nhung khong co
# dong du lieu nao tren dia noi the.
ACTS = [
    # ten, nhom, tu_khoa_ten, hang_muc_hep, loai_dia_diem
    #
    # `loai_dia_diem` phai KHOP CHUOI DAY DU voi cot `loai_vn` cua kho dia diem.
    # Lan dau toi doan la "Thác", "Hồ", "Chùa" va ca ba ra 0 — gia tri that la
    # "Thác nước", "Hồ / Đập", "Chùa / Thiền viện". Doc tu vung truoc khi anh xa.
    ("Săn mây", "ngắm cảnh", ["săn mây", "săn sương"], [], []),
    ("Ngắm cảnh từ điểm cao", "ngắm cảnh", [], [], ["Điểm ngắm cảnh"]),
    ("Tham quan thác", "ngắm cảnh", [], [], ["Thác nước"]),
    ("Tham quan hồ", "ngắm cảnh", [], [], ["Hồ / Đập"]),
    ("Tham quan đồi chè / nông trại chè", "nông nghiệp", ["đồi chè", "vườn trà"], [], []),

    ("Canyoning / vượt thác", "vận động", ["canyoning", "vượt thác"], [], []),
    ("Trekking / leo núi", "vận động", ["trekking", "leo núi"], [], ["Núi / Đèo / Đường mòn"]),
    ("Cắm trại / glamping", "vận động", ["cắm trại", "glamping", "camping"], ["campground"], []),
    ("Chèo SUP / kayak / du thuyền", "vận động", ["chèo sup", "kayak", "đạp vịt", "du thuyền"], [], []),
    ("Đạp xe", "vận động", ["đạp xe"], ["bike_rentals"], []),
    ("Zipline / đu dây", "vận động", ["zipline", "đu dây"], [], []),
    ("Câu cá", "vận động", ["câu cá"], ["fishing_club"], []),
    ("Xe jeep / xe địa hình", "vận động", ["jeep", "xe địa hình"],
     ["atv_rentals_and_tours", "atv_recreation_park"], []),
    ("Công viên giải trí", "vận động", [], ["amusement_park"], ["Khu vui chơi"]),

    ("Hái dâu tây tại vườn", "nông nghiệp", ["vườn dâu", "hái dâu"], [], []),
    ("Tham quan nông trại", "nông nghiệp", ["nông trại", "trang trại"],
     ["urban_farm", "dairy_farm"], ["Nông trại / Vườn"]),
    ("Tham quan vườn hoa / công viên", "nông nghiệp", ["vườn hoa", "làng hoa"],
     ["botanical_garden"], ["Công viên / Vườn hoa"]),

    ("Giao lưu cồng chiêng", "văn hoá", ["cồng chiêng"], [], []),
    ("Tham quan bảo tàng · dinh thự · di tích", "văn hoá", [], ["art_gallery", "museum"],
     ["Bảo tàng", "Nghệ thuật / Triển lãm", "Dinh thự / Di tích"]),
    ("Viếng chùa / nhà thờ", "văn hoá", [], [], ["Chùa / Thiền viện", "Nhà thờ"]),

    # KHONG lay loai "Chợ / Mua sắm" — no gom ca sieu thi va trung tam thuong
    # mai (GO! Đà Lạt), khong phai cho dem an vat.
    ("Ăn vặt chợ đêm", "ẩm thực", ["chợ đêm"], ["night_market"], []),
    # `food_tours` cua Overture gan cho "Luyện Chữ Đẹp" va mot quan Thai — 2/5
    # sai, nen bo hang muc, chi giu tu khoa trong ten.
    ("Tour ẩm thực", "ẩm thực", ["food tour", "tour ẩm thực"], [], []),

    # Hang muc `spas` cua Overture gom ca tiem noi mi va lam mong ("Nối Mi Ngọc
    # Vy Beauty") — khong phai hoat dong du lich. Doi ten phai chua tu spa/massage.
    ("Spa / massage", "thư giãn", ["spa", "massage", "xông hơi", "tắm khoáng"],
     ["health_spa", "massage_therapy"], []),
    ("Yoga", "thư giãn", ["yoga"], ["yoga_studio"], []),

    ("Thuê xe máy", "dịch vụ", ["thuê xe máy"], ["motorcycle_rentals"], []),
    ("Thuê ô tô / xe có tài xế", "dịch vụ", ["xe hợp đồng", "thuê xe tự lái"], ["car_rental_agency"], []),
    ("Chụp ảnh ngoại cảnh", "dịch vụ", ["chụp ảnh ngoại cảnh", "photo tour"], ["event_photography"], []),
    ("Đơn vị lữ hành", "dịch vụ", [], ["tours", "sightseeing_tour_agency"], []),
]


def has_kw(name, kws):
    """Khop CO DAU va co bien tu hai dau. Khong co bien tu thi "sup" bat vao
    "súp"/"supermarket", "tour" bat vao "tourist"/"Tourism"."""
    n = " " + (name or "").lower().strip() + " "
    for k in kws:
        pat = r"(?<![0-9A-Za-zÀ-ỹ])" + re.escape(k.lower()) + r"(?![0-9A-Za-zÀ-ỹ])"
        if re.search(pat, n):
            return k
    return None


NOT_ACT = ["sửa chữa", "sửa xe", "phụ tùng", "vật liệu", "bảo hiểm", "bất động sản",
           "ngân hàng", "xây dựng", "nội thất", "kế toán", "luật sư", "phòng khám",
           "điện máy", "điện thoại",
           # Do duoc, khong doan: mot nha thau THI CONG spa lot vao nhom Spa qua
           # tu khoa "spa" ("Thiết kế thi công trọn gói Spa Cafe quán ăn nhà
           # hàng"), va mot dich vu MAM CUNG lot vao nhom Thue xe may qua hang
           # muc `motorcycle_rentals` cua Overture.
           "thiết kế", "thi công", "mâm cúng", "học lái xe", "dạy lái xe"]

# Ten mang dia danh TINH KHAC. Cac hang nay co toa do NAM TRONG Da Lat — do
# duoc: "Bamboo Village Beach Resort & Spa Mui Ne" cach trung tam Da Lat 1,7 km,
# "Le Aqua Resort & Spa Phan Thiet" 1,6 km. Mot khu nghi duong bien khong the o
# do, nen chinh TOA DO sai, va bo loc theo khoang cach khong bao gio bat duoc
# chung (0/1.114 hang nam ngoai 40 km). Chi con ten lam bang chung.
TINH_KHAC = ["phan thiet", "phan thiết", "mui ne", "mũi né", "nha trang",
             "vũng tàu", "vung tau", "phú quốc", "phu quoc", "hóc môn",
             "hoc mon", "quận 8", "sài gòn"]

# Cam THEO TUNG hoat dong. Tu khoa ten la phep OR voi hang muc, nen mot tu ngan
# nhu "spa" keo vao ca mot nganh khac: 12 tiem SPA THU CUNG vao nhom "Spa /
# massage", tat ca deu qua "tên chứa spa". Do la ho "bar"/"barber" o muc NGHIA
# chu khong phai muc chuoi — bien tu khop dung, dich vu thi khac hen.
CAM_THEO_HD = {
    "Spa / massage": ["pet", "pets", "thú cưng", "thu cung", "chó mèo", "cho meo"],
    # "Khách sạn Đà Lạt gần Chợ Đêm Giá Rẻ" vao nhom nay qua tu khoa "chợ đêm":
    # mot chuong trinh quang cao khach san dung ten cho dem lam moc dia ly. Mot
    # quan an vat khong bao gio ten la "Khách sạn". Chi cam o nhom AM THUC —
    # o nhom thue xe may thi mot homestay co cho thue xe la chuyen binh thuong.
    "Ăn vặt chợ đêm": ["khách sạn", "khach san", "homestay", "resort", "villa",
                       "nhà nghỉ", "nha nghi"],
}

# Ly do phai theo NHOM. Ban dau toi viet mot chuoi ly do co dinh ("thú cưng,
# không phải spa cho người") cho moi truong hop CAM_THEO_HD, nen khi them luat
# cho nhom am thuc thi mot KHACH SAN bi ghi so la "thú cưng". Mot so bo loc noi
# sai ly do con te hon khong ghi ly do: no dan nguoi doc sau di sai huong.
LY_DO_CAM = {
    "Spa / massage": "dịch vụ thú cưng, không phải spa cho người",
    "Ăn vặt chợ đêm": "cơ sở lưu trú, không phải hàng ăn",
}

ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))
places = json.load(io.open(os.path.join(RAW, "merged_dalat.json"), encoding="utf-8"))
print(f"quét {len(ovt)} cơ sở Overture + {len(places)} địa điểm đã hợp nhất\n")

out = []
# Bo loc KHONG duoc im lang: mot con so tut xuong ma khong noi ly do doc y het
# nhu "tim thay it hon", va ca hai deu khong phan biet duoc voi mot loi. In het.
ly_do_bo, bo_ra = Counter(), []
for ten, nhom, kws, cats, loai_dd in ACTS:
    catset, seen = set(cats), set()
    co_so, dia_diem, ly_do = [], [], Counter()

    # Nguon A — CO SO kinh doanh: ai to chuc, o dau lam duoc
    cam_hd = CAM_THEO_HD.get(ten, [])
    for r in ovt:
        nm = (r.get("name") or "").strip()
        if not nm or any(b in nm.lower() for b in NOT_ACT):
            continue
        cat = str(r.get("category") or "")
        kw = has_kw(nm, kws) if kws else None
        if not kw and cat not in catset:
            continue
        # Loai SAU khi da biet hang nay thuoc nhom nao — khong the loai o NOT_ACT
        # vi "pet" chi sai voi nhom Spa, con dung binh thuong o cho khac.
        nl = nm.lower()
        if cam_hd and has_kw(nm, cam_hd):
            _vi = LY_DO_CAM.get(ten, "không thuộc nhóm này")
            ly_do_bo[f"{ten}: {_vi}"] += 1
            bo_ra.append((ten, nm, _vi))
            continue
        if any(t in nl for t in TINH_KHAC):
            ly_do_bo[f"{ten}: tên mang địa danh tỉnh khác"] += 1
            bo_ra.append((ten, nm, "tên mang địa danh tỉnh khác"))
            continue
        # Hang muc cua Overture nhieu nhieu: trong nhom "Thuê xe máy", cac hang
        # DUNG lai mang `professional_services` / `hotel` / `grocery_store`, con
        # hang SAI duy nhat lai mang dung `motorcycle_rentals`. Nen hang muc
        # KHONG dung lam bo loc — chi ghi nhan de doc so.
        vt = vai_tro(nm, cat)
        if vt == "ban_do":
            ly_do["loại (bán đồ)"] += 1
            continue
        key = (nm.lower(), round(r["lat"], 4))
        if key in seen:
            continue
        seen.add(key)
        ly_do["tên" if kw else "hạng mục"] += 1
        co_so.append({"ten": nm, "vai_tro": vt, "lat": r["lat"], "lon": r["lon"],
                      "hang_muc": cat or None,
                      "dien_thoai": (r.get("phones") or [None])[0],
                      "facebook": (r.get("socials") or [None])[0],
                      "tin_cay": r.get("confidence"),
                      "bang_chung": f"tên chứa “{kw}”" if kw else f"hạng mục {cat}"})

    # Nguon B — DIA DIEM: thac, ho, chua khong phai doanh nghiep. Chung nam o
    # kho dia diem, va di tim chung trong ten doanh nghiep se ra quan ca phe
    # canh thac thay vi cai thac.
    if loai_dd:
        for p in places:
            if str(p.get("loai_vn") or "") in loai_dd:
                dia_diem.append({"ten": p.get("name"), "lat": p.get("lat"), "lon": p.get("lon"),
                                 "loai": p.get("loai_vn"), "khu_vuc": p.get("area"),
                                 "so_nguon": len(p.get("src") or [])})
        ly_do["địa điểm"] = len(dia_diem)

    co_so.sort(key=lambda x: -(x["tin_cay"] or 0))
    dia_diem.sort(key=lambda x: -x["so_nguon"])
    out.append({"ten": ten, "nhom": nhom,
                "so_co_so": len(co_so), "so_dia_diem": len(dia_diem),
                "bang_chung_tu": dict(ly_do),
                "mua": None, "gio_trong_ngay": None, "thoi_luong": None,
                "co_so": co_so, "dia_diem": dia_diem[:40]})

json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

srt = sorted(out, key=lambda x: (x["nhom"], -(x["so_co_so"] + x["so_dia_diem"])))
print(f"{'Hoạt động':36s}{'Nhóm':12s}{'Tổ chức':>8s}{'Nơi làm':>8s}  Ví dụ")
co, khong = 0, []
for a in srt:
    if not (a["so_co_so"] + a["so_dia_diem"]):
        khong.append(a["ten"])
        continue
    co += 1
    # to_chuc = don vi dan khach di; noi_lam = dia diem + co so tai cho.
    # Hai con so tra loi hai cau hoi khac nhau: "ai dua toi di" va "toi den dau".
    n_tc = sum(1 for c in a["co_so"] if c["vai_tro"] == "to_chuc")
    n_noi = a["so_dia_diem"] + sum(1 for c in a["co_so"] if c["vai_tro"] == "dia_diem")
    vd = " · ".join(d["ten"][:20] for d in a["dia_diem"][:2]) or \
         " · ".join(c["ten"][:20] for c in a["co_so"][:2])
    print(f"{a['ten'][:34]:36s}{a['nhom']:12s}{n_tc:8d}{n_noi:8d}  {vd}")

print(f"\n{co}/{len(out)} hoạt động có bằng chứng vật chất")
if khong:
    print(f"KHÔNG có bằng chứng ({len(khong)}) — không vào tài liệu: {', '.join(khong)}")
bo = sum(a["bang_chung_tu"].get("loại (bán đồ)", 0) for a in out)
print(f"loại {bo} cơ sở chỉ bán thiết bị (không tổ chức hoạt động)")
if bo_ra:
    print(f"\nloại thêm {len(bo_ra)} cơ sở SAI NHÓM / SAI TỈNH — liệt kê đầy đủ,"
          " không cắt:")
    for k, v in ly_do_bo.most_common():
        print(f"   {v:3d}  {k}")
    for nh, nm, vi in bo_ra:
        print(f"      {nh[:26]:28s}{nm[:46]:48s}{vi}")
print(f"mùa / giờ / thời lượng: 0/{len(out)} — chưa nguồn nào trên đĩa nói về chúng (P3/P6)")
print(f"saved -> {OUT}")
