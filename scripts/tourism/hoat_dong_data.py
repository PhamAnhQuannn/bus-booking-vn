# -*- coding: utf-8 -*-
"""Chon loc lop HOAT DONG cho ca hai bo dung. CHI CHON, KHONG DINH DANG.

Vi sao la module rieng chu khong nam trong tung bo dung: `hoat_dong.json` co
hoat dong kem toi 240 dia diem va 401 co so — khong in het duoc, phai cat gon.
Neu logic cat gon nam trong ca hai bo dung thi ban .md va ban .docx se lech
nhau, va khong ai phat hien cho toi khi doc canh nhau. Du an nay da dinh dung
lop loi do (hai bo trich cung mot payload VNPay, 26/07).

MOT nguon chon loc, hai nguon dinh dang.
"""
import json, io, os, re, unicodedata

MAX_NOI = 8          # dia diem in ra moi hoat dong
MAX_DON_VI = 5       # don vi to chuc in ra
MAX_QUAN_MON = 5     # quan an in ra moi mon


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


# ── Loc nhieu ke thua tu bang quy doi `loai_vn` ─────────────────────────────
# Cot `loai_vn` cua kho dia diem co san nhieu: "Hồ Tuyền Lâm" bi xep vao
# "Chùa / Thiền viện", "Đỉnh Langbiang" va "Suối Vàng" bi xep vao
# "Dinh thự / Di tích". Khong phai loi moi, nhung SE hien ra trong chuong nay
# neu khong chan. Doi chieu lai bang TEN: mot dia diem chi thuoc nhom neu ten
# no noi vay.
#
# GIU NGUYEN DAU + doi bien tu. Ban dau toi viet bo loc nay tren ten DA BO DAU
# va no dinh dung cai bay no sinh ra de tranh: `Đỉnh Langbiang` bo dau thanh
# "dinh langbiang", trung tu "dinh" cua DINH THU — nen dung ngon nui bi xep vao
# nhom dinh thu, chinh la dong nhieu can loai. Cung ho loi voi
# `sữa chua` / `sửa chữa` da ghi trong so.
TEN_PHAI_CHUA = {
    "Viếng chùa / nhà thờ": ("chùa", "nhà thờ", "thiền viện", "giáo xứ", "tịnh xá",
                             "tu viện", "nhà nguyện", "giáo đường", "cổ sát",
                             "tổ đình", "đền", "miếu", "thánh đường", "tự", "am"),
    "Tham quan thác": ("thác",),
    "Tham quan hồ": ("hồ", "đập", "thung lũng", "suối"),
    # "biệt thự" bi bo: no bat vao resort ("Khu Biệt Thự Nghỉ Dưỡng Osaka"),
    # khong phai di tich.
    "Tham quan dinh thự / di tích": ("dinh", "di tích", "lâu đài", "cung điện",
                                     "nhà cổ"),
    # Gop dinh thu vao day, vi Dinh Bảo Đại 1/III thuc te nam trong thung
    # `loai_vn` = "Bảo tàng", khong nam trong "Dinh thự / Di tích".
    "Tham quan bảo tàng · dinh thự · di tích": ("bảo tàng", "triển lãm", "gallery",
                                                "sử quán", "đường hầm", "3d",
                                                "trưng bày", "dinh", "di tích",
                                                "lâu đài", "nhà cổ"),
    "Tham quan vườn hoa / công viên": ("vườn", "công viên", "hoa", "quảng trường"),
    "Tham quan nông trại": ("nông trại", "trang trại", "farm", "vườn", "đồi chè"),
    "Ngắm cảnh từ điểm cao": (),      # loai "Điểm ngắm cảnh" von da dung nghia
    "Công viên giải trí": (),         # loai "Khu vui chơi" von da dung nghia
    "Trekking / leo núi": ("núi", "đèo", "đường mòn", "đồi"),
}


def _co_tu(ten, tu):
    """Khop CO DAU va co bien tu hai dau — "tự" khong duoc bat vao "tự lái",
    "am" khong duoc bat vao "Lâm"."""
    n = " " + (ten or "").lower().strip() + " "
    pat = r"(?<![0-9A-Za-zÀ-ỹ])" + re.escape(tu.lower()) + r"(?![0-9A-Za-zÀ-ỹ])"
    return re.search(pat, n) is not None


# Ten co nhung cum nay thi khong phai dia diem tham quan, du hang muc noi vay.
# "Bán Đất Đồi Chè Cầu Đất" la tin rao ban dat, khong phai doi che.
KHONG_PHAI_DIEM = ("bán đất", "ký gửi", "cho thuê đất", "bất động sản", "mua bán",
                   "sang nhượng", "cần bán", "chính chủ")


def _ten_hop_le(ten_hd, ten_dd):
    if any(k in (ten_dd or "").lower() for k in KHONG_PHAI_DIEM):
        return False
    can = TEN_PHAI_CHUA.get(ten_hd)
    if not can:
        return True
    return any(_co_tu(ten_dd, k) for k in can)


def _tour_web(raw_dir):
    """Ket qua doc website don vi to chuc, gan theo HOAT DONG.

    Chi lay don vi DA XAC MINH duoc danh tinh. Truong gia ten la
    `khoang_gia_don_vi` — day la khoang tren TOAN BO goi cua don vi, khong phai
    gia mot tour cu the: trang liet ke nhieu tour va bo trich chay theo truong
    tren ca trang nen khong quy duoc gia ve tung tour.
    """
    p_ts = os.path.join(raw_dir, "tour_sites_sach.json")
    p_dv = os.path.join(raw_dir, "dv_trai_nghiem.json")
    if not (os.path.exists(p_ts) and os.path.exists(p_dv)):
        return {}, 0
    sites = json.load(io.open(p_ts, encoding="utf-8"))
    dvs = {d["id"]: d for d in json.load(io.open(p_dv, encoding="utf-8"))}
    theo_hd = {}
    for s in sites:
        d = dvs.get(s["id"], {})
        # Ten tour tu trang quang cao co nhieu ban hoan vi cua cung mot tour
        # ("Tour săn mây hot nhất Đà Lạt" / "Tour săn mây Đà Lạt hot nhất").
        # Khu theo tap tu de khong in ba lan cung mot thu.
        _seen, ten_tour = set(), []
        for t in s["ten_tour"]:
            k = frozenset(fold(t).split())
            if k in _seen:
                continue
            _seen.add(k)
            ten_tour.append(t)
        for hd in d.get("hoat_dong", []):
            theo_hd.setdefault(hd, []).append({
                "ten": s["ten"], "url": s["url"],
                "khoang_gia_don_vi": s["khoang_gia_don_vi"],
                "ten_tour": ten_tour[:4],
            })
    # So ten mien khong con phan giai — phat hien ve chat luong du lieu, khong
    # phai loi ky thuat: don vi tour nho o Da Lat song tren Facebook, khong song
    # tren website. Phai dem tu file GOC: `tour_sites_sach.json` da loc bo hang
    # loi tu truoc nen dem o day luon ra 0.
    p_goc = os.path.join(raw_dir, "tour_sites.json")
    chet = tong = 0
    if os.path.exists(p_goc):
        goc = json.load(io.open(p_goc, encoding="utf-8"))
        tong = len(goc)
        chet = sum(1 for s in goc if s.get("loi"))
    return theo_hd, (chet, tong)


def tai(raw_dir):
    """Doc va cat gon. Tra ve (danh_sach_hoat_dong, thong_ke)."""
    acts = json.load(io.open(os.path.join(raw_dir, "hoat_dong.json"), encoding="utf-8"))
    tour_web, _ = _tour_web(raw_dir)
    picked = json.load(io.open(os.path.join(raw_dir, "guide_data.json"),
                               encoding="utf-8"))["picked"]
    # ten (da bo dau) -> ma DL-xx, de nguoi doc lat ve muc chi tiet
    ma_cua = {fold(p["name"]): p["id"] for p in picked}

    out, bo_nhieu = [], 0
    for h in acts:
        noi = []
        for d in h["dia_diem"]:
            if not _ten_hop_le(h["ten"], d["ten"]):
                bo_nhieu += 1
                continue
            noi.append({"ten": d["ten"], "khu_vuc": d.get("khu_vuc"),
                        "so_nguon": d.get("so_nguon", 0),
                        "ma": ma_cua.get(fold(d["ten"]))})
        # Co so co vai_tro `dia_diem` cung la noi den duoc — gop vao, NHUNG phai
        # qua cung bo loc. Lan dau toi chi loc nhanh `dia_diem` nen tin rao
        # "Bán Đất Đồi Chè Cầu Đất" van lot vao qua nhanh nay.
        for c in h["co_so"]:
            if c["vai_tro"] == "dia_diem" and _ten_hop_le(h["ten"], c["ten"]):
                noi.append({"ten": c["ten"], "khu_vuc": None, "so_nguon": 0,
                            "ma": ma_cua.get(fold(c["ten"])),
                            "dien_thoai": c.get("dien_thoai")})
        # Uu tien: nam trong 36 diem tuyen truoc (co muc chi tiet de lat ve),
        # roi den so nguon cao.
        noi.sort(key=lambda x: (x["ma"] is None, -x["so_nguon"]))

        don_vi = [c for c in h["co_so"] if c["vai_tro"] == "to_chuc"]
        don_vi.sort(key=lambda x: -(x["tin_cay"] or 0))

        # Khu trung lap. Hai nguon deu co "Hồ Tuyền Lâm" (kho dia diem giu hai
        # dong cho cung mot ho), va mot so ten vua la NOI vua la DON VI
        # ("Săn Mây Đà Lạt"). In hai lan lam nguoi doc tuong la hai cho khac nhau.
        _ten_dv = {fold(c["ten"]) for c in don_vi}
        _da, _noi = set(), []
        for n in noi:
            k = fold(n["ten"])
            if k in _da or k in _ten_dv:
                continue
            _da.add(k)
            _noi.append(n)
        noi = _noi

        # Bo hoat dong khong con noi lam VA khong co don vi to chuc. Sau khi loc
        # theo ten, "Tham quan dinh thự / di tích" ve 0 noi — thung `loai_vn`
        # cua no la 140 dong nhieu, con dinh THAT (Dinh Bảo Đại 1/III) nam o
        # thung "Bảo tàng". In mot muc rong la noi voi nguoi doc rang Da Lat
        # khong co dinh thu nao, dieu do sai.
        if not noi and not don_vi:
            continue
        out.append({
            "ten": h["ten"], "nhom": h["nhom"],
            "tong_noi": len(noi), "tong_don_vi": len(don_vi),
            "noi": noi[:MAX_NOI],
            "don_vi": [{"ten": c["ten"], "dien_thoai": c.get("dien_thoai"),
                        "facebook": c.get("facebook")} for c in don_vi[:MAX_DON_VI]],
            "tour_web": tour_web.get(h["ten"], []),
            # CO Y trong — chua nguon nao noi ve chung. Xem `thong_ke['thieu']`.
            "mua": h.get("mua"), "gio_trong_ngay": h.get("gio_trong_ngay"),
            "thoi_luong": h.get("thoi_luong"),
        })

    # Giu thu tu nhom on dinh de hai ban dung khong bao gio khac nhau
    THU_TU = ["ngắm cảnh", "vận động", "nông nghiệp", "văn hoá", "ẩm thực",
              "thư giãn", "dịch vụ"]
    out.sort(key=lambda x: (THU_TU.index(x["nhom"]) if x["nhom"] in THU_TU else 99,
                            -x["tong_noi"] - x["tong_don_vi"]))

    _, (_chet, _tong_web) = _tour_web(raw_dir)
    tk = {
        "so_hoat_dong": len(out),
        "so_nhom": len({x["nhom"] for x in out}),
        "bo_nhieu_ten": bo_nhieu,
        "so_don_vi_co_web": sum(1 for x in out if x["tour_web"]),
        "ten_mien_chet": _chet, "tong_website_thu": _tong_web,
        "thieu": [k for k in ("mua", "gio_trong_ngay", "thoi_luong")
                  if not any(x[k] for x in out)],
    }
    return out, tk


# Thu tu in ba nhom. "Ăn gi o Da Lat" phai tra loi bang DAC SAN truoc.
THU_TU_NHOM = ["đặc sản Đà Lạt", "món phổ thông", "đặc sản mang về"]


def tai_mon_an(raw_dir):
    """Am thuc la mot NHOM HOAT DONG, khong phai mot chuong rieng.

    Tra ve [(ten_nhom, [(ten_mon, so_quan, [quan])])] — ba nhom, xep trong tung
    nhom theo so co so.

    ⚠ HINH DANG DU LIEU DA DOI, va ban doc nay tung khong doi theo:
        sweep_monan.py ghi   {món: {"nhom": ..., "quan": [...]}}
        ban cu doc           for mon, quan in d.items()  ->  len(quan)
    `len()` tren dict do ra 2 (dem khoa), nen MOI mon hien "2 quán" trong tai
    lieu — khong sap, khong bao loi, chi in sai 30 dong. Do dung:
        len(d['Bánh tráng nướng']) = 2      dang muon = 24
    Cung lop loi so da ghi: hinh dang du lieu doi thi phai sua MOI cho doc no
    trong cung mot commit.

    Vi sao xep theo SO CO SO trong tung nhom la hop le, con xep tren toan bo thi
    khong: xep tren toan bo thi Lẩu 172, Phở 89, Ốc 60 dan dau — mon co o moi
    thanh pho Viet Nam — con kem bo 7 va trung nuong 2 nam cuoi. NHOM lam viec
    tach dac san khoi mon pho thong; trong mot nhom da dong nhat thi so co so la
    thuoc do hop ly.
    """
    p = os.path.join(raw_dir, "mon_an_dalat.json")
    if not os.path.exists(p):
        return []
    d = json.load(io.open(p, encoding="utf-8"))
    theo_nhom = {}
    for mon, v in d.items():
        # Chap nhan ca hai dang de bo dung khong sap neu doc file cu.
        quan = v["quan"] if isinstance(v, dict) else v
        nhom = v.get("nhom", "món phổ thông") if isinstance(v, dict) else "món phổ thông"
        if not quan:
            continue
        theo_nhom.setdefault(nhom, []).append(
            (mon, len(quan),
             [{"ten": q["ten"], "dien_thoai": q.get("dien_thoai"),
               "dia_chi": q.get("dia_chi")} for q in quan[:MAX_QUAN_MON]]))
    out = []
    for nhom in THU_TU_NHOM:
        rows = theo_nhom.pop(nhom, [])
        if rows:
            out.append((nhom, sorted(rows, key=lambda x: -x[1])))
    for nhom, rows in theo_nhom.items():        # nhom la khong luong truoc
        out.append((nhom, sorted(rows, key=lambda x: -x[1])))
    return out
