# -*- coding: utf-8 -*-
"""Phan giai place_id KHACH SAN tu Overture — cho city KHONG co so dang ky nha nuoc.

Đà Lạt dung `sweep_luu_tru.py` (doc csdl_parsed.json — dang ky Cuc Du lich, chi DL).
City khac (Nha Trang, Đà Nẵng…) khong co registry đó, nhung `overture_dalat.json` cua
tung city CO san lodging (name + toa do). Script nay:
  1. loc category lodging trong overture, gan lop "lưu trú · <category>",
  2. thu gon ve LÕI: gan trung tam cfg nhat, cap N (mac dinh 150) — chan chi phi,
  3. goi matcher HAI-TRUC da kiem dinh cua sweep_google_placeid (`phan_giai`) — IMPORT
     lai, KHONG chep: luat chong nham dinh danh chi viet mot lan,
  4. ghi place_id_luu_tru.json (CHI place_id, giong cac file place_id khac).

`rank_noi_bo_khach_san.py` doc file nay (đã them vao PID_FILES) roi xep hang VQS.

CHI LUU place_id (ToS Google) — khong rating/ten/dia chi Google. File nam trong raw/
(gitignored). Overture address phan lon rong/rac nen chi dua vao TRUC TOA DO (locationBias
+ nhan <=100 m); address chi truyen khi co chu so (tin hieu so nha).

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/resolve_luu_tru_overture.py tourism-kb/raw/<slug>/scrape [N]
"""
import json, os, sys, io, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of, cfg
from yt_chung import luu_json, fold
from sweep_google_placeid import phan_giai, doc_khoa, met, NGHI_GIAY

# Overture category = luu tru (BO hotel_supply_service = dich vu cung ung, hotel_bar = quan).
LODGE = {"hotel", "accommodation", "resort", "hostel", "motel", "bed_and_breakfast",
         "guest_house", "inn", "beach_resort", "holiday_rental_home"}

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 150
SLUG = slug_of(RAW)
C = cfg(RAW)
CLON, CLAT = C["center"]                                  # cfg luu (lon, lat)
OUT = os.path.join(RAW, "place_id_luu_tru.json")
OVT = os.path.join(RAW, "overture_dalat.json")            # ten co dinh; du lieu cua chinh city


def dia_chi_sach(a):
    """Overture address phan lon None/rac. Chi dung khi co chu so (tin hieu so nha)."""
    if isinstance(a, str) and any(c.isdigit() for c in a):
        return a.strip()
    return None


khoa, nguon = doc_khoa()
if not khoa:
    print("thiếu GOOGLE_MAPS_API_KEY"); sys.exit(1)
print("khoá đọc từ: %s  (giá trị không in ra)\n" % nguon)

if not os.path.exists(OVT):
    print("không thấy %s" % OVT); sys.exit(1)
ovt = json.load(io.open(OVT, encoding="utf-8"))

# gom lodging co ten + toa do; dedup theo fold(ten)+toa do tron; giu ban ghi gan tam nhat
seen, cand = {}, []
for r in ovt:
    if r.get("category") not in LODGE:
        continue
    ten = (r.get("name") or "").strip()
    la, lo = r.get("lat"), r.get("lon")
    if len(ten) < 4 or la is None or lo is None:
        continue
    key = (fold(ten), round(la, 4), round(lo, 4))
    if key in seen:
        continue
    seen[key] = 1
    cand.append({"ten": ten, "dia_chi": dia_chi_sach(r.get("address")),
                 "lat": la, "lon": lo,
                 "lop": "lưu trú · " + r["category"],
                 "_m": met(CLAT, CLON, la, lo)})

cand.sort(key=lambda x: x["_m"])
muc = cand[:CAP]
print("%s — %d lodging (Overture, dedup), lấy %d gần trung tâm nhất (cap %d)"
      % (SLUG, len(cand), len(muc), CAP))
if muc:
    print("   xa nhất trong lô: %.1f km" % (muc[-1]["_m"] / 1000))
print("   phân giải place_id qua Google Text Search (2 trục: tên + vị trí)...\n")

ra, hong = [], []
for i, m in enumerate(muc, 1):
    pid, ly, so_nha_lech = phan_giai(m, khoa)
    if pid:
        d = {"lop": m["lop"], "ten": m["ten"], "place_id": pid}
        if so_nha_lech:
            d["so_nha_lech"] = True
        ra.append(d)
        print("  %3d ✓ %-34s %s" % (i, m["ten"][:34], pid))
    else:
        hong.append({"lop": m["lop"], "ten": m["ten"], "ly_do": ly})
    if i % 25 == 0:
        print("  ...%d/%d (đã phân giải %d)" % (i, len(muc), len(ra)), flush=True)
    time.sleep(NGHI_GIAY)

# chong ghi de moc tot bang moc do: neu co file cu nhieu hon ma lan nay it hon -> khong de len
cu = []
if os.path.exists(OUT):
    try:
        cu = json.load(io.open(OUT, encoding="utf-8")).get("co_so", [])
    except Exception:
        print("DỪNG: %s tồn tại nhưng KHÔNG đọc được. Không ghi đè." % OUT); sys.exit(1)
goi_ra = {"phien_ban": 1, "nguon": "overture", "dia_diem": SLUG,
          "co_so": ra, "chua_phan_giai": hong}
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
