# -*- coding: utf-8 -*-
"""Lay MO TA tu Wikipedia tieng Viet cho 36 diem den. TRICH NGUYEN VAN.

═══════════════════════════════════════════════════════════════════════════════
KHOANG TRONG LA MOT DIEM, KHONG PHAI MUOI BAY.

`enrichment.json` da co `mo_ta_wikipedia` cho 19/36, va con lai bi coi la "khong
co bai". Kiem tung ten thi 16 trong 17 diem do CO bai Wikipedia tieng Viet —
chi la duoi TEN KHAC:
    Đỉnh Langbiang    -> Núi Langbiang
    Crazy House       -> Biệt thự Hằng Nga
    Nhà thờ Con Gà    -> Nhà thờ chính toà Đà Lạt
    Thác Voi          -> Thác Voi (Nam Ban)
Chi `Đồi chè Cầu Đất` la khong co that. Nen tran thuc te la 35/36.
Bai hoc: "khong tim thay bai" thuong la "tim bang ten sai", va hai dieu do phai
duoc phan biet — giong luat da ghi trong so ve "khong kiem duoc" khac "kiem ra
ket qua am".

TRICH NGUYEN VAN, KHONG DIEN DAT LAI. Van ban Wikipedia la CC BY-SA 4.0:
  - Ghi cong: dan nguon + lien ket la du.
  - Chia se tuong tu: chi kich hoat khi tao "Adapted Material", tuc khi SUA/dien
    dat lai. Trich nguyen van trong mot tai lieu lon hon la mot "collection" va
    khong keo ca tai lieu vao giay phep.
  => Nen: trich nguyen van hoac khong trich. Viet lai bang loi minh la cach
     duy nhat lam phat sinh nghia vu chia se tuong tu cho chinh doan do.

KHONG DUNG `mo_ta_osm`. No co 2/36 va mot trong hai la du lieu SAI:
"Room: 19; Price: 48-198 USD/night" gan cho Chùa Linh Phước — mot ngoi chua.

Chay:  python tourism-kb/code/enrich_mo_ta.py <thu-muc-raw>
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

RAW = sys.argv[1] if len(sys.argv) > 1 else "tourism-kb/raw"
API = "https://vi.wikipedia.org/w/api.php"
UA = "BusBookingKB/0.1 (tourism knowledge base; contact via repo)"

# Ten bai THUC TE, tra bang tay vi ten trong du lieu khong khop ten bai.
# Moi dong la mot ten da kiem, khong phai mot phong doan.
TEN_BAI = {
    "Đỉnh Langbiang": "Núi Langbiang",
    "Crazy House": "Biệt thự Hằng Nga",
    "Nhà thờ Con Gà": "Nhà thờ chính tòa Đà Lạt",
    "Thác Voi": "Thác Voi (Nam Ban)",
    "Ga Đà Lạt": "Ga Đà Lạt",
    "XQ Sử Quán": "XQ Sử quán",
    "Vườn hoa thành phố Đà Lạt": "Vườn hoa thành phố Đà Lạt",
    "Thiền Viện Trúc Lâm": "Thiền viện Trúc Lâm (Đà Lạt)",
    "Chùa Linh Phước - Đà Lạt": "Chùa Linh Phước",
    "Khu du lịch Đồi Mộng Mơ": "Đồi Mộng Mơ",
    "Thung lũng Tình yêu": "Thung lũng Tình Yêu",
    "Bảo Tàng Lâm Đồng": "Bảo tàng Lâm Đồng",
    "Làng Cù Lần": "Làng Cù Lần",
    "Lake of Sighs (Ho Than Tho)": "Hồ Than Thở",
    "Hồ Xuân Hương - TP Đà Lạt": "Hồ Xuân Hương (Đà Lạt)",
    "Chợ Đà Lạt": "Chợ Đà Lạt",
    "Chùa Tàu (Thiên Vương Cổ Sát)": "Thiên Vương Cổ Sát",
    "Dinh Bao Dai III": "Dinh III",
    "Quảng trường Lâm Viên": "Quảng trường Lâm Viên",
    "Khu Di Tích Dinh Bảo Đại": "Dinh I",

    # Cac diem chua tung duoc thu. Gia tri co the la MOT ten hoac NHIEU ten thu
    # lan luot. Moi ten duoi day rut tu chinh du lieu da co (`name`, `alt`,
    # `ten_vi`), khong phai tu tri nho — mot ten doan mo se keo ve bai cua mot
    # noi khac, va do la loi te hon la khong co mo ta.
    "Giáo Xứ Langbiang": ["Giáo xứ Langbiang"],
    "Khu Du Lịch Lang Biang": ["Khu du lịch Lang Biang", "Lang Biang"],
    "KDL Thác Bảo Đại - Hồ Tuyền Lâm": ["Thác Bảo Đại"],
    "Suối Vàng Dalat & Đường Hầm Đất Sét": ["Đường hầm điêu khắc",
                                            "Đường Hầm Đất Sét", "Suối Vàng"],
    "Vườn Hoa Cẩm Tú Cầu Mới": ["Vườn hoa Cẩm Tú Cầu"],
    "Chùa Quan Thế Âm": ["Chùa Quan Thế Âm"],
}

# Khong co bai — ghi ra de khong ai di tim lai. KHOA THEO ID, khong theo ten.
# Ban truoc khoa theo ten: `{"Đồi chè Cầu Đất"}`, trong khi ten that trong
# guide_data.json la "Đồi chè Cầu Đất (Tea plantation)". Phep thu la so chuoi
# CHINH XAC nen no khong bao gio dung, tuc ket qua tra cuu duy nhat du an nay
# chiu kho ghi lai da khong con hieu luc va lan chay sau van goi API hoi lai.
# `name` do lop hop nhat sinh ra va doi khi doi; `DL-xx` thi bi `diem_den_chot.
# json` dong bang va moi thay doi la loi cung. Khoa theo cai on dinh hon.
#
# Ca 8 dong duoi day deu da tra THAT ngay 30/07/2026, bang moi ten rut ra duoc
# tu du lieu (`name`, `alt`, `ten_vi`), va deu tra ve khong. Day la KET QUA da
# do, khong phai viec chua lam: Wikipedia tieng Viet khong co bai cho 8 diem
# nay. Ghi lai de lan sau khong tieu them luot goi vao cung mot cau hoi.
KHONG_CO = {
    "DL-05": "'Giáo xứ Langbiang' — đã tra 30/07, không có bài",
    "DL-06": "'Khu du lịch Lang Biang' không có bài; 'Lang Biang' chỉ là trang định hướng",
    "DL-09": "'Thác Bảo Đại' — đã tra 30/07, không có bài",
    "DL-11": "'Đường hầm điêu khắc' / 'Đường Hầm Đất Sét' không có bài; 'Suối Vàng' là trang định hướng",
    "DL-21": "'Vườn hoa Cẩm Tú Cầu' — đã tra 30/07, không có bài",
    "DL-22": "Đồi chè Cầu Đất — đã tra, không có bài",
    "DL-28": "'Suối Thác Voi' — đã tra 30/07, không có bài",
    "DL-30": "'Chùa Quan Thế Âm' — đã tra 30/07, không có bài",
}

MAX_CHU = 420          # do dai doan trich toi da
NGUONG_NGAN = 150      # duoi nguong nay thi doan mo dau khong tra loi duoc gi
# Mot diem gio co the ton DEN HAI luot goi (mo dau, roi ca bai neu mo dau ngan)
# va co the thu nhieu ten. Lan chay dau voi 0,3 s dinh ba loi HTTP lien tiep o
# cuoi danh sach — trong do co "Thác Prenn", mot bai chac chan ton tai vi chinh
# no da tung duoc lay ve. Do la bop co, khong phai thieu bai.
NGHI_GIUA = 1.0

# Mot bai chi duoc nhan neu NOI DUNG cua no nhac den Da Lat hay Lam Dong.
# Ly do: "Chùa Quan Thế Âm" va "Vườn hoa Cẩm Tú Cầu" la ten dung chung o nhieu
# tinh, nen mot cu tra dung ten van co the tra ve bai cua mot noi hoan toan khac
# — va no se di vao tai lieu kem mot duong dan that, tuc mot thong tin sai deo
# nhan da kiem chung. Day chinh la loi da xay ra voi gio mo cua cua Dinh Bao Dai
# (lay tu bao tang cach 183 m), o mot lop khac.
DIA_PHUONG = ("Đà Lạt", "Lâm Đồng", "Đà lạt", "Lạc Dương", "Đơn Dương",
              "Đức Trọng", "Lâm Hà")

# TRANG DINH HUONG khong phai mot bai — no la mot danh sach cac bai trung ten.
# Phep kiem dia phuong o tren KHONG bat duoc chung, va do la loi da xay ra that
# o lan chay dau: "Lang Biang" tra ve "Lang Biang có thể chỉ đến: Núi Langbiang
# tại Lâm Đồng…" va "Suối Vàng" tra ve "Suối Vàng có thể là:…". Ca hai deu nhac
# Lam Dong nen deu qua duoc cong dia phuong, va ca hai deu vo nghia voi nguoi
# doc — the diem se noi "noi nay co the chi den mot trong nhung noi sau".
DINH_HUONG_TEN = "(định hướng)"
DINH_HUONG_CAU = ("có thể chỉ đến", "có thể là:", "có thể chỉ:",
                  "thường được dùng để chỉ")

# Mo ta cu qua ngan, lay lai bang phep trich MOI. Chi nhung ID ghi o day moi bi
# ghi de — khong phai mot lenh ghi de toan bo, vi ghi de tat ca se lam mat cac
# doan da duoc doc va chap nhan bang tay.
# Danh sach nay dung MOT LAN roi don sach: de nguyen thi moi lan chay lai deu
# goi API cho cung mot diem va ghi de dong cu bang mot dong y het nhung mang
# ngay moi — ton luot goi va lam ngay thang noi doi ve lan doc that su gan nhat.
# Da dung 30/07/2026 cho DL-08 (72→388), DL-20 (59→413), DL-29 (77→288).
LAM_MOI = set()


def goi(params, lan=4):
    """Wikipedia tra 429 khi goi lien tuc. Lui dan roi thu lai — mot loi tam thoi
    bi ghi thanh 'khong co bai' se thanh mot khoang trong VINH VIEN trong tai
    lieu, vi lan chay sau se bo qua diem do."""
    u = API + "?" + urllib.parse.urlencode(dict(params, format="json"))
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    for i in range(lan):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if i == lan - 1:
                raise
            time.sleep(2 * (i + 1))


def _trich(tieu_de, chi_mo_dau):
    """Mot lan goi API. -> (van_ban_da_cat, ten_bai_that). None neu khong co bai."""
    ts = {"action": "query", "prop": "extracts", "explaintext": 1,
          "redirects": 1, "titles": tieu_de}
    if chi_mo_dau:
        ts["exintro"] = 1
    d = goi(ts)
    pages = d.get("query", {}).get("pages", {})
    for pid, p in pages.items():
        if pid == "-1" or "missing" in p:
            return None, None
        txt = (p.get("extract") or "").strip()
        if not txt:
            return None, p.get("title")
        # Cat theo CAU, khong cat giua cau — mot cau bi cat doi doc nhu du lieu
        # loi, va no cung khong con la trich nguyen van dung nghia.
        cau = re.split(r"(?<=[.!?])\s+", txt.replace("\n", " "))
        ra = ""
        for c in cau:
            if ra and len(ra) + len(c) + 1 > MAX_CHU:
                break
            ra = (ra + " " + c).strip()
        return ra or None, p.get("title")
    return None, None


def doan_dau(tieu_de):
    """Doan trich nguyen van. None neu khong co bai.

    `exintro` chi lay phan truoc muc dau tien. Voi mot so bai o day phan do dai
    dung MOT cau, nen tai lieu nhan duoc nhung dong khong tra loi duoc gi:
    "Ga Đà Lạt là nhà ga tàu hỏa của phường Xuân Hương - Đà Lạt" (59 chu),
    "Đatanla hay Datanla là thác ở thành phố Đà Lạt" (72), thác Prenn (77) —
    trong khi han muc 420 chu gan nhu khong duoc dung den.

    Nen: mo dau qua ngan thi lay them doan than bai dau tien. Van la TRICH
    NGUYEN VAN va van cat theo cau, nen vi tri giay phep khong doi.
    """
    txt, that = _trich(tieu_de, chi_mo_dau=True)
    if txt and len(txt) < NGUONG_NGAN:
        dai, that2 = _trich(tieu_de, chi_mo_dau=False)
        if dai and len(dai) > len(txt):
            return dai, that2 or that
    return txt, that


def main():
    G = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))
    picked = G["picked"]
    p_enr = os.path.join(RAW, "enrichment.json")
    enr = json.load(io.open(p_enr, encoding="utf-8")) if os.path.exists(p_enr) else []
    da_co = {e["id"] for e in enr if e["field"] == "mo_ta_wikipedia"}
    ngay = time.strftime("%d/%m/%Y")

    print(f"{len(picked)} điểm · đã có mô tả {len(da_co)} · "
          f"thiếu {len(picked)-len(da_co)} · làm mới {len(LAM_MOI)}\n")

    them, thay, khong, loi = [], [], [], []
    for r in picked:
        lam_moi = r["id"] in LAM_MOI
        if r["id"] in da_co and not lam_moi:
            continue
        if r["id"] in KHONG_CO:
            khong.append((r["id"], r["name"], KHONG_CO[r["id"]]))
            continue
        # Mot hoac nhieu ten, thu lan luot cho den khi co bai HOP LE.
        ung = TEN_BAI.get(r["name"], r["name"])
        ung = [ung] if isinstance(ung, str) else list(ung)
        txt = that = None
        vi_sao, co_loi = [], False
        for tieu_de in ung:
            try:
                t_, th_ = doan_dau(tieu_de)
            except Exception as e:
                # LOI GOI khong phai "khong co bai". `goi()` da canh bao dieu nay
                # trong docstring cua no: ghi mot loi tam thoi thanh mot ket qua
                # phu dinh se tao ra khoang trong VINH VIEN, vi lan sau diem do
                # se bi bo qua. Danh dau rieng va KHONG dua vao danh sach
                # "khong co mo ta".
                loi.append((r["id"], r["name"], f"{tieu_de}: {type(e).__name__}"))
                co_loi = True
                continue
            time.sleep(NGHI_GIUA)
            if not t_:
                vi_sao.append(f"'{tieu_de}' không có bài")
                continue
            # Trang dinh huong: kiem TRUOC phep dia phuong, vi no luon qua duoc
            # phep do (no liet ke chinh cac noi trong tinh).
            if (DINH_HUONG_TEN in (th_ or "")
                    or any(k in t_ for k in DINH_HUONG_CAU)):
                vi_sao.append(f"'{th_ or tieu_de}' là TRANG ĐỊNH HƯỚNG, "
                              "không phải bài về địa điểm — BỎ")
                continue
            # Cong doan quyet dinh: bai co noi ve vung nay khong?
            if not any(k in t_ for k in DIA_PHUONG):
                vi_sao.append(f"'{th_ or tieu_de}' có bài nhưng KHÔNG nhắc "
                              "Đà Lạt/Lâm Đồng — nhiều nơi trùng tên, BỎ")
                continue
            txt, that = t_, th_
            break
        if not txt:
            if co_loi and not vi_sao:
                continue          # chi loi goi — da ghi o `loi`, khong ket luan gi
            khong.append((r["id"], r["name"], " · ".join(vi_sao) or "không có bài"))
            continue
        dong = {
            "id": r["id"], "field": "mo_ta_wikipedia", "value": txt,
            "source": "Wikipedia tiếng Việt",
            "url": "https://vi.wikipedia.org/wiki/" + urllib.parse.quote(
                (that or ung[0]).replace(" ", "_")),
            "date": ngay, "method": "wikipedia api · trích nguyên văn",
            "note": "trích nguyên văn, CC BY-SA 4.0",
        }
        if lam_moi and r["id"] in da_co:
            thay.append(dong)
            _cu = next((len(str(e["value"])) for e in enr
                        if e["id"] == r["id"] and e["field"] == "mo_ta_wikipedia"), 0)
            print(f"  {r['id']}  {r['name'][:28]:30s} {_cu:4d} → {len(txt):4d} chữ"
                  f"  ← {that}")
        else:
            them.append(dong)
            print(f"  {r['id']}  {r['name'][:28]:30s}      {len(txt):4d} chữ  ← {that}")

    if them or thay:
        # Ghi qua file tam roi os.replace: enrichment.json la file 512 dong dung
        # qua 11 luot lam giau va mot phan khong tai tao duoc, nen mot lan ghi do
        # dang la mat du lieu that.
        _thay = {d["id"] for d in thay}
        giu = [e for e in enr
               if not (e["field"] == "mo_ta_wikipedia" and e["id"] in _thay)]
        tmp = p_enr + ".tmp"
        with io.open(tmp, "w", encoding="utf-8") as f:
            json.dump(giu + them + thay, f, ensure_ascii=False, indent=1)
        os.replace(tmp, p_enr)

    print(f"\nthêm {len(them)} · thay {len(thay)}  ·  "
          f"tổng {len(da_co)+len(them)}/{len(picked)}")
    if khong:
        print(f"\n{len(khong)} điểm không có mô tả — để trống, KHÔNG tự viết:")
        for i, t, ly in khong:
            print(f"   {i}  {t[:30]:32s} {ly}")
        print("   → điểm nào đã tra mà chắc chắn không có bài thì thêm vào"
              " KHONG_CO (khoá theo ID) để lần sau không hỏi lại.")
    if loi:
        print(f"\n{len(loi)} lỗi gọi API: {loi}")


if __name__ == "__main__":
    main()
