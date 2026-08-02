# -*- coding: utf-8 -*-
"""P2c — giu lai phan CO THE BAO VE duoc tu tour_sites.json. Khong cham mang.

LOI THIET KE CUA BUOC TRICH, va vi sao script nay ton tai:

Bo trich chay theo TRUONG tren toan trang, khong theo TUNG TOUR. Mot trang liet
ke 8 tour cho ra 8 thoi luong va 12 muc gia don chung mot ro, va khong gi noi
gia nao thuoc tour nao:

    DV-27  gia = 350.000đ … 1.620.000đ   (9 muc, 3 tour)
    DV-02  gio = "08:30", "11 giờ 30", "3 giờ", "3 h"
           -> "11 giờ 30" la THOI LUONG bi tron vao cot GIO DON
    DV-36  gia = "3\\nTr"  (vo qua dong),  gio = "3:"  (khong phai gio)

Thu do TRONG GIONG du lieu ma khong phai du lieu. Gan mot gia sai vao mot tour
con te hon khong co gia nao.

NEN:
  GIU   ten tour        — sach, doc duoc, kiem duoc
  GIU   khoang gia CUA DON VI (min-max), goi dung ten la khoang, khong phai gia tour
  BO    gio don, thoi luong — khong quy duoc ve tung tour
  BO    tat ca gia tri cua site chua xac minh duoc danh tinh

Chay:  python scripts/tourism/parse_tour_sites.py <thu-muc-raw>
"""
import json, os, sys, io, re

RAW = sys.argv[1]
OUT = os.path.join(RAW, "tour_sites_sach.json")

rows = json.load(io.open(os.path.join(RAW, "tour_sites.json"), encoding="utf-8"))


def tien(s):
    """'1.180.000đ' -> 1180000 · '650k' -> 650000 · '1.5 triệu' -> 1500000.

    Tra None khi khong chac — '3\\nTr' va '280,000đ' viet kieu Anh deu la bay.
    """
    s = (s or "").strip().lower().replace("\n", "")
    if not s:
        return None
    m = re.match(r"^(\d+(?:[.,]\d+)?)\s*(?:triệu|tr)$", s)
    if m:
        try:
            return int(float(m.group(1).replace(",", ".")) * 1_000_000)
        except ValueError:
            return None
    m = re.match(r"^(\d{2,4})\s*k$", s)
    if m:
        return int(m.group(1)) * 1000
    m = re.match(r"^(\d{1,3}(?:[.,]\d{3}){1,3})\s*(?:đ|vnđ|vnd|₫)?$", s)
    if m:
        return int(re.sub(r"[.,]", "", m.group(1)))
    return None


# Ten tour that phai bat dau bang "Tour" + co danh tu rieng hoac so ngay.
# Loai cau van xuoi bi regex "Tour[^\n.,|]{4,60}" nuot phai:
#   "Tours sẽ dẫn bạn đi sâu vào vùng đất b"
#   "Tour Operator organizing tourism's act"
CAU_VAN = re.compile(r"\b(sẽ|bạn|chúng tôi|is a|organizing|reputable|phong phú|cho bạn)\b", re.I)

out = []
for r in rows:
    if r.get("loi") or not r.get("xac_minh"):
        continue
    ten_tour = [t for t in r["ten_tour"]
                if not CAU_VAN.search(t) and len(t) <= 52 and re.search(r"\d|[A-ZĐ]", t[4:] or "")]
    gia = sorted({v for v in (tien(g) for g in r["gia_tham_khao"]) if v and 50_000 <= v <= 20_000_000})
    out.append({
        "id": r["id"], "ten": r["ten"], "url": r["url"],
        "ly_do_xac_minh": r["ly_do_xac_minh"],
        "so_trang_doc": r["so_trang_doc"],
        "ten_tour": ten_tour[:10],
        # Ten la `khoang_gia_don_vi`, KHONG phai `gia_tour` — day la khoang gia
        # tren toan bo goi cua don vi, khong phai gia cua mot tour cu the.
        "khoang_gia_don_vi": (f"{gia[0]:,}".replace(",", ".") + "–"
                              + f"{gia[-1]:,}".replace(",", ".") + "₫") if len(gia) >= 2 else
                             (f"{gia[0]:,}".replace(",", ".") + "₫" if gia else None),
        "so_muc_gia": len(gia),
        # CO Y bo: khong quy duoc ve tung tour.
        "gio_don": None, "thoi_luong": None, "mua": None,
    })

json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

loi = [r for r in rows if r.get("loi")]
chua = [r for r in rows if not r.get("loi") and not r.get("xac_minh")]
print(f"{len(rows)} website thật · giữ {len(out)} · chưa xác minh {len(chua)} · tên miền chết {len(loi)}")
print(f"\n{'ID':7s}{'Đơn vị':34s}{'Tour':>5s}  Khoảng giá")
for r in out:
    print(f"{r['id']:7s}{r['ten'][:32]:34s}{len(r['ten_tour']):5d}  {r['khoang_gia_don_vi'] or '—'}")
    for t in r["ten_tour"][:3]:
        print(f"           · {t}")

print(f"\nBỎ (không quy được về từng tour): giờ đón, thời lượng")
print(f"mùa: 0/{len(rows)} website nào nêu mùa — đường này KHÔNG lấp được chỗ trống đó")
print(f"\ntên miền chết {len(loi)}/{len(rows)} — đơn vị tour nhỏ ở Đà Lạt sống trên Facebook,")
print(f"không sống trên website. Điều này đẩy trọng tâm P2 về lại Facebook.")
for r in loi:
    print(f"   {r['id']} {r['ten'][:32]:34s} {r['url']}")
print(f"\nsaved -> {OUT}")
