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
import json, io, math, os, re, unicodedata
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

# ── Vong loc quanh Ho Xuan Huong ───────────────────────────────────────────
# GIA_3SAO la QUY UOC CUA TAI LIEU do nguoi dung dat, KHONG phai hang sao.
# Hang sao chinh thuc khong ton tai trong du lieu nay: do duoc 0/420 co so mang
# no, va nguon cong bo no (dang ky Cuc Du lich) tra 403 tu 31/07 nen khong lay
# them duoc. Moi noi in ra chu "3 sao" PHAI kem chu "quy uoc gia" — mot nguong
# gia dung tran se duoc doc thanh mot xep hang cua co quan quan ly.
#
# Ap vao `gia_min` (gia phong THAP NHAT dang ky cong bo), khong phai ca khoang:
# dang ky cong bo mot khoang, va 114/153 dong trong bang nay co `gia_max` vuot
# 450k (Tamy 350k-950k, Doi Mong Mo 400k-3.000k). Vi vay ham tra ve CA HAI dau
# gia — in mot so 350.000d cho noi co phong 950.000d la noi sai gia.
HXH = (11.940921, 108.439407)      # DL-15 Ho Xuan Huong, tam vong loc
BAN_KINH_HO = 1000                 # m
GIA_3SAO = (200_000, 450_000)

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


def lien_ket_ban_do(lat, lon):
    """Toa do -> link ban do. Mot ham, hai bo dung — khong viet lai trong tung ban.

    Muc 0 cho phep DUNG BA suy dien, va "link bản đồ từ toạ độ" la mot trong ba;
    nhung ca hai bo dung deu chua tung sinh no, tuc quy tac hua mot thu tai lieu
    khong lam. 36/36 diem co toa do nen khong can nhanh du phong.

    THU TU: `lat,lon`. Cho duy nhat trong du an nay dung thu tu nguoc la URL cua
    OSRM (`build_huong_dan.py`, `{lon},{lat}`) — chep nham cho do se dat moi diem
    sang mot vi tri khac hoan toan ma link VAN mo duoc, nen khong co gi bao loi.
    Vi vay ca hai bo dung deu duoc kiem bang phep doc nguoc toa do tu chinh URL.
    """
    if lat is None or lon is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lon:.6f}"


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


# ── KHOP OSM THEO TOA DO: "gan" KHONG co nghia la "cung mot noi" ───────────
# `enrich_osm_ondisk.best_match` lay element OSM GAN NHAT trong 300 m va KHONG
# doi ten khop — phep thu ten o do chi NOI RONG ban kinh len 600 m khi ten trung,
# no khong bao gio BAT buoc trung. Nen mot diem khong co element rieng se lang
# le nhan danh tinh cua hang xom. Do dem duoc, va da ra tai lieu:
#
#   DL-15 Ho Xuan Huong  <- "Coffee One Day"   113 m : ten, dia chi, VA gio mo
#                                                      cua "06:00-24:00" — mot
#                                                      cai ho co gio mo cua.
#   DL-33 Dinh Bao Dai   <- "Lam Dong Museum"  183 m : gio mo cua cua BAO TANG.
#   DL-35 Dinh Bao Dai 1 <- mot tien ich trong khuon vien 211 m : gio, web, wifi.
#   DL-31 Lang Cu Lan    <- mot POI trong pho  114 m : "12 Lu Gia", "24/7", gmail.
#   DL-14 Chua Linh Phuoc<- mot KHACH SAN       50 m : "Room: 19; Price: 48-198
#                                                      USD/night", hang sao, wifi.
#   DL-01 XQ Su Quan     <- element cach        89 m : so nha "258" — CHINH la
#                                                      ve "258" trong mau thuan
#                                                      dia chi voi Wikipedia
#                                                      ("80A"). Va `dia_chi_day_du`
#                                                      trong nhu nguon THU HAI
#                                                      xac nhan 258, nhung no la
#                                                      so nha CUA CHINH element do
#                                                      cong voi Nominatim doc
#                                                      nguoc toa do CUA CHINH TA
#                                                      — mot goc, in hai lan.
#
# Khoang cach mot minh KHONG tach duoc dung/sai: "Datanla Fall" o 0 m va "Valley
# of Love" o 215 m deu dung (ten dich khac ngu he, khong so chuoi duoc), con
# khach san o dung 50 m thi sai. Cai tach duoc la LOAI TRUONG:
#
#   - Truong VAN HANH (gio, dia chi, lien he, wifi, hang sao, ten tieng Viet) mo
#     ta mot CO SO dang hoat dong. Lay tu 50 m tro len la lay cua co so khac.
#   - Ten dich (`ten_en`), QID Wikidata, Commons van chap nhan xa, vi tam mot ho
#     hay mot thac lech vai tram met giua cac nguon la binh thuong.
#
# Va phan xet theo ELEMENT, khong theo tung dong: mot element la MOT thuc the.
# Neu no cap mot truong van hanh tu qua xa thi no khong phai diem nay, nen ten
# cua no cung khong phai — do la cach "Lam Dong Museum" bi loai khoi DL-33 trong
# khi "Valley of Love" o xa hon van duoc giu cho DL-02.
BAN_KINH_VAN_HANH = 50          # met

TRUONG_VAN_HANH = {"gio_mo_cua", "gia_ve", "dia_chi_osm", "phuong_xa", "email",
                   "facebook", "dien_thoai_osm", "website_osm", "mo_ta_osm",
                   "wifi", "hang_sao_tu_khai", "nam_xay_dung", "kien_truc",
                   "ton_giao", "osm_check_date", "ten_vi", "ten_khac"}


def loc_khop_xa(rows):
    """Bo moi dong den tu mot element OSM khop QUA XA. -> (giu, bo)

    Khong im lang: nguoi goi PHAI in `bo`. Mot bo loc giau di thu no cat chinh
    la loi da ghi trong so loi — so lieu tut ma khong ai biet tai sao.
    """
    xau = set()
    for e in rows:
        if e.get("source") != "OpenStreetMap" or not e.get("url"):
            continue
        if e["field"] in TRUONG_VAN_HANH and (e.get("match_m") or 0) >= BAN_KINH_VAN_HANH:
            xau.add((e["id"], e["url"]))
    # `dia_chi_day_du` (pass 9) DUNG LEN TU `dia_chi_osm` — `enrich_diachi.py:92`
    # doc thang truong do lam so nha va ten duong, chi lay duong cua Nominatim khi
    # OSM khong co. Nen loai element sai ma giu ban dich cua no thi chua loai gi:
    # ho Xuan Huong van mang dia chi quan ca phe, va Lang Cu Lan — cach trung tam
    # 20 km — van mang mot dia chi trong pho. Loai theo CA CHUOI DAN XUAT.
    id_dia_chi_hong = {e["id"] for e in rows
                       if e["field"] == "dia_chi_osm" and (e["id"], e.get("url") or "") in xau}
    giu, bo = [], []
    for e in rows:
        kh = (e["id"], e.get("url") or "")
        hong = (e.get("source") == "OpenStreetMap" and e.get("url") and kh in xau)
        if e["field"] == "dia_chi_day_du" and e["id"] in id_dia_chi_hong:
            hong = True
        (bo if hong else giu).append(e)
    return giu, bo


_SO_TRUOC_PHO = re.compile(r"(?:so\s+)?(\d+\s*[a-z]?(?:/\d+[a-z]?)?)\s*,?\s*(?:duong\s+)?$")


def _so_nha(text, pho):
    """So nha dung NGAY TRUOC ten pho trong `text`. None neu khong tim thay.

    Doc de SO SANH, khong de XUAT BAN — mot duong tinh sai chi lam hien mot canh
    bao thua, con bo qua thi tai lieu tiep tuc khang dinh mot so nha co the sai.
    """
    f, p = fold(text), fold(pho)
    if not p or p not in f:
        return None
    m = _SO_TRUOC_PHO.search(f[:f.index(p)])
    # `fold()` ha chu thuong de so sanh; so nha Viet Nam viet hoa chu cai duoi
    # ("80A", "31C"). In lai dang da ha chu la sua so nha cua nguon.
    return re.sub(r"\s+", "", m.group(1)).upper() if m else None


def _pho_tran(s):
    """'258 Mai Anh Đào' -> 'Mai Anh Đào'. Dang tran cua `dia_chi_osm`, khong co
    chu 'đường'. Tra None neu khong bat dau bang so nha."""
    m = re.match(r"^\s*\d+\s*[A-Za-z]?(?:/\d+[A-Za-z]?)?\s+(.+)$", s or "")
    return m.group(1).strip() if m else None


def dia_chi_mau_thuan(pid, enr, bo=None):
    """Mo ta va ban ghi co noi HAI so nha khac nhau tren CUNG mot pho khong?

    -> None | (so_theo_mo_ta, so_theo_ban_ghi, ten_pho, da_loai)

    Ba diem dang mac: XQ Su Quan 80A/258 Mai Anh Dao, Nha tho Con Ga 13/15 Tran
    Phu, Chua Tau 385/31C Khe Sanh. Ca ba deu in mot so nha nhu su that ngay duoi
    mot doan trich noi so khac. Chi so sanh khi TEN PHO trung — hai pho khac nhau
    la hai dia chi khac nhau, khong phai mot mau thuan.

    `bo` = cac dong da bi `loc_khop_xa` loai. Phai doc CA chung, vi voi XQ Su Quan
    chinh ban ghi ban do la ben bi loai: neu chi doc phan con lai thi the mat luon
    dong dia chi va KHONG noi gi — nguoi doc thay mot doan trich ghi "80A" va mot
    khoang trong, khong biet rang da co mot so nha khac bi bac bo. Im lang o day
    con te hon mot canh bao.
    """
    e = enr.get(pid) or {}
    mo = e.get("mo_ta_wikipedia")
    if not mo:
        return None
    # Thu lan luot, KHONG lay "cai dau tien tim thay": `dia_chi_osm` o dang tran
    # ("258 Mai Anh Đào") khong co chu "đường", nen neu no duoc thu truoc thi phep
    # tach ten pho hong va ca ham im lang — dung cai bay da lam XQ Su Quan khong
    # ra canh bao o lan chay dau.
    ung = [(e.get("dia_chi_day_du"), False), (e.get("dia_chi_osm"), False)]
    if bo:
        ung += [(x, True) for f in ("dia_chi_day_du", "dia_chi_osm")
                for x in bo if x["id"] == pid and x["field"] == f]
    for dia, da_loai in ung:
        if not dia:
            continue
        dv = str(dia["value"])
        m = re.search(r"đường\s+([^,]+)", dv)
        pho = m.group(1).strip() if m else _pho_tran(dv)
        if not pho:
            continue
        a, b = _so_nha(str(mo["value"]), pho), _so_nha(dv, pho)
        if a and b and a != b:
            return (a, b, pho, da_loai)
    return None


# ── THE `fee` CUA OSM KHONG PHAI MOT SO TIEN ───────────────────────────────
# `fee=yes` nghia la "CO thu phi", khong noi bao nhieu. In thang no ra o o
# "Giá vé" bien mot co BOOLEAN thanh mot con so: the DL-23 Crazy House doc ra
# "Giá vé : yes", va DL-20 Ga Da Lat doc ra "Giá vé : 10000" — khong don vi,
# khong dau phan cach, khong nguon. Ca hai deu lay thang tu lop hop nhat, vong
# qua toan bo duong `enrichment.json`/`ev()`, dung lop sai ma `hours` vua mac.
# Va ca hai deu KHONG mang `[CHƯA XÁC MINH]`, tuc vi pham Quy tac 1 cua chinh
# muc 0 ("KHONG thay [CHƯA XÁC MINH] bang mot gia tri thuong gap").
#
# Khong co gia tri `fee` nao trong du lieu nay la mot so tien da xac minh. Nen
# ham nay khong bao gio tra ve "day la gia": no chi dich the sang tieng Viet va
# noi ro do la thong tin gi.
_FEE_CO = {"yes", "true", "1", "some", "interval"}
_FEE_KHONG = {"no", "false", "0", "free", "none"}


def doc_the_fee(fee):
    """The OSM `fee`/`charge` -> cau tieng Viet, hoac None neu khong co gi.

    KHONG BAO GIO tra ve mot so tien duoc coi la da xac minh.
    """
    s = str(fee or "").strip()
    if not s:
        return None
    t = s.lower()
    if t in _FEE_CO:
        return ("CÓ thu phí — thẻ OSM `fee=yes` chỉ nói có thu, KHÔNG nói bao nhiêu; "
                "hỏi số tiền khi gọi")
    if t in _FEE_KHONG:
        return "miễn phí — theo thẻ OSM `fee=no`, chưa gọi xác nhận"
    if re.fullmatch(r"\d+", t):
        # Con so tran, khong don vi. Khong tu gan "₫" vao — do la suy dien ve
        # don vi tien, dung loai suy dien muc 0 cam.
        return (f"{s} — số trần trên thẻ OSM, KHÔNG ghi đơn vị tiền tệ; "
                "chưa xác minh, đừng đọc cho khách như một mức giá")
    return f"{s} — nguyên văn thẻ OSM, chưa xác minh"


def the_fee_ngan(fee):
    """Dang ngan cho o bang. Cung phep dich voi `doc_the_fee`, khong tu viet lai."""
    s = str(fee or "").strip().lower()
    if not s:
        return "—"
    if s in _FEE_CO:
        return "có thu phí"
    if s in _FEE_KHONG:
        return "miễn phí"
    return "có thu phí"      # so tran / van ban la: co thu, chua ro bao nhieu


def gio_bi_loai(bo):
    """{(id, gia_tri)} gio mo cua da bi loai — de chan CA duong hop nhat.

    Lop hop nhat (`picked[i]["hours"]`) khong ghi khoang cach khop, nen khong the
    loc no bang ban kinh. Nhung khi chuoi gio y HET voi mot dong enrichment vua
    bi loai va cung nguon OSM, thi do la CUNG element sai di theo duong khac —
    DL-35 la ca do: "Mo-Su 08:00-18:00" ca hai ben, element cach 211 m. Chan
    tiep bang chinh bang chung da co, khong doan them.
    """
    return {(e["id"], str(e["value"]).strip())
            for e in bo if e["field"] == "gio_mo_cua"}


def co_gio_mo_cua(r, enr, gio_loai):
    """Diem nay CO in dong "Gio mo cua" khong? — dem cai DA IN.

    So kiem chung tung dem `r["hours"]` mot minh, nen no bao 5 trong khi tai lieu
    that su in 11 the co gio. Mot bang tu kiem bao thieu chinh tai lieu chua no
    thi khong con la bang kiem. Ca hai bo dung goi HAM NAY, khong tu dem lai.
    """
    h = (r.get("hours") or "").strip()
    if h and (r["id"], h) in gio_loai:
        h = ""
    return bool(h) or "gio_mo_cua" in (enr.get(r["id"]) or {})


def _enr(raw_dir):
    p = os.path.join(raw_dir, "enrichment.json")
    if not os.path.exists(p):
        return {}
    rows, _ = loc_khop_xa(json.load(io.open(p, encoding="utf-8")))
    out = {}
    for e in rows:
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

    # ── Co so KHONG cong bo gia ────────────────────────────────────────────
    # Muc nay xep theo BAC GIA, nen mot co so khong co gia thi khong thuoc bac
    # nao va bien mat hoan toan: 207 tren 420 — gan mot nua danh sach luu tru da
    # dang ky cua thanh pho — khong xuat hien o bat ky dau trong tai lieu, va
    # khong dong nao noi rang chung ton tai. Chung KHONG thieu thong tin lien he:
    # 207/207 co dia chi, 201/207 co dien thoai, 188 mang dau tham dinh nha nuoc.
    # Thieu gia la ly do de GOI HOI, khong phai ly do de giau di.
    #
    # KHONG co cot "Loai": do duoc trong chinh nhom nay, 188/207 la "Khách sạn"
    # — 91% mot gia tri, dung cai bay "ti le lap day cao nhung khong phan biet
    # duoc gi" da ghi trong so loi. Chi gan nhan cho 19 dong KHAC "Khách sạn",
    # la cho nhan do thuc su mang tin.
    khong_gia = [r for r in cs if not r["gia_min"]]
    khong_gia.sort(key=lambda r: (r["tham_dinh"] != "nhà nước", r["ten"]))
    kg_loai = Counter((r.get("loai") or "(không ghi)") for r in khong_gia)

    tt = Counter(r["tham_dinh"] for r in d["co_so"])
    dong = [r for r in d["co_so"] if r.get("da_dong_cua")] + d.get("dong_cua_ngoai_dang_ky", [])
    dong.sort(key=lambda r: r["da_dong_cua"], reverse=True)
    return {
        "tong": len(d["co_so"]), "co_gia": sum(1 for r in cs if r["gia_min"]),
        "nha_nuoc": tt.get("nhà nước", 0), "tu_dang_ky": tt.get("tự đăng ký", 0),
        "co_so_phong": sum(1 for r in cs if r["so_phong"]),
        "co_dien_thoai": sum(1 for r in cs if r["dien_thoai"]),
        "bac": bac,
        "khong_gia": [{
            "ten": r["ten"],
            # Nhan loai CHI khi khac "Khách sạn" — xem chu thich tren.
            "loai": (r.get("loai") if (r.get("loai") or "") != "Khách sạn" else None),
            "dia_chi": r["dia_chi"], "dien_thoai": r["dien_thoai"],
            "tham_dinh": r["tham_dinh"],
        } for r in khong_gia],
        "khong_gia_tong": len(khong_gia),
        "khong_gia_co_dt": sum(1 for r in khong_gia if r["dien_thoai"]),
        "khong_gia_loai": kg_loai.most_common(),
        "dong_cua": [{"ten": r["ten"], "ngay": r["da_dong_cua"]} for r in dong],
    }


def _met(la1, lo1, la2, lo2):
    """Duong chim bay, met. Du chinh xac o pham vi mot thanh pho."""
    return math.hypot((la1 - la2) * 111320,
                      (lo1 - lo2) * 111320 * math.cos(math.radians(la1)))


def _khoang_gia(r):
    """Chuoi khoang gia. LUON hai dau khi co hai dau — xem chu thich GIA_3SAO."""
    lo, hi = r.get("gia_min"), r.get("gia_max")
    if not lo:
        return None
    return _tien(lo) + ("–" + _tien(hi) if hi and hi != lo else "")


def tai_luu_tru_quanh_ho(raw_dir, tam=HXH, ban_kinh=BAN_KINH_HO, gia=GIA_3SAO):
    """Co so luu tru trong bang gia quy uoc, quanh mot tam — CHON, khong dinh dang.

    Tra ve HAI danh sach roi, va do la diem chinh cua ham nay:

      `trong`         co toa do rieng VA cach `tam` <= `ban_kinh`. Da do that.
      `khong_toa_do`  co dia chi day du nhung KHONG co toa do, nen khong the do.

    Vi sao khong gop lam mot: da thu suy vi tri cua nhom hai theo TEN PHO —
    "dong nay o pho ma moi co so da do deu nam trong 1 km, vay no cung the".
    Doi chieu voi rieng `luu_tru.json` (1-16 dong/pho) cho 23/54 dong "toan bo
    trong 1 km", trong nhu cuu duoc. Doi chieu voi `luu_tru` + `nha_hang` =
    5.408 dong co ca dia chi lan toa do (891 pho) thi chi con 1: pho Da Lat dai
    hang km va 45/54 pho vat qua ranh gioi — `Trần Phú` 203-15.082 m,
    `Phan Đình Phùng` 187-21.070 m, `Bùi Thị Xuân` 167-4.136 m.

    Ket luan: TEN PHO KHONG DINH VI DUOC MOT TOA NHA, va con so 23 kia la ao
    giac mau nho. Nen nhom hai duoc tra ve NGUYEN VEN de nguoi doc con goi dien
    duoc — nhung khong bao gio mang mot khoang cach, that hay uoc.
    """
    p = os.path.join(raw_dir, "luu_tru.json")
    if not os.path.exists(p):
        return None
    d = json.load(io.open(p, encoding="utf-8"))
    lo, hi = gia
    cs = [r for r in d["co_so"]
          if not r.get("da_dong_cua") and r.get("gia_min")
          and lo <= r["gia_min"] <= hi]

    def _ra(r, m=None):
        o = {"ten": r["ten"], "loai": r.get("loai"), "dia_chi": r.get("dia_chi"),
             "dien_thoai": r.get("dien_thoai"), "so_phong": r.get("so_phong"),
             "tham_dinh": r.get("tham_dinh"), "gia_min": r.get("gia_min"),
             "gia_max": r.get("gia_max"), "gia": _khoang_gia(r),
             "lat": r.get("lat"), "lon": r.get("lon")}
        if m is not None:
            o["m"] = m
        return o

    co_td = [r for r in cs if r.get("lat")]
    trong = [_ra(r, _met(tam[0], tam[1], r["lat"], r["lon"])) for r in co_td]
    trong = [r for r in trong if r["m"] <= ban_kinh]
    trong.sort(key=lambda r: r["m"])
    khong_td = [_ra(r) for r in cs if not r.get("lat")]
    khong_td.sort(key=lambda r: r["ten"])
    return {
        "trong": trong,
        "khong_toa_do": khong_td,
        "tong_bang_gia": len(cs),
        "co_toa_do": len(co_td),
        "khong_td_co_dia_chi": sum(1 for r in khong_td if r["dia_chi"]),
        # So co so co phong DAT HON tran bang gia. Can de tai lieu noi ra rang
        # nhan gia chi rang buoc phong re nhat.
        "vuot_tran": sum(1 for r in cs if (r.get("gia_max") or 0) > hi),
        "ban_kinh": ban_kinh, "gia": gia, "tam": tam,
        "tong_hoat_dong": sum(1 for r in d["co_so"] if not r.get("da_dong_cua")),
        "tong_co_gia": sum(1 for r in d["co_so"]
                           if not r.get("da_dong_cua") and r.get("gia_min")),
    }


BAN_KINH_QUAN = 500        # m — KHAC `BAN_KINH_HO` cua lop luu tru, xem ben duoi


def tai_quan_an_quanh_ho(raw_dir, tam=HXH, ban_kinh=BAN_KINH_QUAN):
    """Quan an quanh mot tam — CHON, khong dinh dang.

    BAN KINH RIENG, khong dung chung voi lop luu tru. `BAN_KINH_HO` = 1.000 m
    phuc vu 67 co so luu tru; cung ban kinh do o lop quan an cho 1.457 dong,
    tuc mot bang 40 trang. Hai lop khac mat do nen khac ban kinh — va vi the
    day la hang RIENG, khong phai mot tham so tien tay sua vao hang kia.

    Tra ve `trong` sap theo khoang cach. Khong cat bot: khac muc 3.2 (moi nhom
    8 quan lam MAU co chu dich), muc nay la danh sach de TIM MOT CHO CU THE
    quanh ho, nen cat mot nua se bo mat dung cai quan nguoi doc dang tim ma
    khong co gi bao rang no ton tai.
    """
    p = os.path.join(raw_dir, "nha_hang.json")
    if not os.path.exists(p):
        return None
    d = json.load(io.open(p, encoding="utf-8"))
    mo = [r for r in d["quan"] if not r.get("da_dong_cua")]
    trong = []
    for r in mo:
        if not r.get("lat"):
            continue
        m = _met(tam[0], tam[1], r["lat"], r["lon"])
        if m > ban_kinh:
            continue
        trong.append({"ten": r["ten"], "dia_chi": r.get("dia_chi"),
                      "dien_thoai": r.get("dien_thoai"),
                      "hang_muc": r.get("hang_muc"), "mon": r.get("mon") or [],
                      "lat": r["lat"], "lon": r["lon"], "m": m})
    trong.sort(key=lambda r: r["m"])
    return {
        "trong": trong, "tong_mo": len(mo), "ban_kinh": ban_kinh, "tam": tam,
        "co_dia_chi": sum(1 for r in trong if r["dia_chi"]),
        "co_dien_thoai": sum(1 for r in trong if r["dien_thoai"]),
        "theo_hang_muc": Counter(r["hang_muc"] for r in trong).most_common(),
    }


def gan_place_id(rows, raw_dir, ten_file):
    """Gan `place_id` · `so_nha_lech` · `ly_do_chua_phan_giai` vao tung dong.

    MOT phep gop, moi bo dung goi no. Neu moi bo dung tu doc file place_id thi
    mot ben co the doc nham file khac hoac bo qua co `so_nha_lech`, va hai ban
    tai lieu se noi khac nhau ve cung mot quan — dung lop loi 30/07.

    Sua tai cho, va tra ve chinh `rows` de goi long nhau duoc.

    KHI FILE CHUA TON TAI van phai dat DU ba khoa. Ban dau ham nay `return rows`
    ngay, va bo dung do thang `KeyError: 'place_id'` — mot buoc lam giau chua
    chay bien thanh mot cu no thay vi mot cot rong. Thieu du lieu la trang thai
    binh thuong cua duong ong nay; no phai in ra "chua phan giai", khong phai
    dung ca ban dung.
    """
    p = os.path.join(raw_dir, ten_file)
    if not os.path.exists(p):
        for r in rows:
            r["place_id"], r["so_nha_lech"] = None, False
            r["ly_do_chua_phan_giai"] = f"chưa chạy phân giải ({ten_file})"
        return rows
    d = json.load(io.open(p, encoding="utf-8"))
    pid = {r["ten"]: r for r in d.get("co_so", [])}
    ly = {r["ten"]: r.get("ly_do") for r in d.get("chua_phan_giai", [])}
    for r in rows:
        g = pid.get(r["ten"])
        r["place_id"] = g["place_id"] if g else None
        r["so_nha_lech"] = bool(g and g.get("so_nha_lech"))
        r["ly_do_chua_phan_giai"] = None if g else ly.get(r["ten"])
    return rows


def nhom_trung_co_so(rows):
    """Cac nhom dong CHUNG mot `place_id` — tuc chung MOT co so tren Google.

    KHONG gop chung lai. Dedup theo ten da tung suyt xoa co so that trong du an
    nay (`Napoli Coffee` 6 dong cach nhau toi 24 km — chuoi chi nhanh, khong
    phai ban trung). Nhung `place_id` giong het la mot truc KHAC HAN ten: no la
    dinh danh cua Google cho MOT dia diem, nen hai dong mang cung id thi that su
    tro ve cung mot cho.

    Van khong xoa dong nao, vi ban ghi Overture cua chung khac nhau (ten khac,
    toa do lech vai chuc met) va ta khong biet ban nao dung. Chi NOI RA, de
    nguoi doc khong goi ba cuoc dien thoai toi cung mot quan.
    """
    theo = {}
    for r in rows:
        if r.get("place_id"):
            theo.setdefault(r["place_id"], []).append(r["ten"])
    return [v for v in theo.values() if len(v) > 1]


def lien_ket_place_id(pid):
    """place_id -> URL tro DUNG co so. Khac han link toa do, vi link toa do chi
    tha mot ghim xuong mot diem va Google se gan no cho bat ky thu gi gan do."""
    return f"https://www.google.com/maps/place/?q=place_id:{pid}" if pid else None


_SO_NHA = re.compile(
    r"^(?:so|lo|kqh|khu quy hoach|khoanh|phan khu[^,]*|kcv|to|thon|khu)\b"
    r"|^[0-9]+[a-z]?(?:\s*[/-]\s*[0-9]+[a-z]?)*\b|^[a-z][0-9]+\b|^[a-z]\b")


def _ten_pho(s):
    """"38/12 Trần Phú, Đà Lạt…" -> "tran phu". Bo so nha, lo, ky hieu quy hoach."""
    p = fold((s or "").split(",")[0])
    for _ in range(4):
        q = _SO_NHA.sub("", p).strip(" -/")
        if q == p:
            break
        p = q
    p = re.sub(r"\b(duong|pho)\b", " ", p)
    return " ".join(p.split())


def do_pho_khong_dinh_vi(raw_dir, rows, tam=HXH, ban_kinh=BAN_KINH_HO, toi_thieu=3):
    """Do xem TEN PHO co du de xep mot dia chi vao trong/ngoai ban kinh khong.

    Ham nay ton tai de mot ket luan PHU DINH duoc in kem so do duoc, thay vi
    mot cau khang dinh suong. No khong loc gi va khong duoc dung de loc.

    Cach do: dung moi ban ghi co CA dia chi lan toa do (luu_tru + nha_hang) lam
    tham chieu, gom theo ten pho, roi hoi tung pho: mọi ban ghi tren pho do co
    cung nam trong ban kinh khong. Neu co thi ten pho dinh vi duoc; neu pho vat
    qua ranh gioi thi khong.

    `toi_thieu` la diem chinh. Voi 1-2 mau moi pho, ket qua "toan bo trong ban
    kinh" chi noi rang mau qua it de thay dau kia cua pho — do la ao giac mau
    nho, va lan do dau tien no cho 23/54 dong "cuu duoc" truoc khi mo rong tham
    chieu len 5.408 dong keo no ve 1.
    """
    tc = {}
    for ten_file, khoa in (("luu_tru", "co_so"), ("nha_hang", "quan")):
        p = os.path.join(raw_dir, ten_file + ".json")
        if not os.path.exists(p):
            continue
        for r in json.load(io.open(p, encoding="utf-8"))[khoa]:
            if r.get("lat") and r.get("dia_chi"):
                ph = _ten_pho(r["dia_chi"])
                if ph:
                    tc.setdefault(ph, []).append(
                        _met(tam[0], tam[1], r["lat"], r["lon"]))
    trong = vat = ngoai = it = 0
    vd = []
    for r in rows:
        v = tc.get(_ten_pho(r.get("dia_chi")), [])
        if len(v) < toi_thieu:
            it += 1
            continue
        lo, hi = min(v), max(v)
        if hi <= ban_kinh:
            trong += 1
        elif lo > ban_kinh:
            ngoai += 1
        else:
            vat += 1
            vd.append((_ten_pho(r["dia_chi"]), len(v), lo, hi))
    vd.sort(key=lambda x: -(x[3] - x[2]))
    ten_da_co = []
    for t, n, lo, hi in vd:
        if t not in [x[0] for x in ten_da_co]:
            ten_da_co.append((t, n, lo, hi))
    return {"tham_chieu": sum(len(v) for v in tc.values()), "so_pho": len(tc),
            "trong": trong, "vat": vat, "ngoai": ngoai, "it_mau": it,
            "vi_du": ten_da_co[:3], "toi_thieu": toi_thieu}


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

    # ── DANH SACH DANG MO CO Y KHONG KHU TRUNG TEN ─────────────────────────
    # Mot ban ra soat bao rang "5.559 quán còn hoạt động" bi thoi phong vi 86
    # nhom ten trung nhau (116 dong thua) — "Lẩu Gà Lá É Tao Ngộ" x10, "Napoli
    # Coffee" x6 — va de nghi khu trung nhu danh sach da dong cua.
    #
    # Do khoang cach truoc khi lam thi ket luan LAT NGUOC: cac hang cung ten
    # cach nhau 277 m den 29 km (napoli coffee trai 24 km, son lam quan 29 km),
    # va so cap cung ten gan hon 50 m la **0**; duoi 100 m chi co 2 cap. Day la
    # CHUOI VA CHI NHANH that, khong phai ban ghi lap. Khu trung theo ten se xoa
    # chi nhanh that va lam con so THAP hon su that.
    #
    # Danh sach da dong cua thi nguoc lai: no khu trung (duoi day) vi mot quan
    # xuat hien hai lan duoi hai cach viet ten se doc nhu hai quan cung dong mot
    # ngay. Hai danh sach, hai muc dich, hai luat — co chu dich.
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
