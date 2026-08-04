# -*- coding: utf-8 -*-
"""Tim link Facebook cua 36 diem, bang cach khop nguoc ve hang Overture goc.

Vi sao phai khop lai: buoc hop nhat (merged_dalat.json) da BO cot `socials` —
1.422 dong hop nhat, 0 dong con socials, trong khi overture_dalat.json co 20.847.
Du lieu chua bao gio mat, chi la khong duoc mang sang. Day la lan thu tu trong
du an nay cau tra loi nam san tren dia ma khong ai mo ra.

KHONG doan. Diem nao khong khop duoc thi bao khong khop, khong lay dai hang
gan nhat — mot trang Facebook gan sai cho con te hon la khong co trang nao.
"""
import json, os, sys, io, math, re, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "fb_targets.json")

MAX_M = 400          # ban kinh khop toi da


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


GENERIC = ("khu du lich", "kdl", "du lich", "thanh pho", "tp", "da lat", "dalat",
           "lam dong", "waterfall", "museum", "tea plantation", "viet nam")
# Tu roi rac tao nen cac cum tren. Mot ten gom TOAN nhung tu nay thi khong tro
# den dia diem nao ca — no chi la ten thanh pho/tinh.
GENERIC_TOKENS = {t for g in GENERIC for t in g.split()}


def norm(name):
    s = fold(name)
    for ch in ",.;:/&+":
        s = s.replace(ch, " ")
    s = s.split(" - ")[0]
    s = s.split("(")[0]
    for g in GENERIC:
        cut = " ".join(s.replace(g, " ").split())
        if len(cut) >= 10:
            s = cut
    return " ".join(s.split())


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))

# Tu chung xuat hien khap noi khong phan biet duoc dia diem nao voi dia diem nao.
# Lay tu TAN SUAT THUC TE chu khong viet tay — danh sach viet tay tung bo sot
# "lam"/"vien"/"lat" va gay hop nhat nham (su co 28/07).
_df = Counter()
for r in ovt:
    _df.update(set(norm(r.get("name") or "").split()))
_DF_MAX = max(30, int(0.005 * len(ovt)))
STOP = {t for t, c in _df.items() if c > _DF_MAX} | {
    "chua", "nha", "tho", "thac", "ho", "dinh", "khu", "du", "lich", "vuon",
    "hoa", "bao", "tang", "quan", "nui", "doi", "suoi", "lang", "cho", "ga"}


def kw(n):
    return {t for t in n.split() if len(t) > 2 and t not in STOP}


def score_match(p, r, d):
    """Diem cang cao cang chac. None = khong khop."""
    na, nb = norm(p["name"]), norm(r.get("name") or "")
    if not na or not nb:
        return None
    ka, kb = kw(na), kw(nb)
    if na == nb:
        return 100 - d / 100.0
    # Chuoi con MOT MINH khong du. "Cho Da Lat" chua "Da Lat", nen no bat vao
    # trang "Da Lat - Thanh Pho Ngan Hoa Va Suong Mu" — trang gioi thieu thanh
    # pho, khong phai cai cho.
    #
    # Loc bang TU DUNG THEO TAN SUAT thi sai huong: "lam", "vien", "truong" deu
    # tan suat cao nen "Quang truong Lam Vien" bi xoa sach va mat mot khop dung.
    # Dieu phan biet DL-17 khong phai tan suat ma la: ten NGAN HON gom TOAN tu
    # chung dia danh, khong con danh tu rieng nao.
    if len(na) > 6 and (na in nb or nb in na):
        short = (na if len(na) <= len(nb) else nb).split()
        if all(t in GENERIC_TOKENS for t in short):
            return None
        return 60 - d / 100.0
    if len(ka & kb) >= 2:
        return 30 - d / 100.0
    return None


FB = re.compile(r"facebook\.com/", re.I)

out, no_row, no_fb = [], [], []
for p in picked:
    best, best_s = None, -1e9
    for r in ovt:
        if abs(r["lat"] - p["lat"]) > 0.006 or abs(r["lon"] - p["lon"]) > 0.006:
            continue                      # loc tho truoc khi tinh haversine
        d = hav(p, r)
        if d > MAX_M:
            continue
        s = score_match(p, r, d)
        if s is not None and s > best_s:
            best, best_s = r, s
    if best is None:
        no_row.append((p["id"], p["name"]))
        continue
    socials = [u for u in (best.get("socials") or []) if FB.search(u)]
    if not socials:
        no_fb.append((p["id"], p["name"]))
        continue
    out.append({
        "id": p["id"], "ten": p["name"], "lat": p["lat"], "lon": p["lon"],
        "ten_overture": best.get("name"), "diem_khop": round(best_s, 1),
        "khoang_cach_m": round(hav(p, best)),
        "fb_url": socials[0],
        "dien_thoai_overture": (best.get("phones") or [None])[0],
        "tin_cay_overture": best.get("confidence"),
    })

json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"{len(picked)} diem -> {len(out)} co link Facebook")
print(f"  khong khop duoc hang Overture nao: {len(no_row)}")
for pid, nm in no_row:
    print(f"    {pid}  {nm}")
print(f"  khop duoc nhung trang khong co Facebook: {len(no_fb)}")
for pid, nm in no_fb:
    print(f"    {pid}  {nm}")
print()
print(f"{'ID':7s}{'Ten':30s}{'Diem':>6s}{'m':>5s}  Facebook")
for r in sorted(out, key=lambda x: x["diem_khop"]):
    print(f"{r['id']:7s}{r['ten'][:28]:30s}{r['diem_khop']:6.1f}{r['khoang_cach_m']:5d}  {r['fb_url']}")
print(f"\nsaved -> {OUT}")
