# -*- coding: utf-8 -*-
"""Phân giải place_id KHÁCH SẠN từ luu_tru.json (OSM) — twin của resolve_quan_overture.py.

resolve_luu_tru_overture.py cũ đọc overture_dalat.json (chỉ 4 city có). City OSM (34 tỉnh mới) có
luu_tru.json từ sweep_osm_luu_tru.py → resolver này đọc file đó. rank_noi_bo_khach_san.py cần
place_id_luu_tru.json để gọi Google rating→VQS.

Chọn top-CAP theo tin_cay (= tập lên export/rank), gọi matcher 2-trục CHUNG (sweep_google_placeid.phan_giai).
CHỈ lưu place_id (ToS Google). File nằm trong raw/ (gitignored).

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/resolve_luu_tru_osm.py tourism-kb/raw/<slug>/scrape [100]
"""
import json, os, sys, io, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of
from yt_chung import luu_json, fold
from sweep_google_placeid import phan_giai, doc_khoa, NGHI_GIAY

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 100
SLUG = slug_of(RAW)
SRC = os.path.join(RAW, "luu_tru.json")
OUT = os.path.join(RAW, "place_id_luu_tru.json")

khoa, nguon = doc_khoa()
if not khoa:
    print("thiếu GOOGLE_MAPS_API_KEY"); sys.exit(1)
print("khoá đọc từ: %s  (giá trị không in ra)\n" % nguon)

if not os.path.exists(SRC):
    print("không thấy %s (chạy sweep_osm_luu_tru.py trước)" % SRC); sys.exit(1)
cs = json.load(io.open(SRC, encoding="utf-8")).get("co_so", [])

cand = [c for c in cs if c.get("lat") is not None and c.get("lon") is not None]
cand.sort(key=lambda c: c.get("tin_cay") or 0.0, reverse=True)
seen, muc = {}, []
for c in cand:
    key = (fold(c["ten"]), round(c["lat"], 4), round(c["lon"], 4))
    if key in seen:
        continue
    seen[key] = 1
    muc.append(c)
    if len(muc) >= CAP:
        break
print("%s — %d cơ sở (top %d theo confidence = tập rank), phân giải place_id (2 trục)...\n"
      % (SLUG, len(muc), CAP))

ra, hong = [], []
for i, c in enumerate(muc, 1):
    pid, ly, so_nha_lech = phan_giai(
        {"ten": c["ten"], "dia_chi": c.get("dia_chi"), "lat": c["lat"], "lon": c["lon"]}, khoa)
    lop = "lưu trú · " + (c.get("loai") or "")
    if pid:
        d = {"lop": lop, "ten": c["ten"], "place_id": pid}
        if so_nha_lech:
            d["so_nha_lech"] = True
        ra.append(d)
        print("  %3d ✓ %-34s %s" % (i, c["ten"][:34], pid))
    else:
        hong.append({"lop": lop, "ten": c["ten"], "ly_do": ly})
    if i % 25 == 0:
        print("  ...%d/%d (đã phân giải %d)" % (i, len(muc), len(ra)), flush=True)
    time.sleep(NGHI_GIAY)

cu = []
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8")).get("co_so", [])
    except Exception:
        print("DỪNG: %s tồn tại nhưng KHÔNG đọc được. Không ghi đè." % OUT); sys.exit(1)
goi_ra = {"phien_ban": 1, "nguon": "osm", "dia_diem": SLUG, "co_so": ra, "chua_phan_giai": hong}
if cu and len(ra) < len(cu):
    bak = OUT.replace(".json", ".dorang-%dcoso.json" % len(ra))
    luu_json(bak, goi_ra)
    print("\n⚠ Lần này phân giải %d < %d đã có. KHÔNG ghi đè — kết quả dở: %s" % (len(ra), len(cu), bak))
else:
    luu_json(OUT, goi_ra)
    print("\nsaved -> %s" % OUT)
print("═" * 62)
print("phân giải được %d/%d (%.0f%%) · %d chưa phân giải"
      % (len(ra), len(muc), 100 * len(ra) / max(len(muc), 1), len(hong)))
print("raw/ chỉ chứa place_id — không rating, không tên/địa chỉ từ Google.")
