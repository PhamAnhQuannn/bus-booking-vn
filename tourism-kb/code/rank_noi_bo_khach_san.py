# -*- coding: utf-8 -*-
"""⚠ NỘI BỘ — file sinh ra CẤM đưa vào sản phẩm/website/khách. ⚠

Xếp hạng KHÁCH SẠN / lưu trú theo Google (sao + lượt) LIVE rồi GHI ra file NỘI BỘ để
tiện tự chọn lịch trình. Bản song sinh của rank_noi_bo_nha_hang.py — cùng công thức VQS,
chỉ ĐẢO filter: GIỮ lưu trú, BỎ quán ăn.

NGOẠI LỆ CÓ CHỦ ĐÍCH với doctrine no-persist (xep_hang_song.py in-ra-không-ghi): lưu NỘI BỘ
vì file gitignored + không ship. LƯU Ý: "sao" đây là Google user-rating (hợp lệ) — KHÁC hạng
sao NHÀ NƯỚC (0/420 cơ sở có, nguồn 403). Sản phẩm khách vẫn "quy ước giá" + "Chưa xác minh".

RÀNG BUỘC: chỉ ghi vào raw/<slug>/noi-bo/ (đã gitignored, G8 chặn commit). KHÔNG đụng
export/ · output/ · docx khách.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/rank_noi_bo_khach_san.py tourism-kb/raw/<slug>/scrape
"""
import json, os, sys, io, time, math, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of

N_MIN = 5                                   # sàn lượt tối thiểu; dưới -> "chưa đủ đánh giá"


def vqs(R, n):
    """Volume-Quality Score = √n × q(R)³ ; q = clamp((R-2.5)/2.5, 0, 1).
    Ưu tiên SỐ LƯỢT (volume trội nhưng sub-linear); q³ lồi dìm rating tệ, vẫn phân
    biệt 4–5★. Cùng công thức với rank nhà hàng — chốt qua debate 6-agent."""
    q = max(0.0, min(1.0, (R - 2.5) / 2.5)) ** 3
    return math.sqrt(n) * q

RAW = sys.argv[1]                                    # raw/<slug>/scrape (đọc place_id)
SLUG = slug_of(RAW)
CITY_DIR = os.path.dirname(RAW.rstrip("/\\"))        # raw/<slug>
OUT = os.path.join(CITY_DIR, "noi-bo", "rank_noi_bo_khach_san.json")   # NỘI BỘ, sibling scrape/
API = "https://places.googleapis.com/v1/places/"
MASK = "rating,userRatingCount,primaryType"          # +primaryType de loai place_id mis-resolve
PID_FILES = ["place_id_hxh.json", "place_id.json",   # DL: hxh=54 luu tru; place_id=13 hotel + 12 quan
             "place_id_luu_tru.json"]                # NT/DN: resolve tu Overture (absent o DL -> vo hai)

# place_id mis-resolve sang quan an -> bo (bao hiem re; lop da loc phan lon).
FOOD = {"restaurant", "cafe", "coffee_shop", "bar", "bakery", "meal_takeaway",
        "meal_delivery", "fast_food_restaurant", "pub", "food_court", "eat_and_drink"}


def doc_khoa():
    k = os.environ.get("GOOGLE_MAPS_API_KEY")
    if k and k.strip():
        return k.strip()
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("GOOGLE_MAPS_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v
    return None


def goi_danh_gia(place_id, khoa):
    req = urllib.request.Request(API + place_id,
                                 headers={"X-Goog-Api-Key": khoa, "X-Goog-FieldMask": MASK})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        return d.get("rating"), d.get("userRatingCount"), d.get("primaryType")
    except urllib.error.HTTPError as e:
        if e.code in (429, 403):
            raise
        return None, None, None
    except Exception:
        return None, None, None


def load(fn):
    p = os.path.join(RAW, fn)
    return json.load(io.open(p, encoding="utf-8")) if os.path.exists(p) else {}


khoa = doc_khoa()
if not khoa:
    print("thiếu GOOGLE_MAPS_API_KEY"); sys.exit(1)

# gom KHACH SAN co place_id, dedup; GIU record lop bat dau "lưu trú", bo "quán ăn"
seen, ks, bo_quan = set(), [], 0
for fn in PID_FILES:
    for r in (load(fn).get("co_so") or []):
        pid = r.get("place_id")
        if pid and pid not in seen:
            seen.add(pid)
            if not (r.get("lop") or "").startswith("lưu trú"):
                bo_quan += 1
                continue
            ks.append({"ten": r["ten"], "place_id": pid, "dia_chi": r.get("dia_chi"), "lop": r.get("lop")})
print("%s — %d khách sạn (đã bỏ %d quán ăn theo lop), gọi Place Details (%s)" % (SLUG, len(ks), bo_quan, MASK))

ra, hong, mis = [], 0, 0
for i, r in enumerate(ks, 1):
    try:
        R, n, ptype = goi_danh_gia(r["place_id"], khoa)
    except urllib.error.HTTPError as e:
        print("DỪNG dòng %d: HTTP %d — hết hạn mức. Đã lấy %d, KHÔNG ghi file dở." % (i, e.code, len(ra)))
        sys.exit(1)
    if ptype in FOOD:                          # place_id mis-resolve sang quan an -> bo
        mis += 1
    elif R is None:
        hong += 1
    else:
        ra.append({"ten": r["ten"], "place_id": r["place_id"], "dia_chi": r.get("dia_chi"),
                   "R": R, "n": n, "vqs": vqs(R, n)})
    if i % 25 == 0:
        print("  ...%d/%d" % (i, len(ks)), flush=True)
    time.sleep(0.08)

if not ra:
    print("không lấy được đánh giá nào"); sys.exit(1)
xep_duoc = sorted([r for r in ra if r["n"] >= N_MIN],
                  key=lambda r: (-r["vqs"], -r["n"], -r["R"], r["ten"]))   # tie: lượt->rating->tên
chua_du = [r for r in ra if r["n"] < N_MIN]
LAY_LUC = time.strftime("%d/%m/%Y %H:%M")


def rec(r, rank):
    return {"rank": rank, "ten": r["ten"], "R": r["R"], "n": r["n"], "vqs": round(r["vqs"], 3),
            "place_id": r["place_id"], "dia_chi": r.get("dia_chi"),
            "google_maps_url": "https://www.google.com/maps/place/?q=place_id:" + r["place_id"]}


out = {
    "_CANH_BAO": "NỘI BỘ — CẤM đưa vào sản phẩm/website/khách. Google content, không phát hành. "
                 "Rating+lượt lấy live, cũ theo thời gian — dùng để TỰ chọn lịch trình. "
                 "★ là Google user-rating, KHÔNG phải hạng sao nhà nước.",
    "cong_thuc": "VQS = sqrt(n) * clamp((R-2.5)/2.5, 0, 1)^3 ; gate n>=%d" % N_MIN,
    "lay_luc": LAY_LUC, "dia_diem": SLUG,
    "xep_hang": [rec(r, i) for i, r in enumerate(xep_duoc, 1)],
    "chua_du_danh_gia": [{"ten": r["ten"], "R": r["R"], "n": r["n"], "place_id": r["place_id"]}
                         for r in sorted(chua_du, key=lambda r: -(r["n"] or 0))],
    "khong_lay_duoc": hong,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
tmp = OUT + ".tmp"
json.dump(out, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, OUT)

print("\nXẾP HẠNG VQS khách sạn (nội bộ) — %d cơ sở (n≥%d) · %d chưa đủ (n<%d) · %d không lấy được"
      % (len(xep_duoc), N_MIN, len(chua_du), N_MIN, hong))
print("  đã loại: %d quán ăn theo lop + %d place_id mis-resolve theo Google primaryType" % (bo_quan, mis))
print("Top 10:")
for r in out["xep_hang"][:10]:
    print("  %2d %-34s %.1f★ %6d lượt  VQS=%.2f" % (r["rank"], r["ten"][:34], r["R"], r["n"], r["vqs"]))
print("\nghi -> %s  (NỘI BỘ, gitignored)" % OUT)
