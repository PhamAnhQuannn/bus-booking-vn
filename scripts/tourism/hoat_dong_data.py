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


_DA_CANH_BAO = False


def _vlog(raw_dir):
    """Quan nao vlog thuc su khuyen — tu `quan_vlog.json`.

    Tra ve (dem_theo_ten, danh_sach_co_the_phong_cach).

    File nay co the RONG hoac gan rong: han muc YouTube la 100 luot tim/NGAY va
    mot lan chay dut giua duong la binh thuong. Cot vlog vi vay phai chiu duoc
    thieu du lieu — quan khong co thi DE TRONG, khong ghi 0. Ghi 0 la noi
    "khong vlog nao nhac", con su that la "chua quet den".
    """
    p = os.path.join(raw_dir, "quan_vlog.json")
    if not os.path.exists(p):
        return {}, [], {}
    try:
        raw = json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return {}, [], {}
    # Hai dang: list = phien ban 1, dict = tu phien ban 2 tro di.
    rows = raw if isinstance(raw, list) else raw.get("quan", [])
    pb = 1 if isinstance(raw, list) else int(raw.get("phien_ban", 1))
    # Dem theo KENH, khong theo video. Mot kenh dang nhieu video, hoac mot
    # content farm reup cung mot danh sach "Top 10 quán ăn Đà Lạt", tu thoa
    # nguong ma khong co ai doc lap xac nhan — nen so video do do LON, con so
    # kenh moi do do DOC LAP. File cu chi co `so_video_nhac`, nen doc du phong
    # de bo dung khong sap khi gap ban truoc khi sua.
    def _n(r):
        return r.get("so_kenh_nhac", r.get("so_video_nhac", 0))

    dem = {fold(r["ten"]): _n(r) for r in rows}
    pc = [r for r in rows if r.get("the_phong_cach")]
    pc.sort(key=lambda r: -_n(r))
    # mon -> [quan vlog nhac cho mon do]. Day la phan thu duoc tu khop DONG
    # XUAT HIEN: quan ma TEN KHONG chua tu mon nen khong the vao `mon_an_dalat
    # .json` bang doi chieu ten, vi du "Quán Cô Ba" ban banh can.
    #
    # ⚠ CHI TIN GAN MON TU PHIEN BAN >= 2. File phien ban 1 tinh `mon_lien_quan`
    # bang chuoi con TRAN, nen no gan `Bánh căn` cho `Bánh canh Xuân An` — bo
    # dau thi "banh canh xuan an" chua "banh can". Do la mot CAU SAI trong tai
    # lieu ("quan nay ban banh can"), khac han mot con so lech mot don vi.
    # Van ban vlog khong duoc luu nen khong the tinh lai ngoai tuyen; chi mot
    # lan chay moi sua duoc. Trong khi cho, bo han cot nay thay vi in cai sai.
    # So KENH thi van dung: no la mot tin hieu co nguong >=2, lech mot don vi
    # khong dao nguoc ket luan, con gan mon sai thi khang dinh mot dieu khong
    # co that.
    theo_mon = {}
    if pb >= 2:
        for r in rows:
            for mon in r.get("mon_lien_quan") or []:
                theo_mon.setdefault(mon, []).append(r)
    elif any(r.get("mon_lien_quan") for r in rows) and not _DA_CANH_BAO:
        globals()["_DA_CANH_BAO"] = True      # _vlog co hai loi vao; canh bao mot lan
        # NOI RA. Mot cot bien mat khong tieng dong thi khong the phan biet voi
        # "chua co du lieu" — va nguoi doc bo dung se ket luan sai ve cai nao.
        print(f"  ⚠ {os.path.basename(p)} là phiên bản {pb}: BỎ gán món"
              " (tính bằng chuỗi con tràn, sai). Giữ số kênh."
              " Chạy lại sweep_youtube_quan.py để có phiên bản 2.")
    for v in theo_mon.values():
        v.sort(key=lambda r: -_n(r))
    return dem, pc, theo_mon


def tai_phong_cach(raw_dir):
    """Quan co THE PHONG CACH — moi ngay mot mon, khong menu, gia truyen…

    Tra ve [] khi chua co du lieu. Bo dung se bo han khoi, khong in tieu de rong.
    """
    return _vlog(raw_dir)[1]


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
    vlog, _, vlog_mon = _vlog(raw_dir)
    theo_nhom = {}
    # ⚠ KHONG co bo dem tuong thich o day, va do la co y.
    # Ban truoc chap nhan ca dang cu (`quan = v if not dict`) roi gan mac dinh
    # `nhom = "món phổ thông"`. Bo dem do TAI TAO chinh loi ma docstring tren mo
    # ta: chay bo dung tren mot ban `mon_an_dalat.json` cu thi MOI dac san Da Lat
    # roi vao nhom "mon co o moi thanh pho", im lang, khong dong log nao — dung
    # cai ket qua ma viec chia nhom sinh ra de tranh.
    # File nay nam trong `.tourism-data/raw/` (gitignored) va do mot script khac
    # sinh ra, tuc no chinh la loai hien vat de cu nhat. Nen dung HAN va noi ro
    # phai chay lai cai gi; mot lan dung on ao thi sua duoc, con mot tai lieu in
    # sai 30 dong thi khong ai thay.
    _sai = [m for m, v in d.items() if not isinstance(v, dict) or "nhom" not in v]
    if _sai:
        raise SystemExit(
            f"{p}: {len(_sai)}/{len(d)} món thiếu khoá 'nhom' (dạng cũ, ví dụ"
            f" {_sai[:3]}).\nChạy lại:  python scripts/tourism/sweep_monan.py"
            f" {raw_dir}\nKhông dựng bằng dạng cũ: mọi đặc sản Đà Lạt sẽ bị xếp"
            " vào nhóm 'món phổ thông' mà không báo gì.")
    for mon, v in d.items():
        quan, nhom = v["quan"], v["nhom"]
        if not quan:
            continue
        # Quan duoc vlog nhac len TRUOC — do la loi khuyen that, khong phai
        # suy ra tu do tin cay du lieu ban do.
        quan = sorted(quan, key=lambda q: (-vlog.get(fold(q["ten"]), 0),
                                           not q.get("dien_thoai")))
        # Khu TRUNG TEN y het. Overture giu nhieu dong cho cung mot quan:
        # `Lẩu gà lá é` co 14 dong trung ten tren 56, nen goi y 3 quan se in
        # cung mot ten ba lan. Chi nhanh co ten KHAC ("Chi Nhánh … Tao Ngộ",
        # "… Siêu Hẻm Ánh Sáng") thi giu — do la dia chi khac that.
        # Da sap xep truoc nen ban giu lai la ban co vlog / co so dien thoai.
        _da, _q = set(), []
        for q in quan:
            k = fold(q["ten"])
            if k in _da:
                continue
            _da.add(k)
            _q.append(q)
        quan = _q
        # ── Quan vlog khuyen ma DOI CHIEU TEN khong bao gio cham tới ─────────
        # `mon_an_dalat.json` chi chua quan co TU MON TRONG TEN. Do duoc tren
        # 5.543 co so an uong Overture: cach do gan mon cho 897 quan (16%).
        # Con lai la nhung quan mang ten nguoi hoac thuong hieu — "Quán Cô Ba"
        # ban banh can, "Tiệm nướng Cư Xá" — va khong luat doi chieu ten nao
        # tim ra chung, vi ten khong noi ho ban gi.
        # Khop DONG XUAT HIEN trong van ban vlog tra loi dung cho trong do. Xep
        # LEN DAU vi day la loi khuyen bien tap that, khong phai suy ra tu do
        # tin cay ban do; danh dau `chi_tu_vlog` de nguoi doc biet nguon khac.
        _co = {fold(q["ten"]) for q in quan}
        _them = [r for r in vlog_mon.get(mon, []) if fold(r["ten"]) not in _co]
        quan = [{"ten": r["ten"], "dien_thoai": r.get("dien_thoai"),
                 "dia_chi": r.get("dia_chi"), "chi_tu_vlog": True}
                for r in _them] + quan
        theo_nhom.setdefault(nhom, []).append(
            (mon, len(quan),
             [{"ten": q["ten"], "dien_thoai": q.get("dien_thoai"),
               "dia_chi": q.get("dia_chi"),
               "chi_tu_vlog": q.get("chi_tu_vlog", False),
               # None, khong phai 0 — quan khong co trong quan_vlog.json nghia la
               # CHUA QUET DEN, khong phai "khong vlog nao nhac".
               "vlog": vlog.get(fold(q["ten"]))}
              for q in quan[:MAX_QUAN_MON]]))
    out = []
    for nhom in THU_TU_NHOM:
        rows = theo_nhom.pop(nhom, [])
        if rows:
            out.append((nhom, sorted(rows, key=lambda x: -x[1])))
    for nhom, rows in theo_nhom.items():        # nhom la khong luong truoc
        out.append((nhom, sorted(rows, key=lambda x: -x[1])))
    return out
