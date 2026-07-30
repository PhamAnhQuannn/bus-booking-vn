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
import json, io, os, re, unicodedata
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
