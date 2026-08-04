# -*- coding: utf-8 -*-
"""Phan giai `place_id` cho bo goi — de PHAT LINK, khong de chep so.

MUC DICH. Tai lieu dang phat 36 link dang `maps/search/?api=1&query=<lat>,<lon>`
— tim theo TOA DO, tuc tha ghim mot diem chu khong tro vao co so. Dung co che
da lam DL-15 Ho Xuan Huong nuot du lieu cua mot quan ca phe cach 113 m. Link
`place_id` la DINH DANH, khong phai vung lan can.

Nguoi doc bam vao link se thay rating, so luot danh gia, anh, gio mo cua HIEN
TAI ngay tren be mat Google. Do la cach dung duoc phep — va tuoi hon bat ky
ban chup nao ta chep ve.

═════════════════════════════════════════════════════════════════════════════
CHI LUU `place_id`. KHONG LUU GI KHAC.

Places API Service Specific Terms cho luu `place_id` VINH VIEN; toa do 30 ngay;
moi truong khac phai goi live moi lan hien thi. `displayName` va
`formattedAddress` mà script nay lay ve la Google Maps Content — dung de DOI
CHIEU trong bo nho roi BO, khong bao gio ghi xuong dia.

Dinh chinh mot khang dinh sai da luu hanh trong du an: KHONG ton tai dieu khoan
"No Use Independent of a Google Map". Nguyen van 5.1 noi NGUOC LAI — "Customer
may use Google Maps Content from the Places API in Customer Applications
WITHOUT a corresponding Google Map", chi buoc ghi cong (5.2). Cai bi cam la
dung KEM BAN DO KHONG PHAI CUA GOOGLE (5.3). Rao can that la LUU TRU.
═════════════════════════════════════════════════════════════════════════════

CHI PHI Ở N=47 — $0, nhung khong phai vi tang nao cung mien phi:

  Text Search Essentials (IDs Only)   khong tran        -> buoc 1
  Place Details Pro                   5.000 free/thang  -> buoc 2, ta dung 47

Buoc 2 PHAI la tang Pro: `displayName` chi co o Pro, `location` co tu
Essentials. Tang `IDs Only` chi tra `id`, tuc khong co gi de doi chieu.
Lay Essentials cho re thi chi con TRUC KHOANG CACH — dung cai bay
"distance is not identity" da gan gio mo cua cua quan ca phe cho mot cai ho.
Tra them mot tang de co ca hai truc la dung gia.

LUAT NHAN — HAI TRUC, khong phai mot:
  Truc TEN   ten Google tra ve khop ten ta co theo BIEN TU (`tim_cum`), VA
  Truc VI TRI mot trong hai, tuy thu ta co:
     (a) toa do Google cach toa do ta dang giu <= 100 m, HOAC
     (b) "so nha + ten duong" cua ta xuat hien trong dia chi Google tra ve

Vi sao truc vi tri co hai dang: do duoc, 16/30 khach san duoc chon co toa do,
14 dong con lai KHONG co — nhung ca 14 deu co so nha + ten duong. Neu bat buoc
dung khoang cach thi 14 dong do bi loai het, va ta se bao cao "khong phan giai
duoc" cho mot lop du lieu that ra rat day du.

Bai hoc "distance is not identity" khong noi truc thu hai PHAI la khoang cach
— no noi phai co MOT TRUC DOC LAP THU HAI. So nha + ten duong la mot truc nhu
vay, va o thanh pho no con chat hon ban kinh 100 m.

Mot truc dung mot truc sai -> ghi "chua phan giai", KHONG nhan. In ca ba nhom
de nguoi doc thay ty le that, chu khong chi thay phan thanh cong.

BA BO GOI, chon bang `--bo`:
  huongdan  (mac dinh) top quan an + luu tru theo bac gia  -> place_id.json
  hxh                  luu tru quanh Ho Xuan Huong 1 km     -> place_id_hxh.json
  quanhxh              quan an quanh Ho Xuan Huong 500 m    -> place_id_quan_hxh.json

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_google_placeid.py <thu-muc-raw>
       PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_google_placeid.py <thu-muc-raw> --bo hxh
"""
import json, os, sys, io, math, re, time
import urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_chung import luu_json, fold, tim_cum
import hoat_dong_data as _hd
import an_ngu_data as _an

# --bo huongdan (mac dinh)  bo goi cua bo huong dan: top quan an + luu tru theo bac
# --bo hxh                  co so luu tru quanh Ho Xuan Huong trong bang gia quy uoc
# --bo quanhxh              quan an quanh Ho Xuan Huong (ban kinh rieng, 500 m)
_tudo, BO = [], "huongdan"
_i = 1
while _i < len(sys.argv):
    a = sys.argv[_i]
    if a == "--bo":
        _i += 1
        BO = sys.argv[_i] if _i < len(sys.argv) else BO
    elif a.startswith("--bo="):
        BO = a.partition("=")[2]
    else:
        _tudo.append(a)
    _i += 1
if BO not in ("huongdan", "hxh", "quanhxh"):
    print(f"--bo không nhận “{BO}”. Chỉ có: huongdan · hxh · quanhxh")
    sys.exit(1)
if not _tudo:
    print("thiếu thư mục raw.  Chạy: sweep_google_placeid.py <thu-muc-raw>"
          " [--bo hxh|quanhxh]")
    sys.exit(1)
RAW = _tudo[0]
OUT = os.path.join(RAW, {"huongdan": "place_id.json", "hxh": "place_id_hxh.json",
                         "quanhxh": "place_id_quan_hxh.json"}[BO])
PHIEN_BAN = 1

API = "https://places.googleapis.com/v1/places:searchText"
BAN_KINH_M = 100          # truc 1: khoang cach toi da
NGHI_GIAY = 0.2


def doc_khoa():
    k = os.environ.get("GOOGLE_MAPS_API_KEY")
    if k and k.strip():
        return k.strip(), "biến môi trường"
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("GOOGLE_MAPS_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v, p
    return None, None


def met(la1, lo1, la2, lo2):
    return math.hypot((la1 - la2) * 111320,
                      (lo1 - lo2) * 111320 * math.cos(math.radians(la1)))


def goi(ten, dia_chi, lat, lon, khoa):
    """Text Search mot lan. FieldMask xin dung ba truong can de doi chieu.

    `places.id` (IDs Only) + `places.displayName` + `places.location` -> tinh
    tien o tang cao nhat trong cac truong duoc xin, tuc Pro. Xin them bat ky
    truong nao khac se day len Enterprise ma khong them gia tri doi chieu.
    """
    q = " ".join(x for x in (ten, dia_chi) if x)
    body = {"textQuery": q, "languageCode": "vi", "maxResultCount": 5}
    if lat and lon:
        body["locationBias"] = {"circle": {
            "center": {"latitude": lat, "longitude": lon}, "radius": 500.0}}
    req = urllib.request.Request(
        API, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "X-Goog-Api-Key": khoa,
                 "X-Goog-FieldMask": ("places.id,places.displayName,"
                                      "places.location,places.formattedAddress")})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r).get("places", [])


# ── Bo TU CHI LOAI truoc khi so ten ────────────────────────────────────────
# Lan chay dau loai oan 8 khach san dung, tat ca vi mot ly do: dang ky ghi
# "Khách sạn X" con Google ghi "X Hotel". `tim_cum` doi chuoi nay nam trong
# chuoi kia nen ca hai deu truot — trong khi khoang cach do duoc la 3-20 m va
# danh tu rieng trung khop hoan toan:
#     Khách sạn Bồ Công Anh  10 m  <-> Bo Cong Anh Hotel
#     Khách sạn An Phú        3 m  <-> An Phú Hotel - Đà Lạt
#     Khách sạn TTC Premium  14 m  <-> TTC Hotel - Đà Lạt
#     Khách sạn biệt thự Liên Hương 6 m <-> Liên Hương Villa
#
# Docstring cua `sweep_luu_tru.py` da canh bao dung chuyen nay: "gan nhu moi
# ten deu mo dau bang tu chi LOAI. Bo tu do di roi moi so — neu khong thi moi
# khach san deu giong moi khach san." Canh bao do doc roi ma khong ap dung.
#
# Bo o CA HAI phia va bo bat ky dau — "Khách sạn Golf 1" -> "golf 1",
# "Duparc Hotel Dalat" -> "duparc dalat". Danh tu rieng la thu con lai.
_TU_LOAI = ("khach san", "khachsan", "nha nghi", "nha khach", "biet thu",
            "hotel", "motel", "hostel", "resort", "villa", "villas",
            "homestay", "guesthouse", "guest house", "lodge", "inn",
            "quan", "tiem", "nha hang", "cafe", "coffee", "da lat", "dalat")


def bo_tu_loai(t):
    """Bo tu chi loai + ten thanh pho, giu lai danh tu rieng."""
    for w in _TU_LOAI:
        t = t.replace(w, " ")
    return " ".join(t.split())


def _lien(t):
    """Chi giu chu va so, bo het dau cau va khoang trang.

    Hai ca con truot sau khi bo tu chi loai deu KHONG phai khac nghia:
        "TTC Hotel - Đà Lạt" -> "ttc -"     dau gach con lai chan `tim_cum`
        "Du Parc" vs "Duparc"               khac cho ngat tu
    Dau cau va khoang trang khong mang nghia trong ten rieng, nen chuan hoa
    chung la dung — khac han voi viec noi long tap tu chung (do la them ngoai
    le cho tung dong, cai nay la bo mot chieu nhieu khong mang tin).
    """
    return "".join(c for c in t if c.isalnum())


def khop_ten(a, b):
    """Hai ten co cung danh tu rieng khong, sau khi bo tu chi loai."""
    for x, y in ((a, b), (bo_tu_loai(a), bo_tu_loai(b))):
        if not x or not y:
            continue
        if next(tim_cum(x, y), None) is not None or \
           next(tim_cum(y, x), None) is not None:
            return True
    # Vong cuoi: bo dau cau + khoang trang, va doi BANG NHAU chu khong phai
    # chuoi con.
    #
    # Vi sao `==` chu khong phai `in`: vong nay da bo het ranh gioi tu, nen
    # `in` se khop nhung cap ma `tim_cum` co y KHONG khop. Giu chat o day vi
    # no la vong NOI LONG cuoi cung — noi long mot chieu thi phai siet chieu
    # kia. Gia phai tra la mot ca dung bi bo: "TTC Premium" (ten ta) vs "TTC"
    # (ten Google) — ten ta co them mot tu nen khong bang nhau. Chap nhan:
    # mot link dan khach toi nham cho te hon han mot o trong.
    #
    # ⚠ Ghi cho nguoi doc sau: `tim_cum` o hai vong tren VAN cho tien to co
    # bien tu ("Bánh Căn Lệ" ⊂ "Bánh Căn Lệ - Chi nhánh 2"), va do la CO Y —
    # ten ngan thuong la cung co so duoi ten day du hon. Dung "sua" no.
    x, y = _lien(bo_tu_loai(a)), _lien(bo_tu_loai(b))
    return bool(x) and x == y


def chuan_dia_chi(s):
    """Chuan hoa hai khac biet dinh dang thuan tuy cua dia chi Viet.

    Do duoc tren lan chay 51%: dung chung chan mat Palace Heritage ("02 Trần
    Phú" vs Google "2 Trần Phú") va vai dong khac.
      - bo tu "duong" / "pho" / "d." : tu chi loai cua dia chi, khong dinh vi gi
      - bo so 0 dung dau so nha: "02" va "2" la cung mot toa nha

    MOT ham, dung cho CA HAI phia. Truoc day chi phia ta duoc chuan hoa con
    chuoi cua Google thi khong, nen "3 phan boi chau" khong khop
    "3 d. phan boi chau" — mot khac biet dinh dang bi doc thanh khac biet dia
    chi. Hai phia phai qua cung mot bo chuan hoa, nếu khong thi phep so sanh do
    ca dinh dang lan noi dung.

    DAU CAU PHAI BO TRUOC. Ban dau ham nay giu lai dau cau va no sinh duong tinh
    gia ngay o dong dau tien duoc kiem: ta "30-32 Nguyễn Chi Thanh" vs Google
    "30-32 Đ. Nguyễn Chí Thanh" — cung mot dia chi, nhung `\\bd\\b` xoa chu "Đ"
    ma DE LAI dau cham, thanh "30 32 . nguyen chi thanh", nen phep `in` truot.
    Bo moi ky tu khong phai chu/so ngay tu dau thi ca "30-32" lan "30 32" lan
    "Đ." deu ve mot dang.
    """
    d = re.sub(r"[^0-9a-z]+", " ", fold(s or ""))
    d = re.sub(r"\b(duong|pho|d)\b", " ", d)
    d = re.sub(r"\b0+(\d)", r"\1", d)
    return " ".join(d.split())


def ten_pho(dau):
    """"3 phan boi chau" -> "phan boi chau". Bo cac tu dau co chua chu so."""
    tok = dau.split()
    i = 0
    while i < len(tok) and any(c.isdigit() for c in tok[i]):
        i += 1
    return " ".join(tok[i:])


def dau_dia_chi(s):
    """"133 Bùi Thị Xuân, Xuân Hương - Đà Lạt, …" -> "133 bui thi xuan".

    Chi lay doan truoc dau phay dau tien: do la so nha + ten duong, phan DUY
    NHAT dinh vi mot toa nha. Phan sau la phuong/thanh pho/tinh — giong nhau o
    hang tram co so nen khong phan biet duoc gi.
    """
    d = (s or "").split(",")[0]
    if not any(c.isdigit() for c in d):
        return ""                       # khong co so nha thi bo
    return chuan_dia_chi(d)


def phan_giai(r, khoa):
    """Tra ve (place_id, ly_do, so_nha_lech).

    `so_nha_lech` True khi CUNG MOT TEN PHO co mat o ca hai phia ma so nha thi
    khong. Ly do co co nay:

    `Khách sạn Nam Phương` — dang ky ghi "3 Phan Bội Châu", Google ghi
    "22 Phan Bội Châu", ten trung khit, cach nhau duoi 100 m. Gan nhu chac chan
    la mot toa nha va mot trong hai so nha da cu. Nhung tai lieu thi in so nha
    CUA TA canh mot link mo ra so nha KHAC, va khong co gi bao — khach lai den
    so 3 co the khong thay khach san.

    DIEU KIEN "cung ten pho" la bat buoc, khong phai lam dep. Ban dau co chi
    doi "so nha cua ta khong co trong dia chi Google" va no gan co cho 25/53
    dong — trong do `Khách sạn Nam Nguyên`, ma Google tra ve mot PLUS CODE
    ("WCQQ+74P") thay vi dia chi. Do khong phai hai nguon bat dong ve so nha,
    do la mot nguon KHONG CO so nha — "khong doi chieu duoc" bi in ra thanh
    "lech", dung cai loi da ghi trong so ngay 28/07 (mot phep kiem khong chay
    duoc phai bao khac voi mot phep kiem cho ket qua am).

    Co nay la mot BOOLEAN suy ra tu phep so sanh, khong phai gia tri cua Google,
    nen luu duoc; con dia chi Google thi bien mat cung ham nay nhu moi khi.
    """
    ten, dia_chi = r.get("ten"), r.get("dia_chi")
    lat, lon = r.get("lat"), r.get("lon")
    try:
        ung = goi(ten, dia_chi, lat, lon, khoa)
    except urllib.error.HTTPError as e:
        return None, f"LỖI {e.code}: {e.read().decode('utf-8','replace')[:90]}", False
    except Exception as e:
        # KHONG de mot loi mang thoang qua giet ca luot. Mot dong hong la mot
        # dong "chua phan giai"; 46 dong con lai van phai ve toi file.
        return None, f"LỖI {type(e).__name__}: {str(e)[:80]}", False
    if not ung:
        return None, "Google không trả kết quả nào", False
    n_ta = fold(ten)
    dau_ta = dau_dia_chi(dia_chi)
    thieu_vitri, lech_ten = None, None
    for p in ung:
        g_ten = fold((p.get("displayName") or {}).get("text"))
        loc = p.get("location") or {}
        g_la, g_lo = loc.get("latitude"), loc.get("longitude")
        g_dc = chuan_dia_chi(p.get("formattedAddress"))

        ten_dung = bool(g_ten) and khop_ten(g_ten, n_ta)
        # Truc vi tri: khoang cach HOAC so nha + ten duong — cai nao dung cung
        # duoc, khong phai "khoang cach truoc, dia chi chi khi thieu toa do".
        #
        # Ban dau viet if/elif, va no chan mat bang chung tot hon: toa do khach
        # san den tu mot phep khop mo nen co the lech, vi du Palace Heritage
        # lech 611 m · Hương Giang 491 m · Hữu Nghị 2 823 m — trong khi so nha
        # cua chung ("02 Trần Phú"…) khop thang. Mot toa do cu khong duoc phep
        # phu quyet mot dia chi dung.
        #
        # Van la HAI TRUC: ten + vi tri. Chi la truc vi tri nhan hai dang bang
        # chung, va mot dang dung la du.
        gan = xa_m = None
        if lat and lon and g_la:
            xa_m = met(lat, lon, g_la, g_lo)
            gan = xa_m <= BAN_KINH_M
        khop_dc = bool(dau_ta and g_dc and dau_ta in g_dc)
        dung_vitri = bool(gan) or khop_dc
        if khop_dc and not gan:
            mo_ta_vitri = f"địa chỉ “{dau_ta}”"
        elif xa_m is not None:
            mo_ta_vitri = f"{xa_m:.0f} m"
        elif dau_ta:
            mo_ta_vitri = f"địa chỉ “{dau_ta}” không khớp"
        else:
            mo_ta_vitri = "không có trục vị trí nào để đối chiếu"

        if ten_dung and dung_vitri:
            # Chi ket luan "lech" khi TEN PHO co o ca hai phia ma so nha thi
            # khong. Thieu dieu kien ten pho thi "Google khong co dia chi" va
            # "Google co dia chi khac" tron lam mot — xem docstring.
            _pho = ten_pho(dau_ta)
            lech = (bool(gan) and bool(dau_ta) and not khop_dc
                    and bool(_pho) and _pho in g_dc)
            return p["id"], f"khớp cả tên và vị trí ({mo_ta_vitri})", lech
        if dung_vitri and not ten_dung:
            lech_ten = (f"vị trí khớp ({mo_ta_vitri}) nhưng tên khác: "
                        f"“{(p.get('displayName') or {}).get('text')}”")
        if ten_dung and not dung_vitri:
            thieu_vitri = f"tên khớp nhưng vị trí không ({mo_ta_vitri})"
    # KHONG nhan khi chi mot truc dung. Mot ket qua sai o day se thanh mot link
    # dan khach toi nham cho — te hon han mot o trong.
    return (None,
            lech_ten or thieu_vitri or "không ứng viên nào qua được hai trục",
            False)


khoa, nguon = doc_khoa()
if not khoa:
    print("KHÔNG tìm thấy GOOGLE_MAPS_API_KEY.")
    print("Tạo ở console.cloud.google.com: bật Places API (New), tạo API key,")
    print("Restrict key → API restrictions → CHỈ Places API (New).")
    print("⚠ Phải GẮN TÀI KHOẢN THANH TOÁN vào project — chưa gắn thì Maps")
    print("  Platform chỉ cho 1 lệnh/ngày, không phải lỗi khoá.")
    sys.exit(0)
print(f"khoá đọc từ: {nguon}  (giá trị không in ra)\n")

# ── Bo can phan giai ───────────────────────────────────────────────────────
muc = []
if BO == "hxh":
    # Bo loc nam trong `an_ngu_data`, KHONG o day: builder .docx doc cung ham
    # do. Mot literal loc chep sang script nay la cach hai ban lech nhau ma
    # khong ai biet — dung loi da ghi so 30/07.
    _q = _an.tai_luu_tru_quanh_ho(RAW)
    if not _q:
        print("không đọc được luu_tru.json"); sys.exit(1)
    for c in _q["trong"]:
        muc.append({"lop": "lưu trú · quanh hồ", "ten": c["ten"],
                    "dia_chi": c.get("dia_chi"),
                    "lat": c.get("lat"), "lon": c.get("lon")})
    print(f"bộ HXH — {len(muc)} cơ sở trong {_q['ban_kinh']} m quanh Hồ Xuân Hương")
    print(f"   (bảng giá quy ước {_q['gia'][0]:,}–{_q['gia'][1]:,}₫"
          .replace(",", ".") + f" · {_q['tong_bang_gia']} cơ sở toàn thành phố,"
          f" {_q['co_toa_do']} có toạ độ)")
    print(f"   {len(_q['khong_toa_do'])} cơ sở có địa chỉ nhưng KHÔNG có toạ độ"
          " — ngoài phép lọc này, không phân giải\n")
if BO == "quanhxh":
    _q = _an.tai_quan_an_quanh_ho(RAW)
    if not _q:
        print("không đọc được nha_hang.json"); sys.exit(1)
    for c in _q["trong"]:
        muc.append({"lop": "quán ăn · quanh hồ", "ten": c["ten"],
                    "dia_chi": c.get("dia_chi"),
                    "lat": c.get("lat"), "lon": c.get("lon")})
    print(f"bộ QUÁN-HXH — {len(muc)} quán trong {_q['ban_kinh']} m quanh Hồ Xuân Hương"
          f" (trên {_q['tong_mo']:,} quán còn hoạt động)".replace(",", "."))
    print(f"   {_q['co_dia_chi']} có địa chỉ · {_q['co_dien_thoai']} có số gọi\n")
for r in (_hd.tai_top_quan(RAW) if BO == "huongdan" else []):
    muc.append({"lop": "quán ăn", "ten": r["ten"], "dia_chi": r.get("dia_chi"),
                "lat": r.get("lat"), "lon": r.get("lon")})
# `tai_luu_tru` la lop CHON LOC, no khong mang toa do — do la dung, vi tai lieu
# khong in toa do khach san. Nhung buoc doi chieu thi can. Tra nguoc ve file goc
# theo ten da gap phang; do duoc 16/30 dong co toa do, 14 dong con lai se dung
# truc so-nha-ten-duong.
if BO == "huongdan":
    _p = os.path.join(RAW, "luu_tru.json")
    _toa_do = {}
    if os.path.exists(_p):
        _d = json.load(io.open(_p, encoding="utf-8"))
        _toa_do = {fold(r["ten"]): (r.get("lat"), r.get("lon"))
                   for r in (_d["co_so"] if isinstance(_d, dict) else _d)}
    lt = _an.tai_luu_tru(RAW) or {}
    for bac in lt.get("bac", []):
        for c in bac["co_so"]:
            la, lo = _toa_do.get(fold(c["ten"]), (None, None))
            muc.append({"lop": f"lưu trú · {bac['ten']}", "ten": c["ten"],
                        "dia_chi": c.get("dia_chi"), "lat": la, "lon": lo})
print(f"cần phân giải: {len(muc)} cơ sở")
# Phan loai theo tien to cua `lop`, khong so BANG mot chuoi: bo `quanhxh` dat
# lop la "quán ăn · quanh hồ" nen phep so bang cu bao "0 quán ăn · 353 lưu trú"
# — mot dong thong ke sai o ngay dau lan chay.
_nq = sum(1 for m in muc if m["lop"].startswith("quán ăn"))
print(f"   {_nq} quán ăn · {len(muc)-_nq} lưu trú")
print(f"   có toạ độ để đối chiếu: {sum(1 for m in muc if m['lat'])}\n")

ra, hong = [], []
for i, m in enumerate(muc, 1):
    pid, ly, so_nha_lech = phan_giai(m, khoa)
    if pid:
        d = {"lop": m["lop"], "ten": m["ten"], "place_id": pid}
        if so_nha_lech:
            d["so_nha_lech"] = True
        ra.append(d)
        print(f"  {i:3} ✓ {m['ten'][:34]:36} {pid}"
              + ("  ⚠ số nhà lệch" if so_nha_lech else ""))
    else:
        hong.append({"lop": m["lop"], "ten": m["ten"], "ly_do": ly})
        print(f"  {i:3} — {m['ten'][:34]:36} {ly[:60]}")
    time.sleep(NGHI_GIAY)

# CHI ghi place_id. `displayName`/`formattedAddress`/`location` cua Google chi
# ton tai trong bo nho ham `phan_giai` va bien mat cung no.
#
# Ban chong ghi de: khac hai sweep YouTube, buoc nay KHONG bi do han muc nen
# chay lai mien phi. Nhung "lay lai duoc" khac "mat cung duoc" — mot lan chay
# gap su co mang tra ve 3 dong khong duoc phep de len 40 dong da phan giai.
# Coi "chua co file" la moc 0 dong, dung cai lo hong lan-chay-dau da sua o hai
# sweep kia.
cu = []
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8")).get("co_so", [])
    except Exception:
        print(f"DỪNG: {OUT} tồn tại nhưng KHÔNG đọc được."
              " Không ghi đè khi mốc so sánh không tin được.")
        sys.exit(1)
goi_ra = {"phien_ban": PHIEN_BAN, "co_so": ra, "chua_phan_giai": hong}
if hong and len(ra) <= len(cu):
    bak = OUT.replace(".json", f".dorang-{len(ra)}coso.json")
    luu_json(bak, goi_ra)
    print(f"⚠ Lần chạy này chỉ phân giải {len(ra)} cơ sở, không hơn"
          f" {len(cu)} đã có. KHÔNG ghi đè — kết quả dở ở: {bak}")
    OUT = bak
else:
    luu_json(OUT, goi_ra)
print("\n" + "═" * 62)
print(f"phân giải được {len(ra)}/{len(muc)}"
      f"  ({100*len(ra)/max(len(muc),1):.0f}%)")
print(f"chưa phân giải {len(hong)} — KHÔNG nhận khi chỉ một trục đúng")
print(f"saved -> {OUT}")
print("raw/ chỉ chứa place_id — không rating, không tên/địa chỉ từ Google.")
