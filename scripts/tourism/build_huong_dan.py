# -*- coding: utf-8 -*-
"""Sinh 'huong-dan-diem-den.md' — ho so sau cho ~36 diem Da Lat.

Ba nguyen tac, deu la thuoc tinh CO HOC cua tai lieu, khong phai loi dan:
  1. O trong khong bao gio xuat hien. Truong khong co du lieu ghi [CHƯA XÁC MINH].
  2. Ba muc tin cay: [ĐÃ XÁC MINH: nguon · ngay] / / [CHƯA XÁC MINH].
  3. Do cu tinh luc BUILD, in ra ket luan (MOI/CU DAN/QUA CU), khong in ngay
     roi mong nguoi doc tu tru ngay.
Suy dien chi duoc phep o 3 cho da duyet truoc: trong nha/ngoai troi tu loai hinh,
link ban do tu toa do, diem lan can tu ma tran OSRM. Ngoai ra -> [CHƯA XÁC MINH].
"""
import json, os, sys, io, time, math, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hoat_dong_data as _hoat_dong   # mot nguon chon loc, hai nguon dinh dang
import an_ngu_data as _an_ngu

RAW, OUT = sys.argv[1], sys.argv[2]
TRIP_OUT = sys.argv[3] if len(sys.argv) > 3 else None
BUILD_DATE = "28/07/2026"
UNV = "[CHƯA XÁC MINH]"


def load(fn, default=None):
    for p in (os.path.join(RAW, fn), os.path.join(os.path.dirname(RAW.rstrip("/\\")), fn)):
        if os.path.exists(p):
            return json.load(io.open(p, encoding="utf-8"))
    return default


def fold(s):
    import unicodedata
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())



# Tai lieu chi danh cho nguoi doc tieng Viet. Ten dia diem trong nguon co the
# kem chu Han/Hangul/Kana/Kirin (vd "Thiên Vương Cổ Sát Chùa Tàu - 大叻市 天王古剎").
# Do la du lieu that, nhung khong danh cho doc gia nay.
_FOREIGN = __import__("re").compile(r"[가-힯一-鿿぀-ヿЀ-ӿ]+")


def vn_only(s):
    """Bo chu ngoai (Han, Hangul, Kana, Kirin). Giu tieng Viet va chu Latin."""
    s = _FOREIGN.sub("", str(s or ""))
    s = __import__("re").sub(r"\s{2,}", " ", s)
    return s.strip(" ,-·/")

_LAN_CAN = _an_ngu.tai_lan_can(RAW)

rows = [r for r in load("merged_dalat.json", []) if r["nhom"] == "chinh"]
csdl = load("csdl_parsed.json", [])

# ---------------------------------------------------------------- lua chon
# Diem so chi dung truong ta THUC SU co. Danh sach chot tay ghi de diem so,
# vi xep hang theo so nguon co thien lech he thong: noi noi tieng nhung it
# nguoi map se bi loai, con doanh nghiep duoc map ky lai duoc day len.
ALLOWLIST = [
    "ho xuan huong", "thung lung tinh yeu", "lang biang", "langbiang",
    "thien vien truc lam", "ho tuyen lam", "ga da lat", "crazy house",
    "biet thu hang nga", "dinh bao dai", "dinh iii", "dinh ii",
    "cho da lat", "thac datanla", "thac prenn", "thac voi", "thac cam ly",
    "doi che cau dat", "chua linh phuoc", "chua linh son", "nha tho con ga",
    "chinh toa da lat", "domaine de marie", "quang truong lam vien",
    "vuon hoa thanh pho", "ho than tho", "doi mong mo", "lang cu lan",
    "bao tang lam dong", "thung lung vang", "duong ham dat set", "xq su quan",
    "thien vuong co sat", "ho da thien",
]
MAX_ALLOW = 24  # danh sach chot tay khop long -> chan tran, phan con lai theo diem
CAT_TIER = {
    "Thác nước": 1.0, "Hồ / Đập": 1.0, "Chùa / Thiền viện": 1.0, "Nhà thờ": 1.0,
    "Bảo tàng": 1.0, "Dinh thự / Di tích": 1.0, "Công viên / Vườn hoa": 1.0,
    "Điểm ngắm cảnh": 1.0, "Khu vui chơi": 1.0, "Cáp treo": 1.0,
    "Nông trại / Vườn": 0.8, "Chợ / Mua sắm": 0.8, "Nghệ thuật / Triển lãm": 0.6,
    "Núi / Đèo / Đường mòn": 0.6, "Ăn uống": 0.2, "Lưu trú": 0.1, "Khác": 0.1,
}
EXCLUDE_CAT = {"Lưu trú", "Ăn uống"}
TARGET, PER_AREA_FLOOR = 36, 2


def score(r):
    s = 0.35 * (len(r["src"]) - 1) / 3.0
    s += 0.20 * (r.get("conf") if r.get("conf") is not None else 0.5)
    s += 0.15 * sum(bool(r.get(k)) for k in ("tel", "web", "addr")) / 3.0
    s += 0.15 * CAT_TIER.get(r["loai_vn"], 0.1)
    return s


for r in rows:
    f = fold(r["name"])
    r["_allow"] = any(a in f for a in ALLOWLIST)
    r["_score"] = score(r) + (1.0 if r["_allow"] else 0.0)

alive = [r for r in rows if not r.get("closed")]

# ------------------------------------------------ hop nhat vong hai
# Vong mot (150 m + ten long nhau) uu tien CHINH XAC nen hop nhat thieu.
# Vo hai o kho 1.361 dong, nhung o danh sach chon 36 thi lo ro: Datanla,
# Prenn, Thac Voi... moi cai hai dong. Vong hai chuan hoa ten manh tay hon
# va noi rong ban kinh, vi o day hop nhat sot ton kem hon hop nhat nham.
GENERIC = ("khu du lich", "kdl", "du lich", "thanh pho", "tp", "da lat", "dalat",
           "lam dong", "waterfall", "museum", "tea plantation", "viet nam")
# Cung mot cong trinh, hai ten khong he giong nhau -> chi bang tay moi biet.
ALIAS = [("nha tho con ga", "nha tho chinh toa da lat"),
         ("ho than tho", "lake of sighs"),
         ("chua tau", "thien vuong co sat"),
         ("crazy house", "biet thu hang nga"),
         ("ga da lat", "dalat railway station"),
         ("chua linh phuoc", "linh phuoc pagoda")]


def norm(name):
    s = fold(name)
    for ch in ",.;:/&+":
        s = s.replace(ch, " ")
    s = s.split(" - ")[0]                       # bo duoi " - Da Lat", " - Lam Dong"
    s = s.split("(")[0]
    for g in GENERIC:
        cut = " ".join(s.replace(g, " ").split())
        # Chi cat neu con lai du dai de con phan biet duoc. Cat "lam dong" khoi
        # "bao tang lam dong" se con moi chu "bao tang" — khop voi MOI bao tang.
        if len(cut) >= 10:
            s = cut
    return " ".join(s.split())


# Tu chung loai ("chua", "thac", "ho"...) khong phan biet duoc dia diem nay voi
# dia diem kia — "Chua Linh Son" va "Chua Linh Phuoc" deu co "chua". Bo chung ra
# truoc khi dem tu trung nhau, neu khong moi ngoi chua deu giong moi ngoi chua.
HEAD_WORDS = {"chua", "nha", "tho", "thac", "ho", "dinh", "khu", "du", "lich",
              "vuon", "hoa", "bao", "tang", "quan", "nui", "doi", "suoi", "lang",
              "cho", "ga", "cap", "treo", "diem", "thanh", "pagoda", "church",
              "lake", "waterfall", "mountain", "hill", "valley", "garden",
              "museum", "market", "temple", "tourist", "area", "city"}


# Danh sach tu chung viet tay luon bo sot. "lam", "dong", "vien", "lat" co mat
# khap noi trong dia danh Da Lat, va chinh chung da gay hai vu hop nhat nham:
# Thien Vien Truc LAM nuot Quang truong LAM VIEN, Bao tang LAM DONG nuot Vuon Lan
# LAM DONG. Nen dem tan suat tren toan bo 1.361 ten roi bo tu nao qua pho bien —
# du lieu tu chi ra tu nao khong phan biet duoc gi.
_df = Counter()
for _r in rows:
    _df.update(set(norm(_r["name"]).split()))
_DF_MAX = max(12, int(0.01 * len(rows)))
STOPWORDS = HEAD_WORDS | {t for t, c in _df.items() if c > _DF_MAX}


def keywords(n):
    return {t for t in n.split() if len(t) >= 3 and t not in STOPWORDS}


def same_place(a, b):
    na, nb = norm(a["name"]), norm(b["name"])
    if not na or not nb:
        return False
    fa, fb = fold(a["name"]), fold(b["name"])
    # 1. Cung mot cong trinh, hai ten khong lien quan — chi bang tay moi biet.
    for x, y in ALIAS:
        if (x in fa and y in fb) or (y in fa and x in fb):
            return True
    d = hav(a, b)
    # 2. Trung ten y het. Toa do lech nhau la binh thuong: moi nguon lay tam mot
    #    da giac khac nhau, ho Tuyen Lam rong 3 km. Ten cang dac trung cang tin duoc.
    if na == nb:
        return True if len(na) >= 12 else d <= 5000
    if d > 5000:                                # ngoai 5 km thi thoi, do lon hon ca do thi
        return False
    # 3. Ten nay nam trong ten kia: "Ho Tuyen Lam" trong "Suoi Tia Ho Tuyen Lam".
    if len(na) > 6 and (na in nb or nb in na):
        return True
    # 4. Trung tu khoa rieng: "chua linh phuoc" vs "linh phuoc pagoda" -> {linh, phuoc}.
    #    Day la quy tac yeu nhat nen siet ban kinh xuong 2 km.
    if d > 2000:
        return False
    ka, kb = keywords(na), keywords(nb)
    return len(ka & kb) >= 2


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


for r in alive:
    r["_score"] = score(r) + (1.0 if r["_allow"] else 0.0)
# Chia o luoi ~2,2 km de khoi so sanh 1.361x1.361. KHONG chia theo khu vuc:
# khu vuc suy ra tu diem moc gan nhat, nen hai diem cach nhau 500 m van co the
# roi vao hai khu khac nhau — do chinh la ly do vong truoc bo sot Hồ Tuyền Lâm.
CELL = 0.02
grid = defaultdict(list)


def cells_around(r):
    ci, cj = int(r["lat"] / CELL), int(r["lon"] / CELL)
    return [(ci + a, cj + b) for a in (-1, 0, 1) for b in (-1, 0, 1)]


merged2, n_m2 = [], 0
byname = {}          # ten chuan hoa -> ban ghi dai dien, cho cap trung ten ma xa nhau
byalias = {}         # nhom bi danh -> dai dien; alias khong bi chan boi o luoi


def alias_key(r):
    f = fold(r["name"])
    for i, (x, y) in enumerate(ALIAS):
        if x in f or y in f:
            return i
    return None
for r in sorted(alive, key=lambda x: -x["_score"]):
    hit = byname.get(norm(r["name"]))
    if hit is not None and not same_place(hit, r):
        hit = None
    ak = alias_key(r)
    if hit is None and ak is not None:
        cand = byalias.get(ak)
        if cand is not None and same_place(cand, r):
            hit = cand
    if hit is None:
        for c in cells_around(r):
            hit = next((m for m in grid[c] if same_place(m, r)), None)
            if hit:
                break
    if not hit:
        merged2.append(r)
        ci, cj = int(r["lat"] / CELL), int(r["lon"] / CELL)
        grid[(ci, cj)].append(r)
        byname.setdefault(norm(r["name"]), r)
        if ak is not None:
            byalias.setdefault(ak, r)
        continue
    n_m2 += 1
    hit["src"] = sorted(set(hit["src"]) | set(r["src"]))
    for k in ("tel", "web", "addr", "hours", "fee"):
        if not hit.get(k) and r.get(k):
            hit[k] = r[k]
    if r.get("conf") is not None and (hit.get("conf") or 0) < r["conf"]:
        hit["conf"] = r["conf"]
    if fold(r["name"]) != fold(hit["name"]):
        hit.setdefault("alt", [])
        if r["name"] not in hit["alt"]:
            hit["alt"].append(r["name"])
print(f"hop nhat vong hai: {n_m2} dong gop lai  ->  {len(merged2)} con lai")
alive = merged2
for r in alive:
    r["_score"] = score(r) + (1.0 if r["_allow"] else 0.0)

picked, seen = [], set()
for r in sorted(alive, key=lambda x: -x["_score"]):          # 1. danh sach chot tay
    if len(picked) >= MAX_ALLOW:
        break
    if r["_allow"] and r["loai_vn"] not in EXCLUDE_CAT and fold(r["name"]) not in seen:
        picked.append(r)
        seen.add(fold(r["name"]))
by_area = defaultdict(list)
for r in sorted(alive, key=lambda x: -x["_score"]):
    by_area[r["area"]].append(r)
for area, lst in by_area.items():                            # 2. san moi khu vuc
    have = sum(1 for p in picked if p["area"] == area)
    for r in lst:
        if have >= PER_AREA_FLOOR:
            break
        if r["loai_vn"] in EXCLUDE_CAT or fold(r["name"]) in seen:
            continue
        picked.append(r)
        seen.add(fold(r["name"]))
        have += 1
for r in sorted(alive, key=lambda x: -x["_score"]):          # 3. lap day theo diem
    if len(picked) >= TARGET:
        break
    if r["loai_vn"] in EXCLUDE_CAT or fold(r["name"]) in seen:
        continue
    picked.append(r)
    seen.add(fold(r["name"]))
picked.sort(key=lambda r: (r["area"], r.get("min") or 999))
for i, r in enumerate(picked, 1):
    r["id"] = f"DL-{i:02d}"
print(f"chon {len(picked)} diem  |  chot tay {sum(1 for r in picked if r['_allow'])}")

# ------------------------------------------------- ma tran OSRM giua cac diem
CACHE = os.path.join(RAW, "osrm_selected.json")
mat = None
if os.path.exists(CACHE):
    c = json.load(io.open(CACHE, encoding="utf-8"))
    if c.get("ids") == [r["id"] for r in picked]:
        mat = c
if mat is None:
    path = ";".join(f"{r['lon']:.6f},{r['lat']:.6f}" for r in picked)
    url = f"https://router.project-osrm.org/table/v1/driving/{path}?annotations=duration,distance"
    print("goi OSRM ma tran giua cac diem ...", flush=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BusBooking-KB/0.1"})
        with urllib.request.urlopen(req, timeout=180) as resp:
            d = json.load(resp)
        if d.get("code") == "Ok":
            mat = {"ids": [r["id"] for r in picked],
                   "durations": d["durations"], "distances": d["distances"]}
            json.dump(mat, io.open(CACHE, "w", encoding="utf-8"))
            print(f"  ma tran {len(mat['durations'])}x{len(mat['durations'][0])}")
        else:
            print("  OSRM tra ve", d.get("code"))
    except Exception as e:
        print(f"  OSRM loi: {type(e).__name__} {e}")

NEAR = defaultdict(list)
if mat:
    T, D = mat["durations"], mat["distances"]
    for i, r in enumerate(picked):
        cand = [(T[i][j], D[i][j], picked[j]) for j in range(len(picked))
                if j != i and T[i][j] is not None]
        for t, dist, o2 in sorted(cand, key=lambda x: x[0])[:3]:
            NEAR[r["id"]].append((o2, dist / 1000.0, t / 60.0))

# ------------------------------------------------------------- suy dien duyet
INDOOR = {
    "Bảo tàng": ("trong nhà", "bảo tàng là không gian trong nhà"),
    "Nghệ thuật / Triển lãm": ("trong nhà", "phòng trưng bày là không gian trong nhà"),
    "Chợ / Mua sắm": ("có mái", "chợ Việt Nam phần lớn có mái che"),
    "Nhà thờ": ("có mái", "gian lễ có mái, sân ngoài trời"),
    "Chùa / Thiền viện": ("hỗn hợp", "chính điện có mái, sân vườn ngoài trời"),
    "Dinh thự / Di tích": ("hỗn hợp", "nhà chính có mái, khuôn viên ngoài trời"),
    "Thác nước": ("ngoài trời", "thác nước là địa hình ngoài trời"),
    "Hồ / Đập": ("ngoài trời", "hồ là địa hình ngoài trời"),
    "Công viên / Vườn hoa": ("ngoài trời", "công viên là không gian ngoài trời"),
    "Điểm ngắm cảnh": ("ngoài trời", "điểm ngắm cảnh là không gian ngoài trời"),
    "Núi / Đèo / Đường mòn": ("ngoài trời", "địa hình núi là ngoài trời"),
    "Nông trại / Vườn": ("ngoài trời", "nông trại là không gian ngoài trời"),
    "Cáp treo": ("ngoài trời", "cáp treo vận hành ngoài trời"),
    "Khu vui chơi": ("hỗn hợp", "khu vui chơi thường có cả khu trong nhà và ngoài trời"),
}
csdl_by_name = {}
for c in csdl:
    if c.get("ten"):
        csdl_by_name.setdefault(fold(c["ten"]), c)

# Xuat du lieu da chon ra JSON de build_huong_dan_docx.py dung lai — mot lan chon,
# mot lan hop nhat, hai dinh dang dau ra. Khong lam lai logic o script thu hai.
json.dump({
    "build_date": BUILD_DATE,
    "picked": [{k: v for k, v in r.items() if not k.startswith("_")} for r in picked],
    "near": {k: [[o2["id"], round(dkm, 2), round(tmin, 1)] for o2, dkm, tmin in v]
             for k, v in NEAR.items()},
    "matrix": mat,
    "csdl_gia": {r["id"]: csdl_by_name.get(fold(r["name"]), {}).get("gia_min")
                 for r in picked},
}, io.open(os.path.join(RAW, "guide_data.json"), "w", encoding="utf-8"),
    ensure_ascii=False, indent=1)

# ---------- lop lam giau: cua DUY NHAT de mot truong roi khoi [CHƯA XÁC MINH] ----------
enr_rows = load("enrichment.json") or []
ENR = defaultdict(dict)
for _e in enr_rows:
    ENR[_e["id"]].setdefault(_e["field"], _e)
UNV = "[CHƯA XÁC MINH]"


def ev(pid, field, tail=""):
    """Tra ve gia tri tran, khong kem dau dan nguon.

    Nguon/URL/ngay VAN duoc luu day du trong raw/enrichment.json — chi phan HIEN
    THI bo di. Muon in lai dau dan nguon thi sinh lai la co.
    """
    e = ENR.get(pid, {}).get(field)
    if not e:
        return UNV + tail
    return str(e["value"])


def has(pid, field):
    return field in ENR.get(pid, {})


n_enriched = sum(len(v) for v in ENR.values())
print(f"  lam giau: {len(enr_rows)} dong, {len(ENR)} diem")

# Chi giu truong DA XAC MINH. Gom dong vao bo dem roi loc truoc khi ghi ra file,
# vi cac dong truong nam rai rac trong hang chuc lenh w() khac nhau.
_buf = []
def w(s):
    _buf.append(s)

# ============================================================ 0. quy tac doc
w("# HƯỚNG DẪN ĐIỂM ĐẾN ĐÀ LẠT\n\n")
w(f"> Hồ sơ chi tiết **{len(picked)} điểm đến** · sinh tự động ngày {BUILD_DATE} · "
  "nguồn: OpenStreetMap · Overture Maps · Foursquare OS · Wikidata · OSRM · "
  "đăng ký lưu trú Cục Du lịch Quốc gia\n\n")

w("## 0. QUY TẮC ĐỌC — BẮT BUỘC ĐỌC TRƯỚC\n\n")
w("Tài liệu này được viết để **một tác nhân AI đọc và tư vấn cho khách trả tiền**. "
  "Phần lớn các trường CHƯA có dữ liệu xác minh. Ba quy tắc dưới đây là bắt buộc.\n\n")
w("| Dấu | Nghĩa | Được phép nói gì |\n|---|---|---|\n")
w("| `` | Suy ra từ loại hình, chưa ai kiểm chứng | **Phải rào**: “có thể”, “thường là” |\n")
w("| `[CHƯA XÁC MINH]` | Chưa biết | **KHÔNG được nêu giá trị.** Nói rõ là chưa có, đề nghị khách gọi xác minh |\n\n")
w("⚠ **Tài liệu này CHỈ liệt kê những trường ĐÃ XÁC MINH.** Một trường **không xuất hiện** "
  "trong hồ sơ nghĩa là **CHƯA BIẾT**, không phải là “không có”. Tuyệt đối không suy đoán "
  "giá trị cho trường vắng mặt — hãy nói với khách là chưa có số liệu và cần gọi xác minh.\n\n")
w("**Ba điều tuyệt đối không được làm:**\n\n")
w("1. **KHÔNG** thay `[CHƯA XÁC MINH]` bằng một giá trị thường gặp. “Giờ mở cửa 08:00–17:00” "
  "là hình dạng của một giờ mở cửa, không phải giờ mở cửa của nơi này.\n")
w("2. **KHÔNG** suy ra giá vé, giờ mở cửa, thời lượng thăm hay mức độ dễ đi lại từ loại hình. "
  "Chỉ ba suy diễn được duyệt trước: *trong nhà/ngoài trời*, *link bản đồ*, *điểm lân cận*.\n")
w("3. **KHÔNG** viết mô tả, “lý do nên đến” hay “điểm nhấn” cho một địa điểm — "
  "tài liệu này cố ý **không sinh** những mục đó, vì mọi chữ trong đó sẽ là bịa. "
  "Mục 3 liệt kê hoạt động kèm nơi và đơn vị cụ thể, đó là dữ kiện; “Đà Lạt lãng "
  "mạn, hợp cho các cặp đôi” thì không.\n\n")
w("**Nhịp độ mặc định (chuyến “thư giãn”):** tối đa 4 điểm/ngày · tối đa 2 giờ di chuyển/ngày · "
  "mỗi ngày chừa một khoảng trống. Vượt quá phải nói rõ với khách là lịch dày.\n\n")
w("**Bay flycam:** mặc định **coi như bị cấm** trừ khi có xác nhận ngược lại. "
  "Sai theo hướng an toàn thì mất một tấm ảnh; sai theo hướng kia thì khách bị phạt.\n\n")

# ============================================================ 1. tong quan
w("---\n\n## 1. Tổng quan điểm đến\n\n")
w("| Mục | Giá trị |\n|---|---|\n")
w("| Thành phố | Đà Lạt, tỉnh Lâm Đồng |\n")
w("| Độ cao | ~1.500 m so với mực nước biển |\n")
w(f"| Số điểm trong hồ sơ này | {len(picked)} |\n")
w("| Kho dữ liệu đầy đủ | `diem-tham-quan.md` — 1.361 điểm, tra khi cần điểm ngoài danh sách |\n")
w("| Thời tiết theo tháng | " + UNV + " — chưa lấy dữ liệu khí hậu |\n")
w("| Lịch lễ hội | " + UNV + " |\n")
w("| Ảnh hưởng Tết | " + UNV + " — cần xác minh, nhiều nơi đóng cửa và giá tăng mạnh |\n")
w("| Đi lại tới Đà Lạt | " + UNV + " — chưa thu thập tuyến xe/máy bay |\n")
w("| Phương tiện tại chỗ | " + UNV + " — chưa thu thập giá thuê xe/taxi |\n\n")
w("⚠ Năm hàng cuối là **khoảng trống có thật, không phải lỗi hiển thị**. Một lịch trình "
  "không biết khách tới bằng gì và đi lại bằng gì thì chưa phải một lịch trình.\n\n")

# ============================================================ 2. ho so diem
w("---\n\n## 2. DANH SÁCH ĐIỂM ĐẾN\n\n")
w("Thứ tự các mục trong mỗi hồ sơ là **cổng lọc trước, mô tả sau**: nhận dạng → khả năng "
  "tiếp cận → kế hoạch thăm → giờ giấc. Một ràng buộc về đi lại loại bỏ địa điểm trước khi "
  "chi tiết chụp ảnh có ý nghĩa gì.\n\n")

cur_area = None
for r in picked:
    if r["area"] != cur_area:
        cur_area = r["area"]
        w(f"\n### ▌KHU VỰC: {cur_area}\n\n")
    cs = csdl_by_name.get(fold(r["name"]))
    srcs = "+".join(r["src"])
    w(f"\n#### {r['id']} · {r['name']}\n\n")
    w("> *Chỉ nêu những trường KHÔNG mang dấu `[CHƯA XÁC MINH]`. Trường mang dấu đó: "
      "nói với khách là chưa xác minh được.*\n\n")

    w("**A.1 — Nhận dạng**\n\n")
    w("```\n")
    w(f"Tên                 : {r['name']}\n")
    alt = ", ".join(vn_only(x) for x in (r.get("alt") or []) if vn_only(x)) or UNV
    w(f"Tên khác            : {alt}\n")
    w(f"Loại hình           : {r['loai_vn']}"
      + (f"  (phụ: {', '.join(r['loai_phu'])})" if r.get("loai_phu") else "")
      + "\n")
    w(f"Địa chỉ             : {ev(r['id'], 'dia_chi_day_du')}\n")
    if has(r["id"], "email"):
        w(f"Email               : {ev(r['id'], 'email')}\n")
    if has(r["id"], "anh"):
        w(f"Ảnh (tự do bản quyền): {ev(r['id'], 'anh')}\n")
    if has(r["id"], "canh_bao_website"):
        w(f"⚠ Website đã lưu    : {ev(r['id'], 'canh_bao_website')}\n")
    if has(r["id"], "website_chinh_thuc"):
        w(f"Website chính thức  : {ev(r['id'], 'website_chinh_thuc')}\n")
    if has(r["id"], "kiem_tra_website"):
        w(f"Kiểm tra trang web  : {ev(r['id'], 'kiem_tra_website')}\n")
    w(f"Điện thoại          : {r.get('tel') or UNV}"
      + "\n")
    w(f"Website             : {r.get('web') or UNV}\n")
    if has(r["id"], "trang_facebook"):
        w(f"Trang Facebook      : {ev(r['id'], 'trang_facebook')}\n")
    if has(r["id"], "email_facebook"):
        w(f"Email (Facebook)    : {ev(r['id'], 'email_facebook')}\n")
    w(f"Tình trạng hoạt động: {'đang hoạt động' if not r.get('closed') else 'ĐÃ ĐÓNG ' + r['closed']}"
      "\n")
    # Muc do pho bien. KHONG phai diem sao — thang khac, nen de rieng va noi ro.
    # "Danh gia cua khach" van la CHUA XAC MINH; Google va TripAdvisor deu cam
    # luu diem so, va ti le de xuat cua Facebook khong quy doi sang sao duoc.
    if has(r["id"], "luot_checkin"):
        w(f"Lượt check-in       : {ev(r['id'], 'luot_checkin')}\n")
    if has(r["id"], "nguoi_theo_doi"):
        w(f"Người theo dõi FB   : {ev(r['id'], 'nguoi_theo_doi')}\n")
    if has(r["id"], "ty_le_gioi_thieu"):
        w(f"Tỉ lệ đề xuất (FB)  : {ev(r['id'], 'ty_le_gioi_thieu')}\n")
    w("```\n\n")

    w("**A.11 — Tiện nghi tại chỗ** · *cổng lọc đầu tiên: đây là mục loại bỏ địa điểm "
      "cho khách đi lại khó khăn*\n\n")
    w("```\n")
    FAC = [("Nhà vệ sinh", "nha_ve_sinh"), ("Bãi đỗ xe", "bai_do_xe"),
           ("Chỗ ngồi nghỉ", "cho_ngoi"), ("Hàng ăn", None), ("Hàng nước", "nuoc_uong"),
           ("Quà lưu niệm", "qua_luu_niem"), ("Hướng dẫn viên", None),
           ("Quầy thông tin", "quay_thong_tin"), ("Lối cho xe lăn", "loi_xe_lan"),
           ("Sơ cứu y tế", "so_cuu"), ("Wifi", "wifi")]
    n_fac = 0
    for lab, key in FAC:
        if key and has(r["id"], key):
            n_fac += 1
            w(f"{lab:<20}: {ev(r['id'], key)}\n")
        elif lab != "Wifi":            # Wifi khong thuoc mau goc — chi hien khi biet
            w(f"{lab:<20}: {UNV}\n")
    w("```\n")

    w("**A.9 — Kế hoạch thăm**\n\n")
    w("```\n")
    w(f"Thời lượng thăm     : {UNV}   ← không có mục này thì không xếp được lịch một ngày\n")
    w(f"Thời điểm tốt/ngày  : {UNV}\n")
    w(f"Mùa tốt nhất        : {UNV}\n")
    ind = INDOOR.get(r["loai_vn"])
    w(f"Trong nhà/ngoài trời: {ind[0]}\n" if ind
      else f"Trong nhà/ngoài trời: {UNV}\n")
    w(f"Quãng đi bộ         : {UNV}\n")
    w(f"Độ khó              : {UNV}\n")
    w(f"Phù hợp trẻ nhỏ     : {UNV}\n")
    w(f"Phù hợp cao tuổi    : {UNV}\n")
    w("```\n\n")

    w("**A.3 — Giờ giấc và chi phí**\n\n")
    w("```\n")
    hrs = r.get("hours")
    w(f"Ngày mở cửa         : {UNV}\n")
    if hrs:
        w(f"Giờ mở cửa          : {hrs}\n")
    else:
        w("Giờ mở cửa          : "
          + ev(r["id"], "gio_mo_cua", "   ← KHÔNG nêu giờ cụ thể; đề nghị khách gọi trước") + "\n")
    w(f"Giờ nhận khách cuối : {UNV}\n")
    fee = r.get("fee")
    w(f"Giá vé              : {fee}\n" if fee
      else f"Giá vé              : {UNV}   ← KHÔNG nêu số tiền; nói giá có thể thay đổi\n")
    if has(r["id"], "gia_ve_tham_khao"):
        w(f"Giá vé THAM KHẢO    : {ev(r['id'], 'gia_ve_tham_khao')}\n")
    if has(r["id"], "khoang_gia_facebook"):
        w(f"Khoảng giá (Facebook): {ev(r['id'], 'khoang_gia_facebook')}"
          "   ← thang 4 bậc, chủ cơ sở tự khai\n")
    w(f"Phí gửi xe          : {UNV}\n")
    w(f"Cần đặt trước       : {ev(r['id'], 'can_dat_truoc')}\n")
    if cs and cs.get("gia_min"):
        g = f"{cs['gia_min']:,}".replace(",", ".")
        if cs.get("gia_max") and cs["gia_max"] != cs["gia_min"]:
            g += "–" + f"{cs['gia_max']:,}".replace(",", ".")
        w(f"Giá phòng (lưu trú) : {g}₫/đêm\n")
    w("```\n\n")

    w("**A.12 — Lưu ý quan trọng**\n\n")
    w("```\n")
    for f_ in ("Trang phục", "Giày dép", "Lưu ý thời tiết", "An toàn",
               "Giờ đông khách", "Nên mang theo", "Điều cấm"):
        w(f"{f_:<20}: {UNV}\n")
    w("```\n\n")

    w("**A.4 — Vị trí và di chuyển**\n\n")
    w("```\n")
    if r.get("min") is not None:
        w(f"Từ hồ Xuân Hương    : {r['km']:.1f} km · {r['min']:.0f} phút   "
          "\n")
    else:
        w(f"Từ hồ Xuân Hương    : {UNV}\n")
    w(f"Từ khách sạn         : → thuộc hồ sơ chuyến đi, tính khi biết khách ở đâu\n")
    w(f"Đường chính gần nhất : {ev(r['id'], 'duong_gan_nhat')}\n")
    w(f"Tình trạng đường     : {UNV}\n")
    w(f"Phương tiện tới được : {UNV}\n")
    w(f"Bãi đỗ xe            : {UNV}\n")
    w("```\n\n")

    for lab, key in (("Năm khánh thành", "nam_khanh_thanh"), ("Năm xây dựng", "nam_xay_dung"),
                     ("Kiến trúc", "kien_truc"), ("Kiến trúc sư", "kien_truc_su"),
                     ("Xếp hạng di tích", "xep_hang_di_tich"), ("Tôn giáo", "ton_giao"),
                     ("Diện tích", "dien_tich")):
        if has(r["id"], key):
            w(f"- **{lab}:** {ev(r['id'], key)}\n")
    if any(has(r["id"], k) for k in ("nam_khanh_thanh", "nam_xay_dung", "kien_truc",
                                     "kien_truc_su", "xep_hang_di_tich", "ton_giao", "dien_tich")):
        w("\n")

    w("**A.10 — Chụp ảnh**\n\n")
    w("```\n")
    for f_ in ("Điểm chụp đẹp", "Giờ chụp đẹp", "Ngắm bình minh/hoàng hôn",
               "Phí chụp ảnh", "Lưu ý chụp ảnh"):
        w(f"{f_:<20}: {UNV}\n")
    w("Bay flycam          : COI NHƯ BỊ CẤM cho tới khi có xác nhận ngược lại\n")
    w("```\n\n")

    w("**A.13 — Điểm lân cận** *(thời gian đường bộ thật, không phải đường chim bay)*\n\n")
    if NEAR.get(r["id"]):
        w("| # | Điểm | Loại | Km | Phút |\n|---|---|---|---:|---:|\n")
        for k, (o2, dkm, tmin) in enumerate(NEAR[r["id"]], 1):
            w(f"| {k} | {o2['id']} · {o2['name']} | {o2['loai_vn']} | {dkm:.1f} | {tmin:.0f} |\n")
        w("\n")
    else:
        w(f"{UNV} — chưa có ma trận thời gian.\n\n")

    # ── Khach san & quan an GAN diem nay ────────────────────────────────────
    # Khung founder dua ra doi 3 bac gia x 3 khach san va 3 bac gia x 3 quan.
    # Ba diem thay doi, moi diem co ly do do duoc:
    #   1. SO LUONG BIEN, khong phai 3 co dinh — chi 24/36 diem lap du 3 bac, va
    #      9 diem khong co co so luu tru dang ky nao trong 5 km.
    #   2. Quan an nhom theo LOAI MON, khong theo bac gia — 0/5.559 quan co gia,
    #      va mot tieu de bac gia tu no la mot khang dinh du kien.
    #   3. Khong in `Đánh giá` va `Tiện nghi` — 0 du lieu, va rao can la giay
    #      phep luu tru. Da noi mot lan o muc 0.
    _lc = _LAN_CAN.get(r["id"], {})
    if _lc.get("bac_khach_san"):
        w(f"**A.14 — Khách sạn gần** *(trong 5 km · {_lc['tong_ks_trong_bk']} cơ sở "
          "có giá công bố · danh sách đầy đủ ở mục 4)*\n\n")
        for _b in _lc["bac_khach_san"]:
            # In ca vung TOAN THANH PHO: bac cao cap chi co 7 co so co toa do
            # tren toan Da Lat, nen cung mot ten lap lai o nhieu diem den la BAT
            # BUOC ve mat so hoc. Noi con so ra thi nguoi doc hieu ngay.
            w(f"*{_b['ten']}* — {_b['tong']} trong bán kính, "
              f"{_b['tong_thanh_pho']} toàn Đà Lạt\n\n")
            for _h in _b["khach_san"]:
                w(f"- **{_h['ten']}** — {_h['gia']}/đêm · cách {_h['khoang_cach']}"
                  + (f" · {_h['so_phong']} phòng" if _h["so_phong"] else "")
                  + (f" · {_h['dien_thoai']}" if _h["dien_thoai"] else "")
                  + (f" · {_h['dia_chi']}" if _h["dia_chi"] else "")
                  + (" · thẩm định nhà nước" if _h["tham_dinh"] == "nhà nước" else "")
                  + "\n")
            w("\n")
    elif _lc.get("khong_co_khach_san"):
        # Noi ra khoang trong, khong in khoi rong.
        w(f"**A.14 — Khách sạn gần**\n\n{_lc['khong_co_khach_san']} "
          "Xem mục 4 để chọn theo bậc giá.\n\n")

    if _lc.get("loai_quan"):
        w(f"**A.15 — Quán ăn gần** *(trong 2 km · {_lc['tong_quan_trong_bk']} quán "
          "còn hoạt động)*\n\n")
        for _l in _lc["loai_quan"]:
            w(f"*{_l['ten']}* — {_l['tong']} quán\n\n")
            for _q in _l["quan"]:
                w(f"- **{_q['ten']}** — cách {_q['khoang_cach']}"
                  + (f" · {_q['dien_thoai']}" if _q["dien_thoai"] else "")
                  + (f" · {_q['dia_chi']}" if _q["dia_chi"] else "")
                  + (f" · {', '.join(_q['mon'])}" if _q["mon"] else "")
                  + "\n")
            w("\n")

    w(f"**Kiểm chứng:** CHƯA GỌI · gọi số {r.get('tel') or 'CHƯA CÓ SỐ'} để đóng "
      "giờ mở cửa, giá vé, thời lượng thăm và điều kiện đi lại.\n\n")
    w("---\n")

# =============================================== 3. HOAT DONG
# Muc nay dat NGAY SAU danh sach diem den, truoc moi bang so sanh: nguoi len ke
# hoach 3-5 ngay nghi bang HOAT DONG ("sáng săn mây, trưa hái dâu"), khong nghi
# bang toa do. Bang so sanh la cong cu tra cuu, den sau.
_HD, _HDTK = _hoat_dong.tai(RAW)
_MON = _hoat_dong.tai_mon_an(RAW)

w("\n---\n\n## 3. HOẠT ĐỘNG — LÀM GÌ Ở ĐÀ LẠT\n\n")
w(f"*{_HDTK['so_hoat_dong']} hoạt động, {_HDTK['so_nhom']} nhóm. "
  "Mã `DL-xx` dẫn về mục chi tiết ở mục 2.*\n\n")

_nhom_hien = None
for _a in _HD:
    if _a["nhom"] != _nhom_hien:
        _nhom_hien = _a["nhom"]
        w(f"\n### Nhóm: {_nhom_hien.upper()}\n\n")
    w(f"#### {_a['ten']}\n\n")

    # Chi in thu nguoi doc DUNG. So lieu build ("in 8 tren 23"), dau vet kiem
    # chung ("da xac minh trang dung la cua don vi do") va ly do ky thuat cua bo
    # trich deu la van ke qua trinh — chung thuoc muc 12, khong thuoc day.
    if _a["noi"]:
        _dd = (f"**Làm ở đâu** ({_a['tong_noi']} nơi — {len(_a['noi'])} nơi tiêu biểu):"
               if _a["tong_noi"] > len(_a["noi"]) else "**Làm ở đâu:**")
        w(_dd + "\n\n")
        for _n in _a["noi"]:
            _ma = f"`{_n['ma']}` " if _n["ma"] else ""
            _kv = f" — {_n['khu_vuc']}" if _n.get("khu_vuc") else ""
            w(f"- {_ma}{_n['ten']}{_kv}\n")
        w("\n")
    if _a["don_vi"]:
        _dv = (f"**Đơn vị tổ chức** ({_a['tong_don_vi']} đơn vị — {len(_a['don_vi'])} "
               "đơn vị tiêu biểu):" if _a["tong_don_vi"] > len(_a["don_vi"])
               else "**Đơn vị tổ chức:**")
        w(_dv + "\n\n")
        for _d in _a["don_vi"]:
            w(f"- {_d['ten']}"
              + (f" — {_d['dien_thoai']}" if _d.get("dien_thoai") else " — chưa có số")
              + "\n")
        w("\n")
    if _a.get("tour_web"):
        w("**Trang tour:**\n\n")
        for _t in _a["tour_web"]:
            w(f"- {_t['ten']} — {_t['url']}\n")
            if _t["khoang_gia_don_vi"]:
                w(f"  - Khoảng giá cả gói: {_t['khoang_gia_don_vi']}\n")
            for _n in _t["ten_tour"]:
                w(f"  - {_n}\n")
        w("\n")
    if not _a["don_vi"]:
        w("*Không cần đơn vị tổ chức — tự đi được.*\n\n")

# Am thuc la mot NHOM HOAT DONG, khong phai chuong rieng.
#
# BA KHOI, khong phai mot bang phang. Xep tren toan bo theo so quan DAO NGUOC
# cau tra loi cho "an gi o Da Lat": dan dau se la Lẩu 172, Phở 89, Ốc 60 — mon
# co o moi thanh pho Viet Nam — con kem bo 7 va trung nuong 2 nam cuoi.
#
# `nhom` la PHAN DOAN BIEN TAP, khong phai so do. Noi ro dieu do trong tai lieu.
if _MON:
    _tong_q = sum(n for _, rows in _MON for _, n, _ in rows)
    _tong_m = sum(len(rows) for _, rows in _MON)
    w(f"\n### Nhóm: ẨM THỰC — {_tong_q} quán trên {_tong_m} món\n\n")
    w("*Chia nhóm là phán đoán biên tập, không phải số đo: “đặc sản” nghĩa là món "
      "gắn với Đà Lạt, “phổ thông” nghĩa là món có ở mọi thành phố và cũng có ở đây. "
      "Trong từng nhóm xếp theo số cơ sở bán.*\n\n")
    for _nhom, _rows in _MON:
        w(f"**{_nhom.upper()}** — {len(_rows)} món\n\n")
        w("| Món | Số quán | Gợi ý (ưu tiên quán có số gọi) |\n|---|---:|---|\n")
        for _mon, _sl, _quan in _rows:
            _g = " · ".join(q["ten"] for q in _quan[:3])
            w(f"| {_mon} | {_sl} | {_g} |\n")
        w("\n")

# Ba truong mua/gio/thoi luong trong tren ca 28 hoat dong. KHONG viet ve chung o
# day: muc 3 la muc tra cuu, con cho thieu + viec can lam thuoc muc 12, noi da co
# san bang chi so va danh sach so dien thoai can goi. Cung mot ly do 1.336 dong
# truong chua xac minh bi bo han thay vi in kem loi giai thich.

# =============================================== 4. LUU TRU & AN UONG
_LT = _an_ngu.tai_luu_tru(RAW)
_AU = _an_ngu.tai_an_uong(RAW)

if _LT or _AU:
    w("\n---\n\n## 4. LƯU TRÚ & ĂN UỐNG\n\n")

if _LT:
    w("### 4.1 Lưu trú\n\n")
    # Day la nhom DUY NHAT trong ca tai lieu co GIA THAT — tu dang ky luu tru
    # cua Cuc Du lich Quoc gia, khong phai tu blog. Nen gia ghi thang.
    w(f"*{_LT['tong']} cơ sở trong đăng ký lưu trú nhà nước · "
      f"**{_LT['nha_nuoc']} đã thẩm định**, {_LT['tu_dang_ky']} tự đăng ký · "
      f"{_LT['co_gia']} cơ sở có giá công bố · {_LT['co_dien_thoai']} có số gọi.*\n\n")
    w("**Giá là giá phòng/đêm do cơ sở công bố với cơ quan quản lý** — đổi theo mùa, "
      "gọi xác nhận trước khi báo khách.\n\n")
    for _b in _LT["bac"]:
        if not _b["co_so"]:
            continue
        w(f"**{_b['ten']}** — {_b['tong']} cơ sở"
          + (f", dưới đây {len(_b['co_so'])}" if _b["tong"] > len(_b["co_so"]) else "")
          + "\n\n")
        w("| Cơ sở | Giá/đêm | Phòng | Điện thoại | Địa chỉ |\n|---|---|---:|---|---|\n")
        for _c in _b["co_so"]:
            w(f"| {_c['ten']} | {_c['gia']} | {_c['so_phong'] or ''} | "
              f"{_c['dien_thoai'] or ''} | {(_c['dia_chi'] or '').split(',')[0]} |\n")
        w("\n")
    if _LT["dong_cua"]:
        w("**Đã đóng cửa — không giới thiệu:** "
          + " · ".join(f"{r['ten']} ({r['ngay']})" for r in _LT["dong_cua"]) + "\n\n")

if _AU:
    w("### 4.2 Ăn uống\n\n")
    w(f"*{_AU['tong_mo']:,} quán còn hoạt động · {_AU['co_dien_thoai']:,} có số gọi. "
      "Món đặc trưng xem mục 3.*\n\n".replace(",", "."))
    for _n in _AU["nhom"]:
        w(f"**{_n['ten']}** — {_n['tong']} quán"
          + (f", dưới đây {len(_n['quan'])}" if _n["tong"] > len(_n["quan"]) else "")
          + "\n\n")
        for _q in _n["quan"]:
            _m = f" · {', '.join(_q['mon'])}" if _q["mon"] else ""
            w(f"- {_q['ten']}"
              + (f" — {_q['dien_thoai']}" if _q["dien_thoai"] else "")
              + _m + "\n")
        w("\n")
    # Muc quan trong nhat cua ca chuong nay. Thac khong dong cua; quan an thi co.
    if _AU["dong_cua"]:
        w("#### ⚠ Đã đóng cửa — KHÔNG giới thiệu\n\n")
        w(f"*{_AU['tong_dong']} quán đã đóng, dưới đây {len(_AU['dong_cua'])} gần nhất. "
          "Nhiều quán trong số này vẫn còn trong các hướng dẫn cũ.*\n\n")
        w("| Ngày đóng | Quán |\n|---|---|\n")
        for _r in _AU["dong_cua"]:
            w(f"| {_r['ngay']} | {_r['ten']} |\n")
        w("\n")

# =============================================== 5-13 chi muc (sinh tu dong)
w("\n---\n\n## 5. Bảng so sánh\n\n")
w("*Sinh tự động từ mục 2 — không sửa tay, sửa ở mục 2 rồi chạy lại.*\n\n")
w("| ID | Điểm | Loại | Khu vực | Km | Phút | Vé | Nguồn |\n|---|---|---|---|---:|---:|---|---:|\n")
for r in picked:
    w(f"| {r['id']} | {r['name']} | {r['loai_vn']} | {r['area']} | "
      f"{r['km']:.1f} | {r['min']:.0f} | {r.get('fee') or UNV} | {len(r['src'])} |\n")

w("\n## 6. Theo loại hình\n\n")
for k, v in sorted(Counter(r["loai_vn"] for r in picked).items(), key=lambda x: -x[1]):
    w(f"**{k}** ({v}): " + " · ".join(f"{r['id']} {r['name']}"
                                      for r in picked if r["loai_vn"] == k) + "\n\n")

w("## 7. Theo khu vực\n\n")
for a in sorted({r["area"] for r in picked}):
    lst = [r for r in picked if r["area"] == a]
    w(f"**{a}** ({len(lst)}): " + " · ".join(f"{r['id']} {r['name']}" for r in lst) + "\n\n")

w("## 8. Theo khoảng cách từ hồ Xuân Hương\n\n")
for lo, hi, lab in ((0, 5, "Dưới 5 km"), (5, 10, "5 – 10 km"),
                    (10, 20, "10 – 20 km"), (20, 9e9, "Trên 20 km")):
    lst = [r for r in picked if lo <= r["km"] < hi]
    w(f"**{lab}** ({len(lst)}): " + (" · ".join(f"{r['id']} {r['name']} ({r['min']:.0f}′)"
                                                for r in lst) or "—") + "\n\n")

w("## 9. Theo thời điểm thăm\n\n")
w(f"Bình minh · buổi sáng · buổi chiều · hoàng hôn · buổi tối: **{UNV}** — "
  "trường “thời điểm tốt trong ngày” chưa xác minh cho bất kỳ điểm nào. "
  "Không được xếp lịch theo giờ dựa trên suy đoán.\n\n")
w("**Điểm đi được khi trời mưa** *(suy ra từ loại hình — đã được duyệt)*:\n\n")
for lab in ("trong nhà", "có mái", "hỗn hợp"):
    lst = [r for r in picked if INDOOR.get(r["loai_vn"], ("", ""))[0] == lab]
    if lst:
        w(f"- **{lab}**: " + " · ".join(f"{r['id']} {r['name']}" for r in lst) + "\n")
w("\n")

w("## 10. Tuyến gợi ý theo khu vực\n\n")
w("*Thứ tự trong mỗi khu dựng bằng thuật toán láng giềng gần nhất trên ma trận OSRM, "
  "xuất phát từ điểm gần trung tâm nhất.*\n\n")
if mat:
    idx = {r["id"]: i for i, r in enumerate(picked)}
    for a in sorted({r["area"] for r in picked}):
        lst = [r for r in picked if r["area"] == a]
        if len(lst) < 2:
            continue
        cur = min(lst, key=lambda x: x["min"])
        route, left, tot = [cur], [x for x in lst if x is not cur], 0.0
        while left:
            nxt = min(left, key=lambda x: mat["durations"][idx[cur["id"]]][idx[x["id"]]] or 9e9)
            tot += (mat["durations"][idx[cur["id"]]][idx[nxt["id"]]] or 0) / 60.0
            route.append(nxt)
            left.remove(nxt)
            cur = nxt
        w(f"**{a}** — {len(route)} điểm · di chuyển giữa các điểm ~{tot:.0f} phút\n\n")
        w("   " + " → ".join(f"{x['id']} {x['name']}" for x in route) + "\n\n")
else:
    w(f"{UNV} — chưa có ma trận OSRM.\n\n")

w("## 11. Ma trận thời gian giữa các điểm (phút)\n\n")
if mat:
    w("| | " + " | ".join(r["id"] for r in picked) + " |\n")
    w("|---|" + "---|" * len(picked) + "\n")
    for i, r in enumerate(picked):
        cells = []
        for j in range(len(picked)):
            t = mat["durations"][i][j]
            cells.append("—" if i == j or t is None else f"{t/60:.0f}")
        w(f"| **{r['id']}** | " + " | ".join(cells) + " |\n")
    w("\n")

w("## 12. Danh sách rút gọn\n\n")
w("⚠ Xếp hạng dưới đây dựa trên **mức độ hiện diện trên bản đồ**, KHÔNG phải chất lượng "
  "trải nghiệm — thứ đó chưa có dữ liệu. Dùng làm gợi ý thứ tự gọi xác minh, "
  "không dùng làm lời khuyên “nơi này hay hơn nơi kia”.\n\n")
rank = sorted(picked, key=lambda r: -r["_score"])
for lab, seg in (("Ưu tiên xác minh trước", rank[:8]), ("Nhóm hai", rank[8:20]),
                 ("Nhóm ba", rank[20:])):
    w(f"**{lab}** ({len(seg)}): " + " · ".join(f"{r['id']} {r['name']}" for r in seg) + "\n\n")

w("## 13. Sổ kiểm chứng — việc cần làm\n\n")
n_tel = sum(1 for r in picked if r.get("tel"))
w(f"| Chỉ số | Giá trị |\n|---|---|\n")
w(f"| Điểm trong hồ sơ | {len(picked)} |\n")
w(f"| Có số điện thoại để gọi | **{n_tel}** / {len(picked)} |\n")
w(f"| Chưa có số — cần tìm | {len(picked)-n_tel} |\n")
w(f"| Có giờ mở cửa | {sum(1 for r in picked if r.get('hours'))} |\n")
w(f"| Có giá vé | {sum(1 for r in picked if r.get('fee'))} |\n")
w(f"| Có đánh giá sao | **0** — không nguồn mở nào có |\n")
w(f"| Trường `[CHƯA XÁC MINH]` ước tính | **~{41*len(picked)}** |\n\n")

# Cho thieu cua muc 3 thuoc VE DAY, khong thuoc giua chuong tra cuu.
if _HDTK["thieu"]:
    w(f"**Mục 3 — cả {_HDTK['so_hoat_dong']} hoạt động đều chưa có mùa, giờ trong ngày "
      "và thời lượng.** Trống nghĩa là chưa xác minh, không nghĩa là quanh năm. "
      "Đừng khẳng định với khách cỏ hồng tháng nào hay tour đi mấy giờ khi chưa gọi.\n\n")
    w(f"**Tra đơn vị tour bằng Facebook, đừng tra tên miền** — "
      f"{_HDTK['ten_mien_chet']}/{_HDTK['tong_website_thu']} tên miền đã kiểm không còn "
      "hoạt động (`canyoningdalat.com`, `dalatjeep.com`, `toursanmaydalat.com`).\n\n")

w("**Gọi một cuộc đóng được ~9 trường.** Danh sách cần gọi, theo thứ tự ưu tiên:\n\n")
w("| # | Điểm | Điện thoại |\n|---|---|---|\n")
for i, r in enumerate([x for x in rank if x.get("tel")][:20], 1):
    w(f"| {i} | {r['id']} · {r['name']} | {r['tel']} |\n")

w("\n---\n\n## PHỤ LỤC — TÓM TẮT ĐỘ PHỦ (đọc lại trước khi trả lời khách)\n\n")
w("```\n")
w(f"Tài liệu này theo dõi khoảng {41*len(picked)} trường trên {len(picked)} điểm đến.\n")
w("Phần lớn mang dấu [CHƯA XÁC MINH].\n\n")
w("Nếu khách hỏi về một trường mang dấu [CHƯA XÁC MINH] ở bất kỳ đâu phía trên:\n")
w('  nói "chỗ này em chưa có số liệu đã xác minh, để em gọi hỏi rồi báo lại mình",\n')
w("  và KHÔNG đưa ra con số, giờ giấc hay đánh giá nào thay thế.\n\n")
w("Ba trường tuyệt đối không được suy đoán, vì sai là khách mất tiền hoặc mất cả ngày:\n")
w("  - giờ mở cửa      - giá vé      - mức độ dễ đi lại cho người cao tuổi\n")
w("```\n\n")
w("*Tài liệu này chứa dữ liệu từ OpenStreetMap. Dữ liệu © những người đóng góp OpenStreetMap, "
  "theo giấy phép Open Database License — https://openstreetmap.org/copyright*\n")
import re as _re

# ---------- loc bo moi dong truong chua co du lieu ----------
# Yeu cau cua chu du an: chi giu truong DA XAC MINH. Chi bo cac dong dang
# "Nhan : [CHƯA XÁC MINH]" trong ho so tung diem. KHONG dong den muc 0 (quy tac doc)
# — quy tac van phai noi ro: truong KHONG XUAT HIEN nghia la chua biet, cam suy doan.
_text = "".join(_buf)
_FIELD_UNV = _re.compile(r"^.{0,30}?:\s*" + _re.escape(UNV) + r".*$")
_kept, _dropped = [], 0
for _ln in _text.split("\n"):
    if _FIELD_UNV.match(_ln) and not _ln.lstrip().startswith(("|", ">", "-", "*", "w(")):
        _dropped += 1
        continue
    _kept.append(_ln)

# Bo khoi ``` rong (va tieu de **A.x ...** ngay truoc no) sau khi loc
_out, _i = [], 0
while _i < len(_kept):
    _ln = _kept[_i]
    if _ln.strip() == "```" and _i + 1 < len(_kept) and _kept[_i + 1].strip() == "```":
        while _out and _out[-1].strip() == "":
            _out.pop()
        if _out and _out[-1].lstrip().startswith("**A."):
            _out.pop()
        _i += 2
        continue
    _out.append(_ln)
    _i += 1

_final = _re.sub(r"\n{4,}", "\n\n\n", "\n".join(_out))
io.open(OUT, "w", encoding="utf-8").write(_final)
print("saved ->", OUT)
print(f"da bo {_dropped} dong truong chua xac minh -> con {_final.count(chr(10))} dong")

# ------------------------------------------------------- mau ho so chuyen di
if TRIP_OUT:
    t = io.open(TRIP_OUT, "w", encoding="utf-8")
    t.write("""# MẪU HỒ SƠ CHUYẾN ĐI — <tên khách>

> File này là **bản dùng một lần cho một khách**. Chép ra một bản mới cho mỗi khách.
> KHÔNG sửa `huong-dan-diem-den.md` — đó là dữ liệu dùng chung, sửa vào đó là hỏng
> cho mọi khách sau.

## 1. Thông tin chuyến đi
Khách            :
Liên hệ          :
Số ngày          : [3 / 4 / 5]
Ngày đi – ngày về:
Số người         : người lớn ___ · trẻ em ___ (tuổi: ___)
Khách sạn        :            (toạ độ: ___ — dùng để tính khoảng cách từ khách sạn)
Ngân sách        :
Quan tâm         : [thiên nhiên / chụp ảnh / văn hoá / mạo hiểm / nghỉ dưỡng]

## 2. Ràng buộc — điền trước khi chọn điểm
Đi bộ được bao xa :
Có ai đi lại khó  : [không / có — ghi rõ]
Trẻ nhỏ           : [không / có — tuổi]
Say xe đường đèo  :
Kiêng ăn          :

## 3. Lịch từng ngày
### Ngày 1 — <khu vực>
| Giờ | Điểm (ID) | Thời lượng | Tới điểm sau | Ghi chú |
|---|---|---|---|---|
|  |  |  |  |  |

Bữa trưa :            Bữa tối :
Khoảng trống nghỉ :
Phương án trời mưa: đổi ___ sang ___ (tra mục 7 của hướng dẫn)

### Ngày 2 — <khu vực>
### Ngày 3 — <khu vực>

## 5. Báo giá đã gửi khách — CHỈ THÊM DÒNG, KHÔNG SỬA DÒNG CŨ
| Ngày giờ | Nội dung | Số tiền | Hiệu lực đến |
|---|---|---|---|
|  |  |  |  |

## 6. Đánh giá riêng cho khách này
| Điểm (ID) | Mức quan tâm | Quyết định | Lý do |
|---|---|---|---|
|  | [cao/vừa/thấp] | [đi / cân nhắc / bỏ / dự phòng] |  |

## 7. Câu đang chờ khách trả lời
- [ ]
""")
    t.close()
    print("saved ->", TRIP_OUT)

print(f"khu vuc: {dict(Counter(r['area'] for r in picked))}")
print(f"co dien thoai: {n_tel}/{len(picked)}")
