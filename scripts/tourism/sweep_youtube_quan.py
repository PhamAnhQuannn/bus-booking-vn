# -*- coding: utf-8 -*-
"""U — tim QUAN nao vlog thuc su khuyen, bang YouTube Data API.

Day la muc dich BAN DAU cua khoa YouTube (Phase N): thu DANH TU RIENG tu vlog.
Khac han viec da that bai o Phase T2 — o do `totalResults` duoc dung lam thuoc
do do noi tieng va no dao nguoc cau tra loi. O day khong dung con so nao lam
thuoc do; chi doi chieu TEN.

═════════════════════════════════════════════════════════════════════════════
BON DIEU DA THAM DO, VA CHUNG DOI THIET KE

1. `videos.list` LA DUONG DUNG, VA GAN NHU MIEN PHI.
   `search.list` tra mo ta BI CAT (~120 ky tu) va ton 100 don vi.
   `videos.list` tra mo ta DAY DU va ton 1 don vi.
   Do duoc: 10 video -> search cho vai dong cut; videos.list cho 6.071 ky tu.
   Nen: search CHI de lay ID, roi videos.list theo lo 50.

2. 4/10 VIDEO CO MO TA RONG (Shorts). Nang suat ~60% — tinh vao nguong.

3. TRICH TEN TU DO BANG REGEX RA PHAN LON LA RAC. Tieng Viet viet hoa ten mon
   giua cau, nen mau (Quán|Tiệm|Kem)\\s+[A-ZĐÀ-Ỹ]... bat ca van xuoi:
       "Kem Bơ là một món ăn đang h" · "Kem Bơ quán nào" · "Kem Bơ đã trở thành"
   Nhung no bat duoc mot vien ngoc: "Kem Phụng Đà Lạt 39 năm".

4. NEN DAO HUONG: DOI CHIEU TU DIEN, khong trich tu do.
   Kiem cac quan vlog nhac — TAT CA deu co trong Overture, kem san SDT/dia chi:
       Kem Phụng · Bánh Căn Lệ · Nem nướng Bà Hùng · Chè Hé · Cô Lũng
   Doi chieu thang trich tu do ba mat: khong ra rac, moi ket qua kem san so goi,
   va kiem duoc.

BAY CUA CACH DOI CHIEU: ten co so TOAN TU CHUNG.
   "Bánh Căn Đà Lạt" · "Ăn Vặt Đà Lạt" · "Món Ngon Đà Lạt" · "Du Lịch Đà Lạt"
   la co so co ten dung bang cum chung, nen bat ky vlog nhac "banh can da lat"
   deu khop. Dung bay GENERIC_TOKENS da gap o resolve_facebook.py.
   Do duoc: chi 74 ten thuoc dien nay — danh sach dem duoc.
═════════════════════════════════════════════════════════════════════════════

RANH GIOI PDPL (giu nguyen tu Phase N va O):
  LUU     ten co so · so video nhac · the phong cach · truy van nao tim ra
  KHONG   ten kenh · tieu de · mo ta · ID video · anh
Van ban vlog chi ton tai trong bo nho du lau de doi chieu roi bo — cung nguyen
tac Phase O cat vung bai dang TRUOC khi doc thay vi loc sau.

Chay:  python scripts/tourism/sweep_youtube_quan.py <thu-muc-raw>
"""
import json, os, sys, io, re, time, unicodedata
import urllib.parse, urllib.request, urllib.error
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Loi dung chung voi moi bo quet YouTube khac. Moi ten duoi day tung nam TRONG
# file nay; chuyen ra vi bo quet LUU TRU can y het, va mot quy tac dung chung
# boi hai bo quet ma nam trong tung bo quet thi mot ben se lech trong im lang.
from yt_chung import (S_API, V_API, MAX_KQ, MIN_KENH, MIN_TEN,
                      TRAN_DON_VI, TRAN_LENH_SEARCH, chi_phi,
                      luu_json, fold, tim_cum, co_ten_rieng, doc_khoa,
                      ly_do_403, LY_DO_HAN_MUC,
                      ngay_pacific, doc_nhat_ky, ghi_nhat_ky)

RAW = sys.argv[1]
OUT = os.path.join(RAW, "quan_vlog.json")

# Dinh nghia SOM: moc so sanh o duoi doc `PHIEN_BAN` truoc khi tieu han muc,
# nen hang so nay phai co truoc khoi do. Truoc day no nam gan cho ghi file,
# tuc SAU noi dung — mot NameError chi lo ra khi chua co file dau ra.
PHIEN_BAN = 2      # 2 = khop theo tung truong + bien tu (tim_cum)

# HAI han muc + moc reset: xem `yt_chung.chi_phi` va `yt_chung.ngay_pacific`.
# Han muc reset NUA DEM PACIFIC = 14:00-15:00 gio Viet Nam. Chay luc 00:00 gio
# VN la chay giua chu ky da troi 9-10 tieng. Len lich SAU 15:00 gio VN.
# Vi sao 8 chu khong phai 10: `MIN_TEN = 10` loai "kem phung" (9 ky tu) — quan
# kem lau nam that cua Da Lat, va la ca kiem chuan tu tham do ban dau. No cung
# bo 284 co so an uong khac co ten 8-9 ky tu: "Quán NiNô", "Bò Lê Lết",
# "Tửu Quán". Ha xuong 8 an toan vi hai luat kia da giu tuyen: phai la hang muc
# AN UONG, va ten phai co token ngoai bo tu mon.

# ── Nhom A: theo mon ────────────────────────────────────────────────────────
TV_MON = ["kem bơ", "sữa đậu nành", "bánh tráng nướng", "bánh căn",
          "bánh ướt lòng gà", "nem nướng", "bánh mì xíu mại", "lẩu gà lá é",
          "trứng nướng", "xiên bẩn", "chè", "cơm lam", "atisô", "dâu tây",
          "hồng treo gió"]
# ── Nhom B: an vat / via he noi chung ───────────────────────────────────────
TV_CHUNG = ["ăn vặt Đà Lạt", "quán vỉa hè Đà Lạt", "ăn đêm Đà Lạt",
            "review đồ ăn Đà Lạt", "ăn gì ở Đà Lạt", "quán ăn ngon Đà Lạt",
            "food tour Đà Lạt", "chợ đêm Đà Lạt ăn gì"]
# ── Nhom C: phong cach dac biet ─────────────────────────────────────────────
TV_PHONG_CACH = ["quán lạ Đà Lạt", "quán độc đáo Đà Lạt",
                 "quán mỗi ngày một món Đà Lạt", "quán không menu Đà Lạt",
                 "quán lâu năm Đà Lạt", "quán gia truyền Đà Lạt",
                 "quán cụ Đà Lạt", "quán ăn đặc biệt Đà Lạt",
                 "trải nghiệm ăn uống Đà Lạt", "quán cổ Đà Lạt"]

# The phong cach — bo TU VUNG CO DINH. Chi luu THE, khong luu cau goc.
# The mo ta CACH KINH DOANH cua mot co so, nen la du lieu doanh nghiep.
THE = {
    "mỗi ngày một món": ("mỗi ngày một món", "mỗi ngày 1 món", "ngày nào món đó"),
    "không có menu": ("không có menu", "không menu", "không thực đơn"),
    "gia truyền": ("gia truyền", "bí quyết gia đình", "truyền ba đời"),
    "lâu năm": ("lâu năm", "hơn 30 năm", "hơn 40 năm", "gần 50 năm", "nửa thế kỷ"),
    "vỉa hè": ("vỉa hè", "lề đường", "xe đẩy"),
    "ăn đêm": ("ăn đêm", "bán đêm", "mở tới khuya", "khuya"),
    "quán cụ / quán cổ": ("quán cụ", "quán cổ", "quán xưa"),
    "phục vụ đặc biệt": ("phục vụ đặc biệt", "cách phục vụ", "tự phục vụ"),
}

# Tu KHONG phan biet duoc co so nay voi co so kia. Ten con lai sau khi bo het
# nhung tu nay ma RONG thi khong dung de doi chieu.
CHUNG = set("""da lat dalat quan tiem an vat mon ngon banh keo nuong com pho chao
lau oc bun che kem sua trung xien do uong cafe coffee food restaurant nha hang
du lich tour hoa dau tay cho dem khu hoa binh cao nguyen goc viet nam mien
ngoi review top best good delicious street shop store house home garden villa
so cua hang dac san sieu thi trung tam gia re moi cu lon nho""".split())

# KINH NGU — phai nam trong CHUNG, va viec no THIEU la mot lo that.
# Da do: ca 10 tu duoi deu lot qua `co_ten_rieng` va duoc tinh la token dac
# trung. Nghia la "Quán Cô" (neu ton tai) se dat tieu chuan chi nho chu `co`.
# Nang hon: 6/8 quan giu lai o lan chay dau dung dung khuon nay — `Dì Đinh`,
# `cô Chín`, `Bà Hùng`, `Cô Sinh` — nen luat loc thu hai LONG hon toi tuong va
# co the gan cong cho sai quan.
# Them vao thi 4 quan do VAN SONG, vi moi cai con mot ten rieng thuc su ben
# canh kinh ngu: dinh · chin · hung · sinh. Do la kiem chung rang viec them
# nay that chat dung cho ma khong cat mat gi.
CHUNG |= set("co di ba chu anh chi ong bac muoi thay".split())


def dac_trung(ten_folded):
    """Ten con it nhat MOT tu rieng sau khi bo tu chung?

    ⚠ MOT MINH LUAT NAY KHONG DU — da chay va do duoc. No de lot:
        Dulichdalat 61 · Bánh tráng nướng 59 · Thành Phố Đà Lạt 42
        Sua Dau Nanh 38 · Lau Ga La E 37 · Banh Mi Xiu Mai 33
    Vi no chi doi MOT token ngoai danh sach chung: "Sua Dau Nanh" -> {sua, dau,
    nanh}, va `nanh` khong nam trong CHUNG nen lot. Khong luat token-level nao
    chua duoc, vi TEN MON la dac trung so voi danh sach chung.
    Nen phai co them hai luat duoi: HANG MUC AN UONG va TOKEN NGOAI TRUY VAN.
    """
    return any(w not in CHUNG for w in ten_folded.split() if len(w) > 1)


# ── Luat 2: chi nhan co so co HANG MUC AN UONG ─────────────────────────────
# Luat nay mot minh da giet phan lon rac: "Thành Phố Đà Lạt", "Hồ Xuân Hương",
# "Làng Cù Lần", "Dulichdalat", "Yêu Đà Lạt" deu khong phai hang muc an uong.
AN_UONG = {
    "restaurant", "cafe", "coffee_shop", "diner", "vietnamese_restaurant", "bakery",
    "eat_and_drink", "barbecue_restaurant", "bubble_tea", "fast_food_restaurant",
    "bar", "tea_room", "seafood_restaurant", "asian_restaurant", "chinese_restaurant",
    "ice_cream_shop", "smoothie_juice_bar", "chicken_restaurant", "pub",
    "breakfast_and_brunch_restaurant", "korean_restaurant", "theme_restaurant",
    "vegetarian_restaurant", "cocktail_bar", "pizza_restaurant", "food",
    "noodles_restaurant", "japanese_restaurant", "thai_restaurant", "indian_restaurant",
    "delicatessen", "desserts", "bar_and_grill_restaurant", "beer_garden", "wine_bar",
    "buffet_restaurant", "italian_restaurant", "beer_bar", "steakhouse",
    "soup_restaurant", "sushi_restaurant", "food_truck", "french_restaurant",
    "gastropub", "burger_restaurant", "food_stand", "street_vendor",
}


# ── Luat 3: ten co so phai co token NGOAI bo tu MON + tu chung ─────────────
# Sinh tu chinh nhan mon trong mon_an_dalat.json, khong viet tay.
MON_TU = set()
# MON_NHAN[nhan_da_bo_dau] = nhan goc. Dung cho khop DONG XUAT HIEN o duoi —
# mot thu khac han bo tu MON_TU, nen giu rieng.
MON_NHAN = {}


# ⚠ NHAN LA TEN QUAN, KHONG PHAI TEN MON — va no XOA chinh quan do.
# `Chè hé` nam trong 30 "mon" cua sweep_monan.py. Do la loi cua toi o Phase T:
# Che He la mot QUAN che lau nam co that o Da Lat, khong phai mot loai mon. Hau
# qua do duoc: token `he` vao MON_TU, nen `Quán Chè Hé` chi con {quan, che, he}
# = toan tu mon + tu chung -> `co_ten_rieng` tra False -> quan bi loai khoi tu
# dien TRUOC KHI doi chieu. Mot trong nhung quan noi tieng nhat cua ca danh sach
# bi chinh nhan cua no lam bien mat.
# Nghich dao cua bay cu: truoc day mot ten DUNG BANG ten mon khop moi vlog; o
# day mot ten mon dung bang ten quan lai giet quan. Ca hai deu vi mot chuoi
# dong thoi la ten chung va ten rieng.
# Cung phai sua o sweep_monan.py (Che He nen la mot QUAN cua nhom `Chè`, khong
# phai mot nhan mon) — ghi vao viec con treo, khong sua len o day.
NHAN_LA_TEN_QUAN = {"chè hé"}


def nap_tu_mon(raw_dir):
    global MON_TU
    p = os.path.join(raw_dir, "mon_an_dalat.json")
    if not os.path.exists(p):
        return
    for label in json.load(io.open(p, encoding="utf-8")):
        if label.strip().lower() in NHAN_LA_TEN_QUAN:
            continue
        MON_TU |= {w for w in fold(label).split() if len(w) > 1}
        # Bo phan trong ngoac: "Dâu tây (vườn / quán)" -> "dau tay".
        n = fold(label.split("(")[0].split("·")[0])
        if len(n) > 3:
            MON_NHAN[n] = label


# `co_ten_rieng` o `yt_chung` — luat chung, tap tu-chung thi rieng tung lop.
# Voi lop AN UONG tap do la MON_TU | CHUNG: "Bánh tráng nướng" toan tu mon nen
# LOAI, con "Bánh Căn Lệ" con `le` nen GIU.
def co_ten_rieng_an_uong(ten_folded):
    return co_ten_rieng(ten_folded, MON_TU | CHUNG)


khoa, nguon = doc_khoa()
if not khoa:
    print("KHONG tim thay YOUTUBE_API_KEY. Dung.")
    sys.exit(0)
print(f"khoá đọc từ: {nguon}  (giá trị không in ra)\n")

# ── Tu dien ten co so ───────────────────────────────────────────────────────
nap_tu_mon(RAW)
print(f"bộ từ món: {len(MON_TU)} token (sinh từ nhãn món, không viết tay)")
ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))
biz, bo_chung, bo_hangmuc = {}, [], []
for r in ovt:
    n = fold(r.get("name"))
    if len(n) < MIN_TEN:
        continue
    if str(r.get("category") or "") not in AN_UONG:
        bo_hangmuc.append(r["name"])
        continue
    if not co_ten_rieng_an_uong(n):
        bo_chung.append(r["name"])
        continue
    biz.setdefault(n, r)
print(f"từ điển đối chiếu: {len(biz)} cơ sở ĂN UỐNG có tên đặc trưng")
print(f"   loại {len(set(bo_hangmuc))} cơ sở không phải hạng mục ăn uống"
      " (Thành Phố Đà Lạt · Hồ Xuân Hương · Dulichdalat…)")
print(f"   loại {len(set(bo_chung))} tên toàn từ chung")
print()

# Quan da dong cua — khong bao gio gioi thieu.
DONG = set()
_p = os.path.join(RAW, "nha_hang.json")
if os.path.exists(_p):
    _nh = json.load(io.open(_p, encoding="utf-8"))
    DONG = ({fold(x["ten"]) for x in _nh["quan"] if x.get("da_dong_cua")}
            | {fold(x["ten"]) for x in _nh.get("dong_cua_ngoai_danh_sach", [])})

don_vi_dung = 0
lenh_search = 0


def goi(api, params):
    global don_vi_dung, lenh_search
    u = api + "?" + urllib.parse.urlencode(dict(params, key=khoa))
    with urllib.request.urlopen(u, timeout=40) as r:
        dv, ls = chi_phi(api)       # HAI han muc — xem yt_chung.chi_phi
        don_vi_dung += dv
        lenh_search += ls
        return json.load(r)


# `ly_do_403`, `LY_DO_HAN_MUC`, `tim_cum` va logic nhat ky ngay o `yt_chung` —
# ca bon tung nam o day, chuyen ra vi bo quet LUU TRU can y het.
#
# ⚠ `ngay_pacific` o `yt_chung` la HAM, con bien cuc bo cu cung ten la CHUOI.
# Dat ten khac (`NGAY`) de mot ben khong am tham che ben kia.
NHAT_KY = os.path.join(RAW, "yt_lenh_theo_ngay.json")
NGAY = ngay_pacific()
_nk = doc_nhat_ky(NHAT_KY)
da_dung_hom_nay = int(_nk.get(NGAY, 0))


def ghi_nhat_ky_hom_nay():
    ghi_nhat_ky(NHAT_KY, _nk, NGAY, lenh_search)


def mon_gan(txt, ten, cua_so=120):
    """Mon nao xuat hien GAN ten quan trong doan van nay.

    ĐÂY LA THAY DOI DO PHU LON NHAT CUA CA DUONG ONG. Truoc day mot quan chi
    duoc gan mon khi TEN NO CHUA TU MON. Khop dong xuat hien khong doi ten chua
    gi: no doc VUNG VAN BAN quanh cho ten xuat hien, nen bat duoc "Quán Cô Ba"
    ban banh can va "Tiệm nướng Cư Xá".

    SO DO LAI TREN 5.543 co so an uong Overture — va no KHONG khop con so toi
    da viet trong ke hoach (754 / 14% / tang 7 lan). Ba thuoc do khac nhau, toi
    da tron chung:
        897  (16%)  quan gan duoc mon o mon_an_dalat.json — khop CA CUM mon co
                    bien tu. Day moi la moc dung de so sanh
        2.790 (50%) ten chua BAT KY token mon nao — long hon nhieu
        4.974 (90%) ten du dac trung de doi chieu = TRAN cach moi
    Nen muc tang that la 897 -> toi da 4.974, tuc ~5,5 lan, khong phai 7 lan.
    Con so 754 la mot thuoc do thu tu tu mot buoc khac han; ghi lai o day de
    khong ai (ke ca toi) dan lai no.

    Phai lam TRONG CUNG LUOT TAI, vi van ban vlog khong duoc luu.
    """
    ra = set()
    for i in tim_cum(txt, ten):
        d = txt[max(0, i - cua_so): i + len(ten) + cua_so]
        ra |= {nhan for mf, nhan in MON_NHAN.items()
               if next(tim_cum(d, mf), None) is not None}
    return ra


# nhac_kenh[ten] = {channel_id, ...}   <- NGUONG DEM TREN DAY
# nhac_video[ten] = {video_id, ...}    <- in ra de thay chenh lech
#
# Truoc day nguong dem `videoId`, va do la SAI DON VI. `search.list` thien lech
# ve noi dung nhoi tu khoa kieu "Top 10 quán ăn Đà Lạt" — dung loai ma nguong
# >=2 sinh ra de loai. Mot kenh dang nhieu video, hoac content farm reup cung
# mot danh sach, deu tu thoa >=2 ma khong co ai DOC LAP xac nhan. `channelId`
# co san trong phan hoi videos.list nen sua khong ton them han muc.
nhac_kenh = defaultdict(set)
nhac_video = defaultdict(set)
tu_truy_van = defaultdict(set)
the_cua = defaultdict(set)
mon_cua = defaultdict(set)
loi = []
dung_het = False

NHOM = [("A · theo món", [f"quán {m} Đà Lạt ngon" for m in TV_MON]),
        ("B · ăn vặt chung", TV_CHUNG),
        ("C · phong cách đặc biệt", TV_PHONG_CACH)]

# ── MOC SO SANH DOC TRUOC KHI TIEU HAN MUC ─────────────────────────────────
# Doc o day, khong doc o cuoi: mot file hong phat hien sau vong goi API nghia
# la da tieu ca ngay han muc roi moi tu choi luu. Han muc theo ngay khong hoan
# lai duoc, nen moi phep kiem co the lam huy bo lan chay phai chay TRUOC.
cu = None
# Khoi tao NGOAI khoi `if`: hai bien nay tung chi duoc gan BEN TRONG no, nen
# khi chua co file thi chung khong ton tai. Dieu kien chan ghi de cu che loi do
# bang short-circuit `cu is not None`; bo short-circuit di la ra NameError.
# Moc mac dinh = rong, phien ban = hien tai — dung nghia "chua co gi".
cu_hang, cu_pb = [], PHIEN_BAN
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8"))
    except Exception as e:
        # KHONG duoc coi la "chua co moc". Mot file khong doc duoc la mot file
        # HONG, khac han mot file khong ton tai — va gop hai truong hop lam mot
        # chinh la cach ban va chong ghi de tu vo hieu hoa minh: `except: cu=[]`
        # lam moc tut ve rong, roi MOI ket qua trong nhu cai thien.
        print(f"DUNG — {OUT} tồn tại nhưng KHÔNG đọc được ({type(e).__name__}).")
        print("Không biết lần chạy trước thu được bao nhiêu, nên không thể so"
              " sánh để chặn ghi đè.")
        print("Sửa hoặc đổi tên file đó rồi chạy lại. Chưa tiêu hạn mức nào.")
        sys.exit(1)
    # Hai dang: list = phien ban 1, dict = tu phien ban 2 tro di.
    cu_hang = cu if isinstance(cu, list) else cu.get("quan", [])
    cu_pb = 1 if isinstance(cu, list) else int(cu.get("phien_ban", 1))
    print(f"mốc so sánh: {len(cu_hang)} quán (phiên bản {cu_pb})"
          f" trong {os.path.basename(OUT)}")

du_kien = sum(len(t) for _, t in NHOM)
print(f"dự kiến {du_kien} lệnh search · {du_kien * 100 + du_kien} đơn vị")
if da_dung_hom_nay:
    print(f"⚠ khoá này đã dùng {da_dung_hom_nay} lệnh search HÔM NAY (ngày Pacific"
          f" {NGAY}) theo {os.path.basename(NHAT_KY)}")
    print(f"  còn ~{TRAN_LENH_SEARCH - da_dung_hom_nay}/{TRAN_LENH_SEARCH} lệnh."
          " Nguyên nhân thật của lần cạn hạn mức 28/07 không phải 33 > 100 —")
    print("  mà là chạy sweep BA LẦN cùng ngày lẫn với thăm dò, tổng ~99 lệnh.")
if da_dung_hom_nay + du_kien > TRAN_LENH_SEARCH:
    print(f"\nDỪNG: {da_dung_hom_nay} + {du_kien} vượt trần {TRAN_LENH_SEARCH}"
          " lệnh/ngày.\nHạn mức cấp lại sau 15:00 giờ Việt Nam. Không chạy dở"
          " để rồi mất kết quả.")
    sys.exit(0)
print()

for ten_nhom, truy_vans in NHOM:
    if dung_het:
        break
    print(f"── {ten_nhom} · {len(truy_vans)} truy vấn ──")
    for q in truy_vans:
        if lenh_search >= TRAN_LENH_SEARCH - da_dung_hom_nay:
            print("   (dừng: cạn ngân sách lệnh search của ngày)")
            dung_het = True
            break
        try:
            d = goi(S_API, {"part": "snippet", "type": "video", "maxResults": MAX_KQ,
                            "q": q, "relevanceLanguage": "vi"})
            ids = [i["id"]["videoId"] for i in d.get("items", [])]
            if not ids:
                print(f"   {q[:44]:46s} 0 video")
                continue
            d2 = goi(V_API, {"part": "snippet", "id": ",".join(ids)})
            n_khop = 0
            for it in d2.get("items", []):
                vid, kenh = it["id"], it["snippet"].get("channelId")
                sn = it["snippet"]
                # KHOP TUNG TRUONG RIENG, KHONG GOP CHUOI.
                # Da tu kiem va loi CO THAT:
                #   title "Review quán bánh căn" + desc "Lệ phí gửi xe khá rẻ"
                #   gop  -> "...quan banh can le phi gui xe..."  khop "Bánh Căn Lệ"
                #   khop rieng title = False · khop rieng description = False
                # Nen "Bánh Căn Lệ" o 9 video co the mot phan la ao. Loi cau
                # truc, tai dien voi moi ten ket thuc bang am trung tu mo dau
                # mo ta. Van ban chi ton tai trong bien nay, khong ghi ra dau.
                truong = [t for t in (fold(sn.get("title", "")),
                                      fold(sn.get("description", ""))) if t]
                if not truong:
                    continue
                the_video = {t for t, cums in THE.items()
                             for tr in truong if any(fold(c) in tr for c in cums)}
                for n in biz:
                    tr_khop = [t for t in truong
                               if next(tim_cum(t, n), None) is not None]
                    if not tr_khop:
                        continue
                    nhac_kenh[n].add(kenh)
                    nhac_video[n].add(vid)
                    tu_truy_van[n].add(q)
                    the_cua[n] |= the_video
                    for t in tr_khop:
                        mon_cua[n] |= mon_gan(t, n)
                    n_khop += 1
            print(f"   {q[:44]:46s} {len(ids):2d} video · {n_khop} lượt khớp")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            reason, msg = ly_do_403(body)
            loi.append((q, e.code, reason))
            print(f"   {q[:44]:46s} LỖI {e.code} · {reason or '?'}")
            if e.code in (403, 429):
                print(f"      {msg}")
                if reason in LY_DO_HAN_MUC or not reason:
                    print("      Hết hạn mức ngày — DỪNG. Cấp lại sau 15:00 giờ VN.")
                else:
                    print("      KHÔNG phải hết hạn mức — KHOÁ có vấn đề"
                          f" ({reason}). Chờ mai KHÔNG sửa được;"
                          " tạo lại khoá ở console.cloud.google.com.")
                dung_het = True
                break
        except Exception as e:
            loi.append((q, type(e).__name__, ""))
            print(f"   {q[:44]:46s} LỖI {type(e).__name__}")
        time.sleep(0.3)
    print()

# ── Loc theo nguong va xuat ─────────────────────────────────────────────────
out = []
for n, kenhs in nhac_kenh.items():
    if len(kenhs) < MIN_KENH:
        continue
    r = biz[n]
    if fold(r["name"]) in DONG:
        continue
    out.append({
        "ten": r["name"], "hang_muc": r.get("category"),
        "dia_chi": r.get("address"), "dien_thoai": (r.get("phones") or [None])[0],
        "lat": r["lat"], "lon": r["lon"],
        "so_kenh_nhac": len(kenhs),
        "so_video_nhac": len(nhac_video[n]),
        "mon_lien_quan": sorted(mon_cua[n]),
        "ten_chua_tu_mon": any(w in MON_TU for w in n.split()),
        "the_phong_cach": sorted(the_cua[n]),
        "truy_van": sorted(tu_truy_van[n]),
    })
out.sort(key=lambda x: (-x["so_kenh_nhac"], -x["so_video_nhac"]))

# ── DAU PHIEN BAN, vi mot file cu KHONG the tu noi no sai o dau ─────────────
# File sinh TRUOC ban va bien tu chua `mon_lien_quan` tinh bang chuoi con tran,
# nen no da gan `Bánh căn` cho `Bánh canh Xuân An` ("banh canh" chua "banh can").
# Do la mot cau SAI trong tai lieu, khong phai mot con so lech. Van ban vlog
# khong duoc luu nen KHONG THE tinh lai ngoai tuyen — chi lan chay moi sua duoc.
# Nen bo dung phai biet file thuoc phien ban nao; suy doan tu su hien dien cua
# mot truong la khong du, vi truong van o do va van sai.
goi_ra = {"phien_ban": PHIEN_BAN, "quan": out}

# ── MOT LAN CHAY DO KHONG DUOC GHI DE MOT LAN CHAY DU ──────────────────────
# Loi that da xay ra: lan chay dau thu 72 quan. Lan sau het han muc o truy van
# thu ba, chi thu 2 quan, VA GHI DE — 72 dong bien thanh 2. Han muc "Search
# Queries" la gioi han THEO NGAY, nen mot lan chay dut giua duong la binh
# thuong, khong phai ngoai le.
#
# Cung ho voi luat da ghi trong so: "bo loc quyet dinh GIU gi, khong bao gio
# quyet dinh LUU gi". O day: mot ket qua NGHEO HON khong duoc thay ket qua giau
# hon chi vi no moi hon.
# ⚠ `cu is not None` tung nam trong dieu kien nay va la mot lo hong: khi CHUA
# co file thi khong co moc so sanh nen no ghi thang, va mot lan chay dut giua
# duong luc do de lai file chinh NGHEO — roi chinh file do thanh moc cho lan
# sau. Dung lop loi ban ve nay sinh ra de chan, chi dich sang bien "lan dau".
# Coi "chua co file" la moc 0 dong thi 0 <= 0 va lo hong bien mat.
if loi and len(out) <= len(cu_hang) and cu_pb >= PHIEN_BAN:
    # `cu_pb >= PHIEN_BAN`: mot moc thuoc phien ban CU HON khong duoc thang, du
    # nhieu dong hon. Nhieu dong sai khong tot hon it dong dung — va dong cu
    # mang gan mon tinh bang chuoi con tran, tuc mot cau sai trong tai lieu.
    bak = OUT.replace(".json", f".dorang-{len(out)}quan.json")
    luu_json(bak, goi_ra)
    print(f"⚠ Lần chạy này DỞ ({len(loi)} truy vấn lỗi) và chỉ thu {len(out)} quán, ít hơn")
    print(f"  {len(cu_hang)} quán đã có. KHÔNG ghi đè. Kết quả dở lưu riêng ở:")
    print(f"  {bak}")
    print(f"  Chạy lại đủ khi hạn mức ngày được cấp lại.")
    out = cu_hang
    da_luu_vao = bak
else:
    if cu is not None and cu_pb < PHIEN_BAN and len(out) < len(cu_hang):
        print(f"⚠ Ghi đè {len(cu_hang)} dòng phiên bản {cu_pb} bằng {len(out)} dòng"
              f" phiên bản {PHIEN_BAN}: ÍT hơn nhưng ĐÚNG hơn (khớp theo từng"
              " trường + biên từ). Dòng cũ mang gán món tính bằng chuỗi con tràn.")
    luu_json(OUT, goi_ra)
    da_luu_vao = OUT
ghi_nhat_ky_hom_nay()

duoi_nguong = sum(1 for v in nhac_kenh.values() if len(v) < MIN_KENH)
moi = [r for r in out if not r["ten_chua_tu_mon"] and r["mon_lien_quan"]]
print("═" * 62)
print(f"{len(out)} quán đạt ngưỡng ≥{MIN_KENH} KÊNH · "
      f"{duoi_nguong} quán chỉ 1 kênh (đã loại, KHÔNG hạ ngưỡng để lấp)")
print(f"hạn mức: {lenh_search} lệnh search (+{da_dung_hom_nay} đã dùng hôm nay)"
      f" / {TRAN_LENH_SEARCH} · {don_vi_dung:,}/{TRAN_DON_VI:,} đơn vị"
      .replace(",", "."))
print(f"khớp đồng xuất hiện: {len(moi)} quán gắn được món dù TÊN KHÔNG chứa từ"
      " món — đây là phần thu thêm so với cách khớp theo tên")
if loi:
    print(f"lỗi: {len(loi)} truy vấn — {loi[:3]}")
print()
print(f"{'Quán':38s}{'Kênh':>5s}{'Video':>6s}  Món gần · Thẻ")
for r in out[:30]:
    ghi = " · ".join(filter(None, [", ".join(r["mon_lien_quan"][:3]),
                                   ", ".join(r["the_phong_cach"])])) or "—"
    print(f"{r['ten'][:36]:38s}{r['so_kenh_nhac']:5d}{r['so_video_nhac']:6d}  {ghi}")

pc = [r for r in out if r["the_phong_cach"]]
print(f"\n{len(pc)} quán có thẻ phong cách:")
for t, c in Counter(t for r in out for t in r["the_phong_cach"]).most_common():
    print(f"   {c:3d}  {t}")
# In DUONG DAN THAT SU da ghi, khong phai `OUT` co dinh. Khi ban ve chong ghi
# de bat, du lieu di sang file phu va file chinh KHONG doi — in "saved -> OUT"
# luc do la noi nguoc voi viec vua lam, va nguoi doc log se tin la file chinh
# da cap nhat. Nghich dao cua su co 29/07: ban ve giu duoc du lieu, con loi
# nhan thi bao la no khong giu.
print(f"\nsaved -> {da_luu_vao}")
print("raw/ chỉ chứa tên cơ sở, số video, thẻ — không tên kênh, tiêu đề, mô tả, ID video.")
