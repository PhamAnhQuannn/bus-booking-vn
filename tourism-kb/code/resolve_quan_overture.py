# -*- coding: utf-8 -*-
"""Phân giải place_id NHÀ HÀNG từ nha_hang.json — cho city không có bundle place_id DL.

Twin của resolve_luu_tru_overture.py, nhưng cho quán ăn. rank_noi_bo_nha_hang.py cần place_id để gọi
Google rating→VQS; NT/DN không có place_id_quan_hxh.json/place_id.json (neo Hồ Xuân Hương / bundle DL).

CHỐT (cap-before-sort): export_planner.py chọn nhà hàng = sort(tin_cay desc) rồi cắt top TOP_NHA_HANG(250)
TRƯỚC khi reorder. Nên resolver này chọn ĐÚNG tập đó (top-CAP theo tin_cay), KHÔNG phải "N gần tâm" —
để place_id/VQS phủ đúng tập sẽ lên export, không phí quota ngoài cửa sổ export.

Đọc nha_hang.json (đã lọc ăn uống), KHÔNG re-derive AN_UONG. Import matcher 2-trục đã kiểm định.
CHỈ lưu place_id (ToS Google). File nằm trong raw/ (gitignored).

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/resolve_quan_overture.py tourism-kb/raw/<slug>/scrape [250]
"""
import json, os, sys, io, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of
from yt_chung import luu_json, fold
from sweep_google_placeid import phan_giai, doc_khoa, NGHI_GIAY

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 250   # = export_planner.TOP_NHA_HANG (giữ đồng bộ)
SLUG = slug_of(RAW)
SRC = os.path.join(RAW, "nha_hang.json")
OUT = os.path.join(RAW, "place_id_quan.json")

khoa, nguon = doc_khoa()
if not khoa:
    print("thiếu GOOGLE_MAPS_API_KEY"); sys.exit(1)
print("khoá đọc từ: %s  (giá trị không in ra)\n" % nguon)

if not os.path.exists(SRC):
    print("không thấy %s (chạy sweep_nha_hang.py trước)" % SRC); sys.exit(1)
quan = json.load(io.open(SRC, encoding="utf-8")).get("quan", [])

# Replicate export_planner.py:337-343 selection: có toạ độ + chưa đóng cửa, sort tin_cay desc, top CAP.
cand = [q for q in quan if q.get("lat") is not None and q.get("lon") is not None and not q.get("da_dong_cua")]
cand.sort(key=lambda q: q.get("tin_cay") or 0.0, reverse=True)
seen, muc = {}, []
for q in cand:
    key = (fold(q["ten"]), round(q["lat"], 4), round(q["lon"], 4))
    if key in seen:
        continue
    seen[key] = 1
    muc.append(q)
    if len(muc) >= CAP:
        break
print("%s — %d quán (top %d theo confidence = tập export), phân giải place_id (2 trục)...\n"
      % (SLUG, len(muc), CAP))

ra, hong = [], []
for i, q in enumerate(muc, 1):
    pid, ly, so_nha_lech = phan_giai(
        {"ten": q["ten"], "dia_chi": q.get("dia_chi"), "lat": q["lat"], "lon": q["lon"]}, khoa)
    lop = "quán ăn · " + (q.get("hang_muc") or "")
    if pid:
        d = {"lop": lop, "ten": q["ten"], "place_id": pid}
        if so_nha_lech:
            d["so_nha_lech"] = True
        ra.append(d)
        print("  %3d ✓ %-34s %s" % (i, q["ten"][:34], pid))
    else:
        hong.append({"lop": lop, "ten": q["ten"], "ly_do": ly})
    if i % 25 == 0:
        print("  ...%d/%d (đã phân giải %d)" % (i, len(muc), len(ra)), flush=True)
    time.sleep(NGHI_GIAY)

cu = []
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8")).get("co_so", [])
    except Exception:
        print("DỪNG: %s tồn tại nhưng KHÔNG đọc được. Không ghi đè." % OUT); sys.exit(1)
goi_ra = {"phien_ban": 1, "nguon": "overture", "dia_diem": SLUG, "co_so": ra, "chua_phan_giai": hong}
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
