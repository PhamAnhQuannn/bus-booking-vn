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
# Danh sach DA DONG CUA khong bi cat. Moi danh sach khac trong tai lieu nay la
# mot MAU co chu dich ("78 co so, duoi day 10") va do la hop ly — nguoi doc chi
# can vai lua chon. Danh sach dong cua thi nguoc: no khong phai goi y, no la
# CANH BAO, va mot canh bao bi cat con 14/35 nghia la 21 quan da dong van nam
# trong phan goi y ma khong co gi danh dau. Gioi thieu mot noi da dong la loi te
# nhat tai lieu nay co the mac.
MAX_DONG_CUA = None     # None = in het

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


def tai_lan_can(raw_dir):
    """Khoi khach san + quan an gan cho tung diem den, do `gan_lan_can.py` sinh.

    Dung chung cho ca hai bo dung. Khong dinh dang o day.
    """
    p = os.path.join(raw_dir, "lan_can.json")
    if not os.path.exists(p):
        return {}
    return json.load(io.open(p, encoding="utf-8"))


def tai_lan_can_khu_vuc(raw_dir):
    """Khoi khach san + quan an cho tung KHU VUC, do `gan_lan_can.py` sinh.

    Thay cho `tai_lan_can` o cap ho so: khoi A.14/A.15 lap trong ca 36 ho so
    chiem 1.420 dong (trung vi 43% moi ho so) trong khi chi co 52 khach san khac
    nhau tren toan bo — Du Parc lap 12 lan, La Sapinette 11. In mot lan moi khu
    vuc thay vi mot lan moi diem.

    Moi ban ghi giu `khoang_cach` va `gan_diem` (ma DL-xx gan nhat). Bang toan
    thanh pho o muc 5 KHONG co cot khoang cach, nen khoang cach khong phai du
    lieu trung — bo di la mat thong tin, khong phai khu trung lap.
    """
    p = os.path.join(raw_dir, "lan_can_khu_vuc.json")
    if not os.path.exists(p):
        return {}
    return json.load(io.open(p, encoding="utf-8"))


# ── XUAT XU + DIA HINH: chon o DAY, khong o trong bo dung ──────────────────
# Hai ham duoi day ton tai vi mot loi da xay ra that: khoi phu luc xuat xu duoc
# viet TRUC TIEP trong build_huong_dan.py, nen no khong bao gio den duoc ban
# .docx. Ket qua do duoc: 32 link Facebook, 21 luot check-in, 4 ti le de xuat va
# ca bang thu hang co trong ban .md va BANG KHONG trong ban .docx — trong khi
# nam truong do da bi bo khoi the cua CA HAI ban. Ban .docx mat trang du lieu.
# Dung lop loi ma quy tac "mot nguon chon loc, hai nguon dinh dang" sinh ra de
# chan, va no vo hinh cho tan khi so hai file bang tay.

# Nam truong XUAT XU. Chung tra loi "tin duoc khong", khong tra loi "di dau".
NGHIEN_CUU = [("trang_facebook", "Trang Facebook"),
              ("email_facebook", "Email (Facebook)"),
              ("luot_checkin", "Lượt check-in"),
              ("nguoi_theo_doi", "Người theo dõi FB"),
              ("ty_le_gioi_thieu", "Tỉ lệ đề xuất (FB)")]

# `canh_bao_website` KHONG nam trong danh sach tren, va day la ly do: no noi
# rang cai URL in NGAY BEN DUOI no khong phai trang cua dia diem nay. Doi no
# sang phu luc thi the con lai mot URL sai khong co gi danh dau. Mot loi canh
# bao phai nam canh thu no canh bao.


def _enr(raw_dir):
    p = os.path.join(raw_dir, "enrichment.json")
    if not os.path.exists(p):
        return {}
    out = {}
    for e in json.load(io.open(p, encoding="utf-8")):
        out.setdefault(e["id"], {}).setdefault(e["field"], e)
    return out


def tai_nghien_cuu(raw_dir):
    """Phu luc xuat xu + thu hang chat luong du lieu.

    Tra ve {"hang": [(id, ten, nhan, gia_tri)], "so_diem": n,
            "xep_hang": [(nhan_nhom, [(id, ten)])]}
    """
    gp = os.path.join(raw_dir, "guide_data.json")
    if not os.path.exists(gp):
        return None
    G = json.load(io.open(gp, encoding="utf-8"))
    ten = {r["id"]: r["name"] for r in G["picked"]}
    enr = _enr(raw_dir)
    hang, co = [], set()
    for r in G["picked"]:
        for f, nhan in NGHIEN_CUU:
            e = enr.get(r["id"], {}).get(f)
            if e:
                hang.append((r["id"], r["name"], nhan, str(e["value"])))
                co.add(r["id"])
    # Thu hang den TU guide_data.json — cung mot thu tu ma muc 9 dung lam thu tu
    # goi dien. Khong tu tinh lai o day, va khong bo dung nao duoc tu tinh lai.
    xh = [pid for pid in (G.get("xep_hang") or []) if pid in ten]
    nhom = [("Ưu tiên xác minh trước", xh[:8]), ("Nhóm hai", xh[8:20]),
            ("Nhóm ba", xh[20:])]
    return {"hang": hang, "so_diem": len(co), "tong": len(G["picked"]),
            "xep_hang": [(lab, [(i, ten[i]) for i in seg]) for lab, seg in nhom
                         if seg]}


def tai_dia_hinh(raw_dir):
    """Lop dia hinh Phase L: do cao, do nho, huong mo. 36/36 va chua tung in.

    KHONG tra ve `huong_binh_minh`. Truong do co 36/36 nhung gia tri GIONG NHAU
    o ca 36 dong — "khoảng 114° so với hướng Bắc (tháng 12)" — vi phuong vi mat
    troi moc la ham cua vi do va ngay, va ca 36 diem cung mot vi do. Nen no
    khong phan biet duoc diem nao voi diem nao: mot cot lap lai mot gia tri 36
    lan doc nhu du lieu ma khong mang thong tin nao. Do dung la bay da ghi trong
    so loi (ti le lap day cao tren mot truong co gia tri mac dinh khong phan
    biet duoc voi gia tri that). No thuoc muc 1, mot dong cho ca thanh pho.
    """
    gp = os.path.join(raw_dir, "guide_data.json")
    if not os.path.exists(gp):
        return None
    G = json.load(io.open(gp, encoding="utf-8"))
    enr = _enr(raw_dir)

    def val(pid, f):
        e = enr.get(pid, {}).get(f)
        return str(e["value"]) if e else None

    def so(v):
        try:
            return float(str(v).split()[0].replace(".", "").replace(",", "."))
        except Exception:
            return -1e9

    rows = []
    for r in G["picked"]:
        cao = val(r["id"], "do_cao")
        if not cao:
            continue
        rows.append({"id": r["id"], "ten": r["name"], "do_cao": cao,
                     "do_nho": (val(r["id"], "do_nho") or "").split(" so với")[0],
                     "huong_mo": val(r["id"], "huong_mo")})
    rows.sort(key=lambda x: -so(x["do_cao"]))
    # Mot dong SAI da biet, va no phai duoc danh dau chu khong duoc in tran.
    # DL-04 luu 1.469 m voi do nho -11 m, tuc THAP hon vung xung quanh: do la
    # khu cong va ban ve, khong phai dinh 1.951 m cach 4,5 km ve phia bac. In
    # tran thi bang nay noi rang diem ngam canh noi tieng nhat Da Lat nam trong
    # mot cho trung.
    # ── DL-04: BA do cao khac nhau, khong phai hai ────────────────────────
    # Ke hoach ban dau la doi toa do sang dinh. Da do truoc khi doi, va phep do
    # do CHAN viec doi:
    #     cong (toa do dang luu) 1.469 m · duong gan nhat "Lang Biang" cach 12 m
    #                            · OSRM tu ho Xuan Huong 10,5 km / 12 phut
    #     dinh Nui Ba (12,0473 / 108,4406) 2.138 m theo SRTM · duong gan nhat
    #                            KHONG TEN cach 892 m · OSRM 24,9 km / 48 phut
    # Doi sang toa do dinh thi `do_cao` dung nhung `km`/`phut` thanh 24,9 km /
    # 48 phut — tuc mot con duong di vong quanh nui, khong phai duong khach thuc
    # su di (khach lai den cong roi len bang xe jeep hoac di bo). Doi mot loi DA
    # DUOC DANH DAU thanh mot loi KHONG duoc danh dau la tệ hơn.
    # Nen: giu toa do cong — no dung cho viec di lai — va noi ra ca ba con so.
    # Tach thanh ba ban ghi (cong / san ngam canh / dinh) van la viec dung, va
    # van hoan, vi no doi tap 36 diem.
    for x in rows:
        if x["id"] == "DL-04":
            x["canh_bao"] = (
                "toạ độ đang lưu là KHU CỔNG / bãi vé ở 1.469 m — đúng cho việc"
                " đi lại (10,5 km · 12 phút từ hồ Xuân Hương), nhưng KHÔNG phải"
                " đỉnh. Sân ngắm cảnh cao hơn, lên bằng xe jeep hoặc đi bộ từ"
                " cổng. Đỉnh Núi Bà thật ở 12,0473 / 108,4406 cao 2.138 m theo"
                " SRTM, cách 5,07 km về phía bắc, không có đường ô tô tới"
                " (đường gần nhất cách 892 m)")
    return {"hang": rows,
            "binh_minh": next((val(r["id"], "huong_binh_minh") for r in G["picked"]
                               if val(r["id"], "huong_binh_minh")), None)}


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
