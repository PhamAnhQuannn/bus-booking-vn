# -*- coding: utf-8 -*-
"""Tach cau truc tu ban ghi luu tru csdl.vietnamtourism.gov.vn.

Field 'text' la mot chuoi phang. No CHUA GIA PHONG that (289/1230 ban ghi) --
nguon gia duy nhat trong toan bo kho nguon, va la nguon nha nuoc.
Cung mang: so phong, dien thoai, email, va co "do Co quan nha nuoc quan ly"
(da tham dinh) vs "tu dang ky" (chua tham dinh).
"""
import sys, io, json, re

SRC, OUT = sys.argv[1], sys.argv[2]
rows = json.load(io.open(SRC, encoding="utf-8"))

# Loai co so, xep theo do dai giam dan de "Khach san nghi duong" khong bi
# "Khach san" nuot mat.
KINDS = ["Khách sạn nghỉ dưỡng", "Khách sạn biệt thự", "Biệt thự du lịch",
         "Căn hộ du lịch", "Nhà ở có phòng cho khách thuê", "Bãi cắm trại du lịch",
         "Khách sạn", "Nhà nghỉ du lịch", "Nhà nghỉ", "Homestay", "Tàu thuỷ lưu trú"]

NUM = r"[\d][\d.,]*"


def money(s):
    """'300.000' -> 300000. Dau cham la phan cach nghin trong dinh dang VN."""
    d = re.sub(r"[^\d]", "", s or "")
    return int(d) if d else None


out = []
for r in rows:
    t = " ".join((r.get("text") or "").split())
    name = (r.get("name") or "").strip()
    name = " ".join(name.split())

    kind = ""
    for k in KINDS:
        if k in t:
            kind = k
            break

    # 42/1.230 ban ghi co truong `name` rong o JSON goc — va do lai la nhom
    # cao cap (TTC Ngoc Lan, cac resort ho Tuyen Lam), tuc nhung co so quan
    # trong nhat lai vo danh. Ten VAN nam trong chuoi text, ngay truoc "Địa chỉ:":
    #     "Khách sạn TTC Ngọc Lan Khách sạn Địa chỉ: 42 Nguyễn Chí Thanh..."
    # Cat den "Địa chỉ:" roi bo tu chi LOAI lap lai o cuoi.
    if not name:
        m = re.match(r"^(.{3,120}?)\s*Địa chỉ:", t)
        if m:
            cand = m.group(1).strip()
            # Bo BAT KY tu chi loai nao o duoi, dai truoc ngan sau. Cat theo
            # `kind` (loai khop dau tien trong text) la khong du: text ghi
            # "Khách sạn nghỉ dưỡng Terracotta Đà Lạt Khách sạn Địa chỉ:" —
            # kind la "Khách sạn nghỉ dưỡng" nhung duoi lai la "Khách sạn".
            for k in sorted(KINDS, key=len, reverse=True):
                if cand.endswith(k):
                    cand = cand[: -len(k)].strip()
                    break
            name = cand

    m = re.search(r"Địa chỉ:\s*(.+?)(?=\s*(?:Số phòng|Giá|Điện thoại|Fax|Email|Website|Thông tin)\b|$)", t)
    addr = m.group(1).strip(" ,") if m else ""

    m = re.search(r"Số phòng:\s*(\d+)", t)
    rooms = int(m.group(1)) if m else None

    lo = hi = None
    m = re.search(rf"Giá:\s*({NUM})\s*-\s*({NUM})", t)
    if m:
        lo, hi = money(m.group(1)), money(m.group(2))
    else:
        m = re.search(rf"Giá:\s*({NUM})", t)
        if m:
            lo = hi = money(m.group(1))
    # Gia tran nho hon gia san = nguon ghi thieu phan nghin. Ladophar ghi
    # "250.000 - 350", tuc 350.000 bi cat. KHONG doan lai thanh 350.000 — bo
    # gia tran va giu gia san. Doan mot chu so o day la bia mot muc gia.
    if lo and hi and hi < lo:
        hi = None

    tel = ""
    m = re.search(r"Điện thoại(?:\s*(?:cố định|di động))?:\s*([\d\s().+-]{6,25})", t)
    if m:
        tel = " ".join(m.group(1).split())

    m = re.search(r"Email:\s*([^\s]+@[^\s]+)", t)
    email = m.group(1).rstrip(".,") if m else ""

    # Tin cay: nha nuoc quan ly da qua tham dinh; tu dang ky thi chua.
    if "Cơ quan nhà nước quản lý" in t:
        verified = "nhà nước"
    elif "tự đăng ký" in t:
        verified = "tự đăng ký"
    else:
        verified = ""

    # Thanh pho/xa nam o duoi cung cua chuoi dia chi
    city = ""
    for c in ("Thành phố Đà Lạt", "Đà Lạt", "Bảo Lộc", "Đức Trọng", "Đơn Dương",
              "Lạc Dương", "Gia Nghĩa", "Phan Thiết"):
        if c in addr:
            city = c
            break

    out.append({"id": r.get("id"), "ten": name, "loai": kind, "dia_chi": addr,
                "thanh_pho": city, "so_phong": rooms, "gia_min": lo, "gia_max": hi,
                "dien_thoai": tel, "email": email, "tham_dinh": verified})

json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

n = len(out)
def cnt(f):
    return sum(1 for r in out if f(r))


print(f"saved {n} -> {OUT}")
print(f"  co loai        : {cnt(lambda r: r['loai'])}")
print(f"  co dia chi     : {cnt(lambda r: r['dia_chi'])}")
print(f"  co so phong    : {cnt(lambda r: r['so_phong'])}")
print(f"  CO GIA         : {cnt(lambda r: r['gia_min'])}")
print(f"  co dien thoai  : {cnt(lambda r: r['dien_thoai'])}")
print(f"  co email       : {cnt(lambda r: r['email'])}")
print(f"  nha nuoc quan ly: {cnt(lambda r: r['tham_dinh'] == 'nhà nước')}")
print(f"  o Da Lat       : {cnt(lambda r: 'Đà Lạt' in (r['dia_chi'] or ''))}")

dl = [r for r in out if "Đà Lạt" in (r["dia_chi"] or "") and r["gia_min"]]
print(f"\nDa Lat CO GIA: {len(dl)}")
for r in sorted(dl, key=lambda x: x["gia_min"])[:12]:
    print(f"  {r['gia_min']:>9,} - {str(r['gia_max'] or ''):>9}  {r['loai'][:18]:20s} {r['ten'][:40]}")
