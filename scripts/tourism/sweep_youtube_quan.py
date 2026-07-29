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

RAW = sys.argv[1]
OUT = os.path.join(RAW, "quan_vlog.json")
S_API = "https://www.googleapis.com/youtube/v3/search"
V_API = "https://www.googleapis.com/youtube/v3/videos"

MAX_KQ = 25              # video moi truy van
MIN_VIDEO = 2            # nguong bang chung: >=2 video KHAC NHAU
MIN_TEN = 8              # do dai ten co so toi thieu (sau khi bo dau)
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


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


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


def nap_tu_mon(raw_dir):
    global MON_TU
    p = os.path.join(raw_dir, "mon_an_dalat.json")
    if not os.path.exists(p):
        return
    for label in json.load(io.open(p, encoding="utf-8")):
        MON_TU |= {w for w in fold(label).split() if len(w) > 1}


def co_ten_rieng(ten_folded):
    """Ten co so con >=1 token NGOAI bo tu mon va tu chung?

    Ban dau toi viet luat nay THEO TRUY VAN — "ten phai co token khong xuat hien
    trong truy van tim ra no". Kiem ngoai tuyen thi no van de lot ke te nhat:
        Bánh tráng nướng 52 · Sua Dau Nanh 33 · Lau Ga La E 33 · Banh Mi Xiu Mai 30
    Vi mot co so ten dung bang ten mon con khop CA TRUY VAN CHUNG ("ăn vặt Đà
    Lạt"), va so voi truy van do thi "banh trang nuong" CO token rieng. Dung
    any() tren nhieu truy van la tu mo cua hau.

    Nen luat phai DOC LAP VOI TRUY VAN: bo tu mon la co dinh, khong phu thuoc
    cau tim. Token con lai chinh la ten nguoi / thuong hieu — thu bien mot cai
    ten chung thanh mot dia chi cu the:
        "Bánh tráng nướng"        -> toan tu mon            -> LOAI
        "Bánh Căn Lệ"             -> `le` ngoai bo          -> GIU
        "Bánh Tráng nướng Dì Đinh"-> `di`, `dinh` ngoai bo  -> GIU
        "Lẩu Gà Lá É Tao Ngộ"     -> `tao`, `ngo` ngoai bo  -> GIU
    """
    return any(w not in MON_TU and w not in CHUNG
               for w in ten_folded.split() if len(w) > 1)


def doc_khoa():
    k = os.environ.get("YOUTUBE_API_KEY")
    if k and k.strip():
        return k.strip(), "biến môi trường"
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("YOUTUBE_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v, p
    return None, None


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
    if not co_ten_rieng(n):
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


def goi(api, params):
    global don_vi_dung
    u = api + "?" + urllib.parse.urlencode(dict(params, key=khoa))
    with urllib.request.urlopen(u, timeout=40) as r:
        don_vi_dung += 100 if api == S_API else 1
        return json.load(r)


# nhac[ten_folded] = {video_id, ...}  — dem theo VIDEO, khong theo lan xuat hien.
# Mot video nhac hai lan van la MOT bang chung.
nhac = defaultdict(set)
tu_truy_van = defaultdict(set)
the_cua = defaultdict(set)
loi = []

NHOM = [("A · theo món", [f"quán {m} Đà Lạt ngon" for m in TV_MON]),
        ("B · ăn vặt chung", TV_CHUNG),
        ("C · phong cách đặc biệt", TV_PHONG_CACH)]

for ten_nhom, truy_vans in NHOM:
    print(f"── {ten_nhom} · {len(truy_vans)} truy vấn ──")
    for q in truy_vans:
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
                vid = it["id"]
                sn = it["snippet"]
                # Van ban chi ton tai trong bien nay. Khong ghi ra dau.
                txt = fold(sn.get("title", "") + " " + sn.get("description", ""))
                if not txt:
                    continue
                the_video = {t for t, cums in THE.items()
                             if any(fold(c) in txt for c in cums)}
                for n in biz:
                    # HAI dieu kien cung luc: ten co trong van ban VA ten co
                    # token rieng so voi truy van. Thieu dieu kien thu hai thi
                    # co so co ten dung bang ten mon se khop MOI vlog ve mon do
                    # — do la cach "Sua Dau Nanh" leo len 38 video o lan chay
                    # dau, va "Bánh tráng nướng" leo len 59.
                    if n in txt:
                        nhac[n].add(vid)
                        tu_truy_van[n].add(q)
                        the_cua[n] |= the_video
                        n_khop += 1
            print(f"   {q[:44]:46s} {len(ids):2d} video · {n_khop} lượt khớp")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:120]
            loi.append((q, e.code))
            print(f"   {q[:44]:46s} LỖI {e.code}")
            if e.code in (403, 429):
                print(f"      {body}\n      Hết hạn mức — DỪNG.")
                break
        except Exception as e:
            loi.append((q, type(e).__name__))
            print(f"   {q[:44]:46s} LỖI {type(e).__name__}")
        time.sleep(0.3)
    print()

# ── Loc theo nguong va xuat ─────────────────────────────────────────────────
out = []
for n, vids in nhac.items():
    if len(vids) < MIN_VIDEO:
        continue
    r = biz[n]
    if fold(r["name"]) in DONG:
        continue
    out.append({
        "ten": r["name"], "hang_muc": r.get("category"),
        "dia_chi": r.get("address"), "dien_thoai": (r.get("phones") or [None])[0],
        "lat": r["lat"], "lon": r["lon"],
        "so_video_nhac": len(vids),
        "the_phong_cach": sorted(the_cua[n]),
        "truy_van": sorted(tu_truy_van[n]),
    })
out.sort(key=lambda x: -x["so_video_nhac"])

# ── MOT LAN CHAY DO KHONG DUOC GHI DE MOT LAN CHAY DU ──────────────────────
# Loi that da xay ra: lan chay dau thu 72 quan. Lan sau het han muc o truy van
# thu ba, chi thu 2 quan, VA GHI DE — 72 dong bien thanh 2. Han muc "Search
# Queries" la gioi han THEO NGAY, nen mot lan chay dut giua duong la binh
# thuong, khong phai ngoai le.
#
# Cung ho voi luat da ghi trong so: "bo loc quyet dinh GIU gi, khong bao gio
# quyet dinh LUU gi". O day: mot ket qua NGHEO HON khong duoc thay ket qua giau
# hon chi vi no moi hon.
cu = []
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8"))
    except Exception:
        cu = []

if loi and len(out) < len(cu):
    bak = OUT.replace(".json", f".dorang-{len(out)}quan.json")
    json.dump(out, io.open(bak, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"⚠ Lần chạy này DỞ ({len(loi)} truy vấn lỗi) và chỉ thu {len(out)} quán, ít hơn")
    print(f"  {len(cu)} quán đã có. KHÔNG ghi đè. Kết quả dở lưu riêng ở:")
    print(f"  {bak}")
    print(f"  Chạy lại đủ khi hạn mức ngày được cấp lại.")
    out = cu
else:
    json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

duoi_nguong = sum(1 for v in nhac.values() if len(v) < MIN_VIDEO)
print("═" * 62)
print(f"{len(out)} quán đạt ngưỡng ≥{MIN_VIDEO} video · "
      f"{duoi_nguong} quán chỉ 1 video (đã loại, KHÔNG hạ ngưỡng để lấp)")
print(f"đơn vị hạn mức đã dùng: {don_vi_dung:,}/10.000".replace(",", "."))
if loi:
    print(f"lỗi: {len(loi)} truy vấn — {loi[:3]}")
print()
print(f"{'Quán':40s}{'Video':>6s}  Thẻ phong cách")
for r in out[:30]:
    print(f"{r['ten'][:38]:40s}{r['so_video_nhac']:6d}  "
          + (", ".join(r["the_phong_cach"]) or "—"))

pc = [r for r in out if r["the_phong_cach"]]
print(f"\n{len(pc)} quán có thẻ phong cách:")
for t, c in Counter(t for r in out for t in r["the_phong_cach"]).most_common():
    print(f"   {c:3d}  {t}")
print(f"\nsaved -> {OUT}")
print("raw/ chỉ chứa tên cơ sở, số video, thẻ — không tên kênh, tiêu đề, mô tả, ID video.")
