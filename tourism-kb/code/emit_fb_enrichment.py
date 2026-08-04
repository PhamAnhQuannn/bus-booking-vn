# -*- coding: utf-8 -*-
"""Dua du lieu trang Facebook cong khai vao raw/enrichment.json.

Doc raw/fb_pages.json (do parse_fb_pages.py sinh). Khong cham mang.

BA THU CO TRONG DU LIEU MA KHONG DUOC GHI RA:

1. GIO MO CUA — bo hoan toan.
   12/35 trang co gia tri, nhung 10 la "Luôn mở cửa" va 2 la "Đang mở cửa".
   "Luôn mở cửa" la MAC DINH cua Facebook khi chu trang khong dat gio — no gan
   cho Crazy House, Thác Prenn, Đồi Mộng Mơ, Khu Di Tích Dinh Bảo Đại, deu la
   noi ban ve va chac chan dong cua ban dem. "Đang mở cửa" la trang thai tai
   thoi diem tai trang, khong phai lich. Ca hai deu khong tra loi duoc cau hoi
   "may gio mai toi den duoc?" — ghi chung vao la bien o trong thanh mot loi
   khang dinh.

2. DIA CHI — bo, vi dung ten phuong TRUOC sap nhap ("Phường 4", "Phường 8").
   Chu trang nhap mot lan roi khong sua. Dia chi Pass 9 (Nominatim, ten sau
   Nghi quyet 202/2025/QH15) van la nguon chinh.

3. % DE XUAT khi so danh gia qua it — "100% / 6 danh gia" khong phai tin hieu.
   Nguong 50. Va no KHONG PHAI diem sao: thang khac, phan phoi khac, nen di
   vao truong rieng, khong bao gio vao "Danh gia cua khach".
"""
import json, os, sys, io

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
D = "28/07/2026"
SRC = "Trang Facebook công khai"
NGUONG_DANH_GIA = 50

# Ba trang chuyen huong sang ID khac va hoa ra la thuc the KHAC. Phep kiem
# chuyen huong bat duoc ca ba; phep kiem dien thoai thi khong, vi chung khong
# co so Overture de doi chieu. Hai phep kiem doc lap, bat hai loai loi khac nhau.
LOAI_BO = {
    "DL-10": "trang chuyển hướng sang hồ sơ cá nhân, website là trang danh bạ bên thứ ba, chưa xếp hạng",
    "DL-13": "KHÔNG PHẢI vườn hoa thành phố — là cửa hàng bán cây, hạng mục 'Doanh nghiệp địa phương'",
    "DL-15": "KHÔNG PHẢI hồ — hạng mục 'Nhà riêng', website checkin.vn, SĐT là tổng đài của chính checkin.vn",
}

rows = json.load(io.open(ENRICH, encoding="utf-8"))
seen = {(r["id"], r["field"]) for r in rows}
fb = json.load(io.open(os.path.join(RAW, "fb_pages.json"), encoding="utf-8"))
targets = {t["id"]: t for t in json.load(
    io.open(os.path.join(RAW, "fb_targets.json"), encoding="utf-8"))}

added = 0


def emit(pid, field, value, note, url):
    global added
    if (pid, field) in seen or value in (None, ""):
        return
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": str(value), "source": SRC,
                 "url": url, "date": D, "method": "pass11-facebook-cong-khai",
                 "note": note, "match_m": None})
    added += 1


def so(s):
    """'17.462' / '2,6K' -> int. Facebook viet theo locale vi-VN."""
    if not s:
        return None
    s = s.strip()
    try:
        if s[-1] in "KM":
            return int(float(s[:-1].replace(",", ".")) * (1000 if s[-1] == "K" else 1000000))
        return int(s.replace(".", "").replace(",", ""))
    except (ValueError, IndexError):
        return None


dung, bo = [], []
for r in fb:
    pid = r["id"]
    if pid in LOAI_BO:
        bo.append((pid, r["ten"], LOAI_BO[pid]))
        continue
    dung.append(pid)
    url = r.get("fb_url_cuoi") or r.get("fb_url_yeu_cau")

    emit(pid, "trang_facebook", url, "trang công khai, dùng để nhắn tin hỏi giá vé và giờ mở cửa", url)

    # Dien thoai: chi khi Overture CHUA co. Trung lap khong them thong tin.
    if r.get("dien_thoai_fb") and not targets.get(pid, {}).get("dien_thoai_overture"):
        emit(pid, "dien_thoai_facebook", r["dien_thoai_fb"],
             "số trên trang Facebook, chưa đối chiếu được với nguồn khác", url)
    emit(pid, "email_facebook", r.get("email_fb"), "địa chỉ thư trên trang Facebook", url)

    # Khoang gia: thang 4 bac cua Facebook ($ den $$$$), do CHU CO SO tu khai.
    # Tho, nhung la tin hieu gia duy nhat khong mau thuan — ba nguon web thuong
    # mai da lech nhau toi 3 lan cho cung mot dia diem (28/07).
    if r.get("khoang_gia_fb"):
        emit(pid, "khoang_gia_facebook", r["khoang_gia_fb"],
             "thang 4 bậc của Facebook ($ rẻ nhất → $$$$), do chủ cơ sở tự khai", url)

    n_dg = so(r.get("so_luot_danh_gia"))
    if r.get("ty_le_gioi_thieu") and n_dg and n_dg >= NGUONG_DANH_GIA:
        emit(pid, "ty_le_gioi_thieu", f"{r['ty_le_gioi_thieu']}% trên {n_dg:,} lượt".replace(",", "."),
             "tỉ lệ người đề xuất trên Facebook — KHÔNG phải điểm sao, thang đo khác", url)

    if r.get("so_luot_checkin"):
        emit(pid, "luot_checkin", f"{r['so_luot_checkin']} lượt",
             "số người đánh dấu đã đến, tích luỹ nhiều năm — chỉ dùng để so mức phổ biến", url)
    if r.get("so_nguoi_theo_doi") and so(r["so_nguoi_theo_doi"]):
        emit(pid, "nguoi_theo_doi", r["so_nguoi_theo_doi"] + " người",
             "số người theo dõi trang Facebook", url)
    if r.get("trang_thai_dong_cua"):
        emit(pid, "trang_thai_dong_cua", r["trang_thai_dong_cua"],
             "trạng thái do Facebook hiển thị — cần gọi điện xác nhận", url)

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"dung {len(dung)} trang · loai bo {len(bo)}")
for pid, ten, ly_do in bo:
    print(f"  ⛔ {pid} {ten}\n       {ly_do}")
print(f"\nenrichment.json +{added} -> {len(rows)} dòng")

from collections import Counter
c = Counter(r["field"] for r in rows if r.get("method") == "pass11-facebook-cong-khai")
for f, n in c.most_common():
    print(f"  {f:24s}{n}")
print("\nKHÔNG ghi: giờ mở cửa (10/12 là mặc định 'Luôn mở cửa', 2 là trạng thái tức thời),"
      " địa chỉ (tên phường trước sáp nhập)")
