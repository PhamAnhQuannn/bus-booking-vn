# -*- coding: utf-8 -*-
"""Dựng luu_tru.json cho city KHÔNG có sổ đăng ký nhà nước (Overture-only, bulk, $0).

Đà Lạt dựng luu_tru.json từ sổ CSDL nhà nước (sweep_luu_tru.py — có giá/hạng sao/thẩm định).
City khác (Nha Trang, Đà Nẵng…) không có registry → lấy TẤT CẢ lodging trong overture_dalat.json
(mỗi city data riêng dù tên file), chỉ field CẦN THIẾT, số lượng lớn. export_planner.py đọc luu_tru.json
→ populate khach-san.json (pin bằng lat/lon). Giá/hạng sao/thẩm định/số phòng = NULL (Overture không có
— hợp lệ, ks_rec chịu được: phan_khuc→None, provenance→SRC_OT).

KHÁC resolve_luu_tru_overture.py: script đó cap 150 gần tâm để RESOLVE place_id (tốn Google); đây là
LIỆT KÊ bulk (0 gọi API) nên UNCAPPED — "số lượng đủ nhiều".

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_luu_tru_overture.py tourism-kb/raw/<slug>/scrape
"""
import json, os, sys, io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import math, re
from dia_diem_config import slug_of, cfg
from yt_chung import luu_json, fold

# Overture category = lưu trú (giống LODGE trong resolve_luu_tru_overture.py). BỎ hotel_supply_service/hotel_bar.
LODGE = {"hotel", "accommodation", "resort", "hostel", "motel", "bed_and_breakfast",
         "guest_house", "inn", "beach_resort", "holiday_rental_home"}
# De-noise: BO mis-tag ro (Overture gan nham category=hotel cho quan/review/dich vu).
NAME_BO = re.compile(r"địa điểm ăn uống|\breview\b|quán ăn|quán cà phê|\bcoffee\b|massage|"
                     r"bến xe|sân bay|bệnh viện|\btrường\b|cho thuê xe|thuê xe máy", re.I)

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 500    # cap N gan tam nhat (de-noise duoi 2900); 0 = uncapped
SLUG = slug_of(RAW)
CLON, CLAT = cfg(RAW)["center"]                          # cfg luu (lon, lat)
OVT = os.path.join(RAW, "overture_dalat.json")        # tên cố định; dữ liệu của chính city
OUT = os.path.join(RAW, "luu_tru.json")


def met(la1, lo1, la2, lo2):
    return math.hypot((la1 - la2) * 111320, (lo1 - lo2) * 111320 * math.cos(math.radians(la1)))


def dia_chi_sach(a):
    """Overture address phần lớn None/rác. Chỉ giữ khi có chữ số (tín hiệu số nhà), else None."""
    if isinstance(a, str) and any(c.isdigit() for c in a):
        return a.strip()
    return None


def _dau(lst):
    return lst[0] if isinstance(lst, list) and lst else None


if not os.path.exists(OVT):
    print("không thấy %s" % OVT); sys.exit(1)
ovt = json.load(io.open(OVT, encoding="utf-8"))

seen, co_so, bo_ten = {}, [], 0
for r in ovt:
    if r.get("category") not in LODGE:
        continue
    ten = (r.get("name") or "").strip()
    la, lo = r.get("lat"), r.get("lon")
    if len(ten) < 3 or la is None or lo is None:
        continue
    if NAME_BO.search(ten):                             # mis-tag ro -> bo
        bo_ten += 1
        continue
    key = (fold(ten), round(la, 4), round(lo, 4))
    if key in seen:
        continue
    seen[key] = 1
    co_so.append({
        "ten": ten,
        "loai": r.get("category"),
        "lat": la, "lon": lo,
        "dia_chi": dia_chi_sach(r.get("address")),
        "dien_thoai": _dau(r.get("phones")),
        "facebook": _dau(r.get("socials")),
        "tin_cay": r.get("confidence"),
        # gia_min/gia_max/tham_dinh/so_phong/da_dong_cua: KHÔNG có ở Overture -> để export_planner null-hoá
    })

tong = len(co_so)
# cap N gan tam nhat (de-noise: bo duoi noise Overture; ranked ~74 van float top o export)
if CAP and tong > CAP:
    co_so.sort(key=lambda c: met(CLAT, CLON, c["lat"], c["lon"]))
    co_so = co_so[:CAP]

goi_ra = {"nguon": "overture", "dia_diem": SLUG, "co_so": co_so, "dong_cua_ngoai_dang_ky": []}

# guard: chi chan ket qua RONG (loi doc overture), KHONG chan cap co chu dich
if not co_so:
    print("DỪNG: 0 cơ sở — kiểm overture. Không ghi đè."); sys.exit(1)
luu_json(OUT, goi_ra)
print("%s — %d/%d cơ sở lưu trú (bỏ %d mis-tag theo tên · cap %s gần tâm) -> %s"
      % (SLUG, len(co_so), tong, bo_ten, CAP or "—", OUT))
_dc = sum(1 for c in co_so if c["dia_chi"])
_dt = sum(1 for c in co_so if c["dien_thoai"])
print("   địa chỉ %d · điện thoại %d · toạ độ %d (100%%). Giá/sao/thẩm định = null (Overture không có)."
      % (_dc, _dt, len(co_so)))
