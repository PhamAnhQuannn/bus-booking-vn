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
import re as _re
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hoat_dong_data as _hoat_dong   # mot nguon chon loc, hai nguon dinh dang
import an_ngu_data as _an_ngu

# Duong ra co MAC DINH — cung ly do nhu ban .docx: khi ten file la lua chon cua
# tung lan goi thi hai phien lam viec song song se sinh ra hai ban khac nhau.
OUT_MAC_DINH = "documentation/tourism/destinations/da-lat/huong-dan-diem-den.md"
RAW = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else OUT_MAC_DINH
TRIP_OUT = sys.argv[3] if len(sys.argv) > 3 else None
BUILD_DATE = "28/07/2026"

# ── SO MUC: mot cho duy nhat ────────────────────────────────────────────────
# Moi tieu de VA moi tham chieu "xem muc N" deu doc tu day. Doi thu tu muc thi
# sua o day, khong phai di tim tung cau van.
S_QUYTAC, S_TONGQUAN, S_DIAHINH, S_DIEMDEN = 0, 1, 3, 4
S_KHUVUC = 2
S_HOATDONG, S_ANNGU, S_SOSANH = 5, 6, 7
S_TUYEN, S_MATRAN, S_KIEMCHUNG = 8, 9, 10

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

# ── DL-xx la ID THEO VI TRI, khong phai ID cua DIA DIEM ────────────────────
# `enumerate(picked)` ngay tren nghia la DL-07 chi co nghia "diem thu 7 sau khi
# sap xep". Nhung MUOI MOT script khac doc guide_data.json va gan ket qua cua
# minh THEO id do: enrichment.json (so dien thoai da goi xac minh, gio mo cua,
# canh bao website) va lan_can.json deu khop MU theo id, khong kiem tra gi.
# Neu logic chon/hop nhat/score doi mot chut — lam thu tu sort doi — thi moi
# hang enrichment se mo ta MOT DIA DIEM KHAC, im lang, khong loi nao.
# enrichment.json bi gitignore va mot phan khong tai tao duoc, nen khong co
# duong phuc hoi.
#
# Bo dem OSRM ngay duoi da tu bao ve dung cach nay (`c.get("ids") == ...`);
# enrichment va lan_can thi chua. Chot danh sach lai thanh mot file vang va so
# sanh moi lan chay: id doi cho la LOI NGHIEM TRONG, khong phai canh bao.
CHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diem_den_chot.json")
_hien_tai = [[r["id"], r["name"]] for r in picked]
if os.path.exists(CHOT):
    _vang = json.load(io.open(CHOT, encoding="utf-8"))
    if _vang != _hien_tai:
        _cu = {i: n for i, n in _vang}
        _doi = [(i, _cu.get(i), n) for i, n in _hien_tai if _cu.get(i) != n]
        print("\nDUNG — danh sach DL-xx da doi so voi file chot:")
        for i, cu, moi in _doi[:10]:
            print(f"   {i}  {cu!r}  ->  {moi!r}")
        print(f"   ({len(_doi)} id doi cho tren {len(_hien_tai)})")
        print("Moi hang trong enrichment.json va lan_can.json khop theo id nay,"
              " nen dung tiep se gan\ndu lieu da xac minh cho SAI dia diem.")
        print(f"Neu day la thay doi CO Y: xoa {os.path.basename(CHOT)} roi chay lai,"
              " va chay lai moi\nscript enrich_*/gan_lan_can de du lieu khop id moi.")
        sys.exit(1)
else:
    json.dump(_hien_tai, io.open(CHOT, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"  da chot danh sach DL-xx -> {os.path.basename(CHOT)}")

# ── SUA LOAI HINH THEO TEN — sau khi da chon, khong truoc ──────────────────
# 8/36 diem mang loai chinh `Dinh thự / Di tích` va 7 trong so do sai. Te nhat:
# `Chùa Linh Phước` — mot ngoi chua — trong khi bon ngoi chua khac dan nhan
# dung `Chùa / Thiền viện`.
#
# NGUYEN NHAN KHONG NAM O BANG QUY DOI. Da kiem: `CROSSWALK` trong
# build_destinations_md.py xep `Chùa / Thiền viện` o vi tri 2, TRUOC
# `Dinh thự / Di tích` o vi tri 7, kem san mot chu thich giai thich vi sao.
# Loi nam mot lop TREN: buoc hop nhat khong gop duoc cac ban ghi cua CUNG mot
# noi. Ban kinh 150 m + phep khop ten tieng Viet khong noi duoc
# `Linh Phuoc Pagoda` voi `Chùa Linh Phước - Đà Lạt`, va mot khu chua rong thi
# cac nguon danh dau cach nhau hon 150 m. Ket qua: BA dong roi nhau cho cung
# ngoi chua (Langbiang co CHIN dong), va dong thang cuoc chon la manh chi co
# Overture voi `kinds = ['landmark_and_historical_building']` — dong co thong
# tin NGHEO NHAT, khong phai dong bi xep sai uu tien.
#
# Sua goc (noi lai buoc hop nhat) doi tap 36 -> doi id DL-xx theo vi tri -> phai
# chay lai ca 11 luot enrich. Nen o day sua theo TEN, la thu khong the sai:
# ten co chu `chùa` thi do la mot ngoi chua.
#
# Dat SAU khi chon va SAU khi chot id: `loai_vn` tham gia vao `EXCLUDE_CAT` va
# `CAT_TIER`, nen sua truoc khi chon se doi CHINH tap 36 duoc chon.
# Tach Phat giao va Thien Chua giao thanh hai nhom RIENG — gop lam mot thi ba
# nha tho DL-05/16/25 dang dung se bi keo sang `Chùa / Thiền viện`.
LUAT_TEN = [
    ("Chùa / Thiền viện", ("chùa", "thiền viện", "tịnh xá", "tu viện", "cổ sát")),
    ("Nhà thờ", ("nhà thờ", "giáo xứ", "thánh đường")),
    ("Thác nước", ("thác",)),
    ("Hồ / Đập", ("hồ", "đập")),
    ("Núi / Đèo / Đường mòn", ("đỉnh", "núi", "đèo")),
]
# Bon ten ghep khong co tu khoa nao de bam vao — luat tren khong the voi tro.
# Bang tay bon dong, moi dong mot ly do.
LOAI_TAY = {
    "Khu Du Lịch Lang Biang": "Khu vui chơi",      # khu cong + dich vu, khong phai di tich
    "Suối Vàng Dalat & Đường Hầm Đất Sét": "Khu vui chơi",   # duong ham dat set la cong trinh tham quan
    "Làng Cù Lần": "Khu vui chơi",                 # lang du lich dung san, khong phai di tich
    "Khu Di Tích Dinh Bảo Đại": "Dinh thự / Di tích",        # dung — giu nguyen, ghi ro de khong ai "sua"
}


def _co_tu_ten(ten, tu):
    """Bien tu o hai dau, GIU NGUYEN DAU. Cung khuon `_co_tu` cua
    hoat_dong_data.py: bo dau thi `Đỉnh` thanh `dinh`, trung tu `dinh` cua
    `Dinh thự`, va bay do chinh la thu luat nay sinh ra de tranh."""
    return _re.search(r"(?<![0-9A-Za-zÀ-ỹ])" + _re.escape(tu)
                      + r"(?![0-9A-Za-zÀ-ỹ])", ten.lower()) is not None


_sua_loai = []
for r in picked:
    moi = LOAI_TAY.get(r["name"])
    if not moi:
        for nhan, tu_khoa in LUAT_TEN:
            if any(_co_tu_ten(r["name"], t) for t in tu_khoa):
                moi = nhan
                break
    if moi and moi != r["loai_vn"]:
        _sua_loai.append((r["id"], r["name"], r["loai_vn"], moi))
        r["loai_vn"] = moi
if _sua_loai:
    print(f"  sua loai hinh theo ten: {len(_sua_loai)} diem")
    for _i, _t, _cu, _moi in _sua_loai:
        print(f"     {_i} {_t[:34]:36s} {_cu} -> {_moi}")

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
    # `_score` bi loai boi bo loc `startswith("_")` ngay duoi, nen ban .docx
    # KHONG BAO GIO nhan duoc no — va no da tu xep hang muc 12/13 bang cong thuc
    # rieng `(-len(src), -conf)`. Muc 13 la THU TU GOI DIEN xac minh, nen hai
    # ban tai lieu dang bat dong ve viec goi ai truoc, trong khi docstring cua ca
    # hai deu ghi "MOT lan chon, hai dinh dang".
    # Cung ho loi da ghi trong so 26/07: hai duong doc cung mot du lieu phai
    # dung CHUNG mot phep tinh, khong duoc moi ben tu dung mot cai.
    "xep_hang": [r["id"] for r in sorted(picked, key=lambda r: -r["_score"])],
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
  "đăng ký lưu trú Cục Du lịch Quốc gia · "
  # Wikipedia PHAI co trong dong nay. Truoc day 19 doan mo ta da trich tu
  # Wikipedia ma khong ghi cong — CC BY-SA 4.0 doi ghi cong kem lien ket, va
  # dong nguon nay la cho duy nhat nguoi doc thay duoc.
  "[Wikipedia tiếng Việt](https://vi.wikipedia.org) (CC BY-SA 4.0)\n\n")

w(f"## {S_QUYTAC}. QUY TẮC ĐỌC — BẮT BUỘC ĐỌC TRƯỚC\n\n")
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
  f"Mục {S_HOATDONG} liệt kê hoạt động kèm nơi và đơn vị cụ thể, đó là dữ kiện; “Đà Lạt lãng "
  "mạn, hợp cho các cặp đôi” thì không.\n\n")
w("**Nhịp độ mặc định (chuyến “thư giãn”):** tối đa 4 điểm/ngày · tối đa 2 giờ di chuyển/ngày · "
  "mỗi ngày chừa một khoảng trống. Vượt quá phải nói rõ với khách là lịch dày.\n\n")
w("**Bay flycam:** mặc định **coi như bị cấm** trừ khi có xác nhận ngược lại. "
  "Sai theo hướng an toàn thì mất một tấm ảnh; sai theo hướng kia thì khách bị phạt.\n\n")

# ============================================================ 1. tong quan
w(f"---\n\n## {S_TONGQUAN}. Tổng quan điểm đến\n\n")
w("| Mục | Giá trị |\n|---|---|\n")
w("| Thành phố | Đà Lạt, tỉnh Lâm Đồng |\n")
w("| Độ cao | ~1.500 m so với mực nước biển |\n")
w(f"| Số điểm trong hồ sơ này | {len(picked)} |\n")
w("| Kho dữ liệu đầy đủ | `diem-tham-quan.md` — 1.361 điểm, tra khi cần điểm ngoài danh sách |\n")
# Phuong vi mat troi moc thuoc VE DAY — mot dong cho ca thanh pho, khong phai
# mot cot trong bang dia hinh. Truong `huong_binh_menh` co 36/36 nhung GIA TRI
# GIONG NHAU o ca 36 dong, vi no la ham cua vi do va ngay chu khong cua dia diem.
# Mot cot lap lai mot gia tri 36 lan doc nhu du lieu ma khong mang thong tin.
_bm = (_an_ngu.tai_dia_hinh(RAW) or {}).get("binh_minh")
if _bm:
    w(f"| Hướng mặt trời mọc | {_bm} — chung cho cả thành phố, không khác nhau "
      "giữa các điểm |\n")
w("| Thời tiết theo tháng | " + UNV + " — chưa lấy dữ liệu khí hậu |\n")
w("| Lịch lễ hội | " + UNV + " |\n")
w("| Ảnh hưởng Tết | " + UNV + " — cần xác minh, nhiều nơi đóng cửa và giá tăng mạnh |\n")
w("| Đi lại tới Đà Lạt | " + UNV + " — chưa thu thập tuyến xe/máy bay |\n")
w("| Phương tiện tại chỗ | " + UNV + " — chưa thu thập giá thuê xe/taxi |\n\n")
w("⚠ Năm hàng cuối là **khoảng trống có thật, không phải lỗi hiển thị**. Một lịch trình "
  "không biết khách tới bằng gì và đi lại bằng gì thì chưa phải một lịch trình.\n\n")

# ==================================================== 2. tong quan khu vuc
# Muc MOI. Cau hoi thuong gap nhat — "di Da Lat 3-5 ngay thi chia the nao" —
# truoc day khong muc nao tra loi: muc 2 di thang vao 36 ho so, cac muc chi
# muc thi sap xep lai cung 36 diem theo tung chieu mot. Bang nay tra loi o cap
# KHU VUC, la cap ma nguoi ta thuc su chia ngay.
# Moi con so o day rut tu guide_data.json + lan_can_khu_vuc.json — khong suy
# dien gi, khong co truong nao phai bia.
_LCKV_TQ = _an_ngu.tai_lan_can_khu_vuc(RAW)
w(f"---\n\n## {S_KHUVUC}. Tổng quan theo khu vực\n\n")
w("*Chia ngày theo khu vực, không theo từng điểm: các điểm trong một khu vực đủ gần "
  "để đi liền trong cùng buổi.*\n\n")
w("| Khu vực | Điểm | Km từ trung tâm | Rộng | Lưu trú trong khu vực |\n"
  "|---|---:|---|---|---|\n")
for _a in sorted({r["area"] for r in picked}):
    _ps = [r for r in picked if r["area"] == _a]
    _kv = _LCKV_TQ.get(_a) or {}
    _lo, _hi = min(r["km"] for r in _ps), max(r["km"] for r in _ps)
    _n_ks = sum(len(b["khach_san"]) for b in _kv.get("bac_khach_san") or [])
    if _kv.get("khong_co_khach_san"):
        _luu = f"**không có** — xem mục {S_ANNGU}"
    elif _n_ks:
        _luu = f"{_kv.get('tong_ks', 0)} cơ sở có giá"
    else:
        _luu = "—"
    _rong = _kv.get("ban_kinh_khu_vuc", "—")
    if _kv.get("canh_bao_khoang_cach"):
        _rong += " ⚠"
    w(f"| {_a} | {len(_ps)} | {_lo:.1f} – {_hi:.1f} | {_rong} | {_luu} |\n")
w("\n⚠ Khu vực có dấu ⚠ ở cột *Rộng* thì các điểm trong đó cách nhau xa hơn bán kính "
  "5 km dùng để tìm cơ sở gần — chúng **không dùng chung một thị trường lưu trú**, "
  "nên đừng gộp vào một đêm nghỉ.\n\n")

# ============================== 3. dia hinh: ngam canh / san may / chup anh
# Lop nay do Phase L thu thap (SRTM 30 m + cong thuc thien van) va CHUA TUNG
# duoc in ra: do_cao 36/36, do_nho 36/36, huong_mo 26/36 nam trong
# enrichment.json tu 28/07. Lan thu nam trong du an nay mot lop du lieu duoc thu
# roi khong ai doc — sau cot `socials`, blob `csdl`, the tien nghi OSM va truong
# `confidence`.
_DH = _an_ngu.tai_dia_hinh(RAW)
if _DH and _DH["hang"]:
    w(f"---\n\n## {S_DIAHINH}. NGẮM CẢNH · SĂN MÂY · CHỤP ẢNH\n\n")
    w("*Suy ra từ mô hình độ cao SRTM 30 m — **không phải quan sát thực địa**. "
      "`Độ nhô` là độ cao của điểm trừ trung vị vùng xung quanh: số dương nghĩa là "
      "cao hơn cảnh quan quanh nó nên tầm nhìn thoáng, số âm nghĩa là bị che.*\n\n")
    w("| Điểm | Độ cao | Độ nhô | Hướng mở |\n|---|---:|---:|---|\n")
    for _x in _DH["hang"]:
        _c = "  ⚠" if _x.get("canh_bao") else ""
        w(f"| {_x['id']} · {_x['ten']}{_c} | {_x['do_cao']} | {_x['do_nho'] or ''} "
          f"| {_x['huong_mo'] or '—'} |\n")
    w("\n")
    for _x in _DH["hang"]:
        if _x.get("canh_bao"):
            w(f"⚠ **{_x['id']} · {_x['ten']}** — {_x['canh_bao']}. Mọi con số ở dòng "
              "này nói về khu cổng, không nói về đỉnh.\n\n")
    # Noi thang: dong cao nhat bang nay khong phai dinh cao nhat Da Lat.
    w(f"**Dòng cao nhất bảng này là *{_DH['hang'][0]['ten']}* "
      f"({_DH['hang'][0]['do_cao']}) — không phải đỉnh cao nhất vùng.** Đỉnh Núi Bà "
      "(Langbiang) cao **2.138 m** theo cùng mô hình SRTM, nhưng bảng này xếp theo "
      "toạ độ đang lưu của mỗi điểm, và toạ độ của `DL-04` là khu cổng ở 1.469 m — "
      "cố ý giữ như vậy vì đó là nơi khách thực sự lái xe tới. Xem ghi chú ⚠ ở trên.\n\n")

# ============================================================ 4. ho so diem
w(f"---\n\n## {S_DIEMDEN}. DANH SÁCH ĐIỂM ĐẾN\n\n")
w("Thứ tự các mục trong mỗi hồ sơ là **cổng lọc trước, mô tả sau**: nhận dạng → khả năng "
  "tiếp cận → kế hoạch thăm → giờ giấc. Một ràng buộc về đi lại loại bỏ địa điểm trước khi "
  "chi tiết chụp ảnh có ý nghĩa gì.\n\n")

_LCKV = _an_ngu.tai_lan_can_khu_vuc(RAW)


def khoi_khu_vuc(kv):
    """Khach san + quan an cho CA KHU VUC, in mot lan.

    Truoc day khoi nay nam trong tung ho so (A.14/A.15) va chiem 1.420 dong —
    trung vi 43% moi ho so — de in lai gan nhu cung mot danh sach 36 lan. Chi co
    52 khach san khac nhau tren toan bo tai lieu.
    """
    v = _LCKV.get(kv)
    if not v:
        return
    w(f"**Lưu trú & ăn uống trong khu vực** *({v['so_diem']} điểm · các điểm cách "
      f"nhau tối đa {v['ban_kinh_khu_vuc']})*\n\n")
    if v.get("canh_bao_khoang_cach"):
        w(f"> ⚠ {v['canh_bao_khoang_cach']}\n\n")
    if v.get("khong_co_khach_san"):
        w(f"{v['khong_co_khach_san']} Xem mục {S_ANNGU} để chọn theo bậc giá.\n\n")
    for b in v["bac_khach_san"]:
        w(f"*{b['ten']}* — {b['tong']} cơ sở trong khu vực, "
          f"{b['tong_thanh_pho']} trên toàn Đà Lạt\n\n")
        w("| Khách sạn | Giá/đêm | Cách | Gần | Phòng | Điện thoại | Thẩm định |\n")
        w("|---|---|---|---|---:|---|---|\n")
        for h in b["khach_san"]:
            w(f"| {h['ten']} | {h['gia'] or ''} | {h['khoang_cach']} | {h['gan_diem']} "
              f"| {h['so_phong'] or ''} | {h['dien_thoai'] or ''} | {h['tham_dinh']} |\n")
        w("\n")
    if v["loai_quan"]:
        w(f"*Quán ăn* — {v['tong_quan']} quán còn mở trong khu vực\n\n")
        w("| Loại | Quán | Cách | Gần | Điện thoại |\n|---|---|---|---|---|\n")
        for l in v["loai_quan"]:
            for q in l["quan"]:
                w(f"| {l['ten']} | {q['ten']} | {q['khoang_cach']} | {q['gan_diem']} "
                  f"| {q['dien_thoai'] or ''} |\n")
        w("\n")


_muc = [0]


def sec(nhan):
    """Nhan tieu muc, DEM theo tung ho so.

    Truoc day cac nhan la chuoi cung `A.1`, `A.11`, `A.9`, `A.3`, `A.4`, `A.10`,
    `A.13`, `A.14`, `A.15` — nen `A.2`, `A.5`-`A.8` va `A.12` khong xuat hien o
    BAT KY ho so nao (A.12 co 7 truong con, ca 7 deu 0/36 nen no bi bo loc rong
    xoa moi lan). Nguoi doc thay day so nhay va ket luan tai lieu bi thieu muc.
    Danh so lai MOT LAN khong sua duoc: ho so nao co truong khac ho so ben canh
    thi lai lech tiep. Dem theo tung the thi luon lien tuc.
    """
    _muc[0] += 1
    return f"**A.{_muc[0]} — {nhan}**"


cur_area = None
for r in picked:
    if r["area"] != cur_area:
        cur_area = r["area"]
        w(f"\n### ▌KHU VỰC: {cur_area}\n\n")
        khoi_khu_vuc(cur_area)
    cs = csdl_by_name.get(fold(r["name"]))
    srcs = "+".join(r["src"])
    _muc[0] = 0          # bo dem tieu muc reset o moi ho so
    w(f"\n#### {r['id']} · {r['name']}\n\n")
    w("> *Chỉ nêu những trường KHÔNG mang dấu `[CHƯA XÁC MINH]`. Trường mang dấu đó: "
      "nói với khách là chưa xác minh được.*\n\n")

    # ── MO TA: trich nguyen van, ngoai khoi ``` de doc duoc nhu van xuoi ────
    # Khong dien dat lai. Van ban Wikipedia la CC BY-SA 4.0: ghi cong thi du,
    # nhung SUA lai la tao "Adapted Material" va lam phat sinh nghia vu chia se
    # tuong tu cho chinh doan da sua. Trich hoac bo, khong co lua chon thu ba.
    if has(r["id"], "mo_ta_wikipedia"):
        _e = ENR[r["id"]]["mo_ta_wikipedia"]
        w(f"> {_e['value']}\n>\n> — *{_e.get('source') or 'Wikipedia tiếng Việt'}"
          + (f" · [bài gốc]({_e['url']})" if _e.get("url") else "")
          + f" · trích nguyên văn · {_e.get('date') or ''}*\n\n")

    w(sec("Nhận dạng") + "\n\n")
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

    w(f"Tình trạng hoạt động: {'đang hoạt động' if not r.get('closed') else 'ĐÃ ĐÓNG ' + r['closed']}"
      "\n")
    # Muc do pho bien. KHONG phai diem sao — thang khac, nen de rieng va noi ro.
    # "Danh gia cua khach" van la CHUA XAC MINH; Google va TripAdvisor deu cam
    # luu diem so, va ti le de xuat cua Facebook khong quy doi sang sao duoc.

    w("```\n\n")

    w(sec("Tiện nghi tại chỗ") + " · *cổng lọc đầu tiên: đây là mục loại bỏ địa điểm "
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

    w(sec("Kế hoạch thăm") + "\n\n")
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

    w(sec("Giờ giấc và chi phí") + "\n\n")
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

    w(sec("Lưu ý quan trọng") + "\n\n")
    w("```\n")
    for f_ in ("Trang phục", "Giày dép", "Lưu ý thời tiết", "An toàn",
               "Giờ đông khách", "Nên mang theo", "Điều cấm"):
        w(f"{f_:<20}: {UNV}\n")
    w("```\n\n")

    w(sec("Vị trí và di chuyển") + "\n\n")
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

    w(sec("Chụp ảnh") + "\n\n")
    w("```\n")
    for f_ in ("Điểm chụp đẹp", "Giờ chụp đẹp", "Ngắm bình minh/hoàng hôn",
               "Phí chụp ảnh", "Lưu ý chụp ảnh"):
        w(f"{f_:<20}: {UNV}\n")
    w("Bay flycam          : COI NHƯ BỊ CẤM cho tới khi có xác nhận ngược lại\n")
    w("```\n\n")

    w(sec("Điểm lân cận") + " *(thời gian đường bộ thật, không phải đường chim bay)*\n\n")
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
    # Khoi khach san + quan an KHONG con o day — no in mot lan o dau khu vuc.
    # Chi tro ve do, kem con so trong ban kinh cua CHINH diem nay, vi con so do
    # la thu duy nhat trong khoi cu mang tinh rieng-tung-diem.
    _lc = _LAN_CAN.get(r["id"], {})
    _n_ks, _n_q = _lc.get("tong_ks_trong_bk"), _lc.get("tong_quan_trong_bk")
    w(f"{sec('Lưu trú & ăn uống')} → xem khối đầu khu vực **{r['area']}**")
    if _n_ks is not None:
        w(f" *(quanh riêng điểm này: {_n_ks} cơ sở lưu trú trong 5 km"
          f" · {_n_q} quán trong 2 km)*")
    if _lc.get("khong_co_khach_san"):
        w(f"\n\n{_lc['khong_co_khach_san']}")
    w("\n\n")

    w(f"**Kiểm chứng:** CHƯA GỌI · gọi số {r.get('tel') or 'CHƯA CÓ SỐ'} để đóng "
      "giờ mở cửa, giá vé, thời lượng thăm và điều kiện đi lại.\n\n")
    w("---\n")

# =============================================== 3. HOAT DONG
# Muc nay dat NGAY SAU danh sach diem den, truoc moi bang so sanh: nguoi len ke
# hoach 3-5 ngay nghi bang HOAT DONG ("sáng săn mây, trưa hái dâu"), khong nghi
# bang toa do. Bang so sanh la cong cu tra cuu, den sau.
_HD, _HDTK = _hoat_dong.tai(RAW)
_MON = _hoat_dong.tai_mon_an(RAW)
_PC = _hoat_dong.tai_phong_cach(RAW)

w(f"\n---\n\n## {S_HOATDONG}. HOẠT ĐỘNG — LÀM GÌ Ở ĐÀ LẠT\n\n")
w(f"*{_HDTK['so_hoat_dong']} hoạt động, {_HDTK['so_nhom']} nhóm. "
  f"Mã `DL-xx` dẫn về mục chi tiết ở mục {S_DIEMDEN}.*\n\n")

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
    # Cot "vlog nhac" CHI hien khi co du lieu. Han muc YouTube la 100 luot
    # tim/NGAY nen file `quan_vlog.json` co the rong hoac chi mot phan — in mot
    # cot toan trong thi trong nhu du lieu bi mat, con in 0 thi noi sai ("khong
    # vlog nao nhac" thay vi "chua quet den").
    _co_vlog = any(q.get("vlog") for _, rows in _MON for _, _, qs in rows for q in qs)
    for _nhom, _rows in _MON:
        w(f"**{_nhom.upper()}** — {len(_rows)} món\n\n")
        w("| Món | Số quán | Gợi ý (ưu tiên quán có số gọi) |\n|---|---:|---|\n")
        for _mon, _sl, _quan in _rows:
            _g = " · ".join(
                q["ten"] + (f" ({q['vlog']} kênh)" if q.get("vlog") else "")
                for q in _quan[:3])
            w(f"| {_mon} | {_sl} | {_g} |\n")
        w("\n")
    if _co_vlog:
        w("*`(N kênh)` — số kênh du lịch tiếng Việt **khác nhau** nhắc tên quán "
          "này, ngưỡng ≥2 kênh. Đếm theo kênh chứ không theo video, vì một kênh "
          "đăng nhiều video không phải nhiều lời khuyên độc lập. Quán không có "
          "ghi chú nghĩa là chưa quét đến, không phải không được nhắc.*\n\n")

# Quan co PHONG CACH DAC BIET — moi ngay mot mon, khong menu, gia truyen, quan cu.
# Bo HAN khoi khi chua co du lieu; khong in tieu de rong.
if _PC:
    w("\n### Nhóm: QUÁN CÓ PHONG CÁCH ĐẶC BIỆT\n\n")
    w(f"*{len(_PC)} quán được vlog nhắc kèm một cách làm riêng. Thẻ lấy từ bộ từ "
      "vựng cố định, không phải mô tả tự do.*\n\n")
    w("| Quán | Phong cách | Kênh nhắc | Điện thoại |\n|---|---|---:|---|\n")
    for _q in _PC:
        w(f"| {_q['ten']} | {', '.join(_q['the_phong_cach'])} | "
          f"{_q.get('so_kenh_nhac', _q.get('so_video_nhac', 0))} | "
          f"{_q.get('dien_thoai') or ''} |\n")
    w("\n")

# Ba truong mua/gio/thoi luong trong tren ca 28 hoat dong. KHONG viet ve chung o
# day: muc 3 la muc tra cuu, con cho thieu + viec can lam thuoc muc 12, noi da co
# san bang chi so va danh sach so dien thoai can goi. Cung mot ly do 1.336 dong
# truong chua xac minh bi bo han thay vi in kem loi giai thich.

# =============================================== 4. LUU TRU & AN UONG
_LT = _an_ngu.tai_luu_tru(RAW)
_AU = _an_ngu.tai_an_uong(RAW)

if _LT or _AU:
    w(f"\n---\n\n## {S_ANNGU}. LƯU TRÚ & ĂN UỐNG\n\n")

if _LT:
    w(f"### {S_ANNGU}.1 Lưu trú\n\n")
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
    w(f"### {S_ANNGU}.2 Ăn uống\n\n")
    w(f"*{_AU['tong_mo']:,} quán còn hoạt động · {_AU['co_dien_thoai']:,} có số gọi. "
      f"Món đặc trưng xem mục {S_HOATDONG}.*\n\n".replace(",", "."))
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
        w(f"*Đủ cả {len(_AU['dong_cua'])} quán đã đóng — danh sách này KHÔNG cắt bớt, "
          "khác với các danh sách gợi ý ở trên. Nhiều quán trong số này vẫn còn trong "
          "các hướng dẫn cũ và trong ký ức của mô hình ngôn ngữ.*\n\n")
        w("| Ngày đóng | Quán |\n|---|---|\n")
        for _r in _AU["dong_cua"]:
            w(f"| {_r['ngay']} | {_r['ten']} |\n")
        w("\n")

# =============================================== 5-13 chi muc (sinh tu dong)
w(f"\n---\n\n## {S_SOSANH}. Bảng so sánh\n\n")
w(f"*Sinh tự động từ mục {S_DIEMDEN} — không sửa tay, sửa ở mục {S_DIEMDEN} rồi chạy lại.*\n\n")
# Cot "Mua" la phan duy nhat cua muc 9 cu co du lieu that (36/36,
# suy ra tu loai hinh va da duoc duyet). Nhap vao day roi bo muc 9.
w("| ID | Điểm | Loại | Khu vực | Km | Phút | Vé | Mưa | Nguồn |\n|---|---|---|---|---:|---:|---|---|---:|\n")
for r in picked:
    _mua = INDOOR.get(r["loai_vn"], ("ngoài trời",))[0]
    w(f"| {r['id']} | {r['name']} | {r['loai_vn']} | {r['area']} | "
      f"{r['km']:.1f} | {r['min']:.0f} | {r.get('fee') or UNV} | {_mua} | "
      f"{len(r['src'])} |\n")

# ── DA CAT: muc 6 "Theo loai hinh" · 7 "Theo khu vuc" · 8 "Theo khoang cach"
#            · 9 "Theo thoi diem tham"
# Ca bon la CACH SAP XEP LAI cung 36 diem, khong phai du lieu moi:
#   6  `loai_vn` la mot COT cua bang so sanh -> nhom lai chi la mot phep sort
#   7  muc 2 gio da nhom theo khu vuc, day la dung mot phep nhom hai lan
#   8  `km` cung la mot COT cua bang so sanh; bon khoang chia tho khong them gi
#   9  truong "thoi diem tot trong ngay" la 0/36 — mot tieu de tren khong co gi.
#      Phan DUY NHAT co that trong do la nhom "di duoc khi troi mua", suy ra tu
#      loai hinh; no thanh mot COT cua bang so sanh ngay tren.
# Cat bon muc bo ~62 dong va bon tieu de ma khong mat truong nao.

w(f"## {S_TUYEN}. Tuyến gợi ý theo khu vực\n\n")
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

w(f"## {S_MATRAN}. Ma trận thời gian trong từng khu vực (phút)\n\n")
# Truoc day day la mot bang 36x36 = 1.296 o. No khong vua mot trang doc, va
# khong ai tra cuu thoi gian giua hai diem o hai dau thanh pho — nguoi ta tra
# thoi gian giua cac diem TRONG cung mot buoi, tuc trong cung khu vuc.
# Chia theo khu vuc: chin bang nho, moi bang vua mot trang, cung cach chia ma
# ca tai lieu dang dung. Cap xa nhau van con day du trong osrm_selected.json.
if mat:
    idx8 = {r["id"]: i for i, r in enumerate(picked)}
    w("*Chia theo khu vực: thời gian giữa các điểm trong cùng một buổi. Cặp ở hai "
      f"khu vực khác nhau thì tra mục {S_TUYEN} (tuyến gợi ý) hoặc tính từ cột Phút ở mục {S_SOSANH}.*\n\n")
    for a in sorted({r["area"] for r in picked}):
        lst = [r for r in picked if r["area"] == a]
        if len(lst) < 2:
            continue
        w(f"**{a}** ({len(lst)} điểm)\n\n")
        w("| | " + " | ".join(r["id"] for r in lst) + " |\n")
        w("|---|" + "---:|" * len(lst) + "\n")
        for r in lst:
            cells = []
            for o in lst:
                t = mat["durations"][idx8[r["id"]]][idx8[o["id"]]]
                cells.append("—" if r is o or t is None else f"{t/60:.0f}")
            w(f"| **{r['id']}** | " + " | ".join(cells) + " |\n")
        w("\n")

# ── DA CHUYEN: muc 12 "Danh sach rut gon" -> phu luc.
# Thu hang do dua tren MUC DO HIEN DIEN TREN BAN DO, tuc chat luong DU LIEU,
# khong phai chat luong trai nghiem. Do la tin hieu nghien cuu, khong phai loi
# khuyen di choi — va muc 13 ngay duoi da dung dung thu hang do lam thu tu goi
# dien, la viec that su cua no. Giu o phu luc de khong ai doc nham thanh
# "noi nay hay hon noi kia".
# Thu hang VAN duoc tinh o day — muc 9 duoi dung no lam THU TU GOI DIEN, la
# cong dung dung cua no. Chi bo phan IN ra thanh mot muc rieng.
rank = sorted(picked, key=lambda r: -r["_score"])

w(f"## {S_KIEMCHUNG}. Sổ kiểm chứng — việc cần làm\n\n")
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
    w(f"**Mục {S_HOATDONG} — cả {_HDTK['so_hoat_dong']} hoạt động đều chưa có mùa, giờ trong ngày "
      "và thời lượng.** Trống nghĩa là chưa xác minh, không nghĩa là quanh năm. "
      "Đừng khẳng định với khách cỏ hồng tháng nào hay tour đi mấy giờ khi chưa gọi.\n\n")
    w(f"**Tra đơn vị tour bằng Facebook, đừng tra tên miền** — "
      f"{_HDTK['ten_mien_chet']}/{_HDTK['tong_website_thu']} tên miền đã kiểm không còn "
      "hoạt động (`canyoningdalat.com`, `dalatjeep.com`, `toursanmaydalat.com`).\n\n")

w("**Gọi một cuộc đóng được ~9 trường.** Danh sách cần gọi, theo thứ tự ưu tiên:\n\n")
w("| # | Điểm | Điện thoại |\n|---|---|---|\n")
for i, r in enumerate([x for x in rank if x.get("tel")][:20], 1):
    w(f"| {i} | {r['id']} · {r['name']} | {r['tel']} |\n")

# ── PHU LUC NGHIEN CUU ─────────────────────────────────────────────────────
# Nam truong nay ra khoi the: chung la XUAT XU, khong phai thong tin di choi.
# Link Facebook tho, luot check-in, so nguoi theo doi, ti le de xuat, email —
# nguoi lap ke hoach khong dung cai nao trong so do, nhung nguoi kiem chung
# nguon thi can, nen chuyen chu khong xoa.
#
# `canh_bao_website` KHONG chuyen, va day la ly do: no noi rang cai URL in NGAY
# BEN DUOI no khong phai trang cua dia diem nay (crazyhouse.vn va vai truong hop
# khac). Doi no sang phu luc thi the con lai mot URL SAI khong co gi danh dau,
# cach xa loi canh bao vai trang. Mot loi canh bao phai nam canh thu no canh bao.
# Chon loc nam o `an_ngu_data.tai_nghien_cuu`, khong o day — ban truoc viet khoi
# nay truc tiep tai cho va no khong bao gio den duoc ban .docx.
_NC = _an_ngu.tai_nghien_cuu(RAW)
if _NC and _NC["hang"]:
    w("\n---\n\n## PHỤ LỤC NGHIÊN CỨU — xuất xứ, không phải thông tin đi chơi\n\n")
    w("*Các trường dưới đây đã được đưa ra khỏi hồ sơ điểm đến: người lập kế hoạch "
      "không dùng chúng, người kiểm chứng nguồn thì cần. Tra theo mã `DL-xx`.*\n\n")
    w("| ID | Điểm | Trường | Giá trị |\n|---|---|---|---|\n")
    for _i, _t, _nhan, _gt in _NC["hang"]:
        w(f"| {_i} | {_t} | {_nhan} | {_gt} |\n")
    w(f"\n*{_NC['so_diem']}/{_NC['tong']} điểm có ít nhất một trường xuất xứ.*\n\n")

    w("### Thứ hạng theo mức độ hiện diện trên bản đồ\n\n")
    w(f"⚠ Đây là chất lượng **DỮ LIỆU**, không phải chất lượng trải nghiệm. Mục {S_KIEMCHUNG} dùng "
      "đúng thứ hạng này làm thứ tự gọi điện xác minh — đó là công dụng đúng của nó. "
      "Không dùng làm lời khuyên “nơi này hay hơn nơi kia”.\n\n")
    for _lab, _seg in _NC["xep_hang"]:
        w(f"**{_lab}** ({len(_seg)}): "
          + " · ".join(f"{_i} {_t}" for _i, _t in _seg) + "\n\n")

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

# ── DANH SO TIEU MUC SAU KHI DA LOC, khong phai luc sinh ───────────────────
# `sec()` dem luc sinh, nhung vong loc ngay tren XOA CA DONG TIEU DE khi than
# cua muc do rong het (dong 1021-1022). Nen dem luc sinh van de lai lo: muc
# "Lưu ý quan trọng" nhan so 5, roi bi xoa, va moi ho so hien A.1-A.4 rồi nhay
# sang A.6 — dung cai day so nhay ma viec nay sinh ra de sua, chi dich mot buoc.
# Danh so o day thi so luon la so cua nhung muc THUC SU CON LAI.
_ds, _n = [], 0
for _ln in _out:
    if _ln.startswith("#### DL-"):
        _n = 0
    if _ln.lstrip().startswith("**A."):
        _n += 1
        _ln = _re.sub(r"\*\*A\.\d+ — ", f"**A.{_n} — ", _ln, count=1)
    _ds.append(_ln)
_out = _ds

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
Phương án trời mưa: đổi ___ sang ___ (tra cột “Mưa” ở mục {S_SOSANH} của hướng dẫn)

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
