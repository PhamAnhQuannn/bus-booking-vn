# -*- coding: utf-8 -*-
"""⚠ NỘI BỘ — file sinh ra CẤM đưa vào sản phẩm/website/khách. ⚠

Xếp hạng nhà hàng theo Google (sao + lượt) LIVE rồi GHI ra file NỘI BỘ để tiện tự
chọn lịch trình. Đây là NGOẠI LỆ CÓ CHỦ ĐÍCH với doctrine no-persist (xep_hang_song.py
in-ra-không-ghi): user cho phép lưu NỘI BỘ vì (b) "bản in cũ đánh lừa người đọc" hết
hiệu lực khi không ai đọc ngoài mình; (a) ToS rủi ro thấp khi file gitignored + không ship.

RÀNG BUỘC: chỉ ghi vào raw/<slug>/ (đã gitignored, G8 chặn commit). KHÔNG đụng
export/ · output/ · docx. Sản phẩm khách vẫn "Chưa xác minh" + link live.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/rank_noi_bo_nha_hang.py tourism-kb/raw
"""
import json, os, sys, io, time, math, re, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of

N_MIN = 5                                   # sàn lượt tối thiểu; dưới -> "chưa đủ đánh giá"


def vqs(R, n):
    """Volume-Quality Score = √n × q(R)³ ; q = clamp((R-2.5)/2.5, 0, 1).
    Ưu tiên SỐ LƯỢT (volume trội nhưng sub-linear); q³ lồi dìm rating tệ, vẫn phân
    biệt 4–5★. Thay Wilson (bác vì xếp quán 167-lượt/5★ #1) — chốt qua debate 6-agent."""
    q = max(0.0, min(1.0, (R - 2.5) / 2.5)) ** 3
    return math.sqrt(n) * q

RAW = sys.argv[1]                                    # raw/<slug>/scrape (đọc place_id)
SLUG = slug_of(RAW)
CITY_DIR = os.path.dirname(RAW.rstrip("/\\"))        # raw/<slug>
OUT = os.path.join(CITY_DIR, "noi-bo", "rank_noi_bo_nha_hang.json")   # NỘI BỘ, sibling scrape/
API = "https://places.googleapis.com/v1/places/"
MASK = "rating,userRatingCount,primaryType"          # +primaryType de loc khach san (cung SKU tier)
PID_FILES = ["place_id_quan_hxh.json", "place_id.json",  # DL: bundle Ho Xuan Huong + huongdan
             "place_id_quan.json"]                       # NT/DN: resolve tu Overture (absent o DL -> vo hai)

# Loc KHACH SAN khoi list quan an (place_id_quan_hxh resolve lot vai khach san).
HOTEL_TEN = re.compile(r"khách sạn|hotel|resort|homestay|nhà nghỉ|hostel|motel|"
                       r"guesthouse|guest house|\bvilla\b|căn hộ|condotel|bungalow|lodge", re.I)
LODGING = {"lodging", "hotel", "motel", "resort_hotel", "guest_house", "bed_and_breakfast",
           "hostel", "campground", "inn", "cottage", "extended_stay_hotel", "farmstay",
           "japanese_inn", "budget_japanese_inn", "private_guest_room", "rv_park",
           "camping_cabin", "mobile_home_park", "apartment_complex", "apartment_building"}


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

# gom quan co place_id, dedup; BO khach san theo ten (khong ton API fetch)
seen, quan, ks_ten = set(), [], 0
for fn in PID_FILES:
    for r in (load(fn).get("co_so") or []):
        pid = r.get("place_id")
        if pid and pid not in seen:
            seen.add(pid)
            if HOTEL_TEN.search(r.get("ten") or ""):
                ks_ten += 1
                continue
            quan.append({"ten": r["ten"], "place_id": pid, "dia_chi": r.get("dia_chi"), "lop": r.get("lop")})
print("%s — %d quán (đã bỏ %d khách sạn theo tên), gọi Place Details (%s)" % (SLUG, len(quan), ks_ten, MASK))

ra, hong, ks_type = [], 0, 0
for i, r in enumerate(quan, 1):
    try:
        R, n, ptype = goi_danh_gia(r["place_id"], khoa)
    except urllib.error.HTTPError as e:
        print("DỪNG dòng %d: HTTP %d — hết hạn mức. Đã lấy %d, KHÔNG ghi file dở." % (i, e.code, len(ra)))
        sys.exit(1)
    if ptype in LODGING:                       # khách sạn/lưu trú theo Google -> bỏ
        ks_type += 1
    elif R is None:
        hong += 1
    else:
        ra.append({"ten": r["ten"], "place_id": r["place_id"], "dia_chi": r.get("dia_chi"),
                   "R": R, "n": n, "vqs": vqs(R, n)})
    if i % 25 == 0:
        print("  ...%d/%d" % (i, len(quan)), flush=True)
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
                 "Rating+lượt lấy live, cũ theo thời gian — dùng để TỰ chọn lịch trình.",
    "cong_thuc": "VQS = sqrt(n) * clamp((R-2.5)/2.5, 0, 1)^3 ; gate n>=%d" % N_MIN,
    "lay_luc": LAY_LUC, "dia_diem": SLUG,
    "xep_hang": [rec(r, i) for i, r in enumerate(xep_duoc, 1)],
    "chua_du_danh_gia": [{"ten": r["ten"], "R": r["R"], "n": r["n"], "place_id": r["place_id"]}
                         for r in sorted(chua_du, key=lambda r: -(r["n"] or 0))],
    "khong_lay_duoc": hong,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)     # noi-bo/ chưa có ở tỉnh mới -> tạo
tmp = OUT + ".tmp"
json.dump(out, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, OUT)

print("\nXẾP HẠNG VQS (nội bộ) — %d quán (n≥%d) · %d chưa đủ (n<%d) · %d không lấy được"
      % (len(xep_duoc), N_MIN, len(chua_du), N_MIN, hong))
print("  đã loại khách sạn: %d theo tên + %d theo Google primaryType" % (ks_ten, ks_type))
print("Top 10:")
for r in out["xep_hang"][:10]:
    print("  %2d %-34s %.1f★ %6d lượt  VQS=%.2f" % (r["rank"], r["ten"][:34], r["R"], r["n"], r["vqs"]))
print("\nghi -> %s  (NỘI BỘ, gitignored)" % OUT)
