# -*- coding: utf-8 -*-
"""Pass 7 — ket qua duyet trang bang trinh duyet that (Playwright MCP), 28/07/2026.

Chi ghi lai thu DA MO VA DOC BANG MAT. Khong dong nao lay tu tri nho mo hinh.

Phat hien quan trong nhat cua pass nay: trang CHINH CHU cua Bao tang Lam Dong
tu mau thuan voi chinh no — trang chu ghi 07:30-17:30, trang dat ve ghi
"Hằng ngày từ 8:00 đến 17:00". Gia tri 07:30-17:30 da ghi o Pass 3 vi vay
PHAI sua lai thanh "hai trang cua cung to chuc ghi khac nhau".

Bai hoc: quy tac hai nguon khong chi ap cho nguon thuong mai. Mot to chuc cung
co the mau thuan voi chinh no tren hai trang khac nhau.
"""
import json, os, sys, io
from collections import Counter

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
D = "28/07/2026"

# (id, field, value, source, url, note, ghi_de)
OBSERVED = [
    # --- Bao tang Lam Dong: SUA LAI gia tri da ghi o Pass 3 ---
    ("DL-32", "gio_mo_cua",
     "⚠ HAI TRANG CỦA CÙNG BẢO TÀNG GHI KHÁC NHAU — trang chủ: “07:30 – 17:30”; "
     "trang đặt vé: “Hằng ngày từ 8:00 đến 17:00”. Phải gọi xác nhận trước khi báo khách.",
     "baotanglamdong.com.vn (trang chủ + trang /tickets)",
     "https://baotanglamdong.com.vn/tickets",
     "mở bằng trình duyệt thật 28/07/2026, đọc trực tiếp trên cả hai trang", True),
    ("DL-32", "can_dat_truoc",
     "Có đặt vé trực tuyến tại /tickets — gửi yêu cầu trước, bảo tàng xác nhận rồi "
     "hướng dẫn thanh toán",
     "baotanglamdong.com.vn", "https://baotanglamdong.com.vn/tickets",
     "trích nguyên văn trang đặt vé", False),
    ("DL-32", "gia_ve_ghi_chu",
     "Trang có mục “Bảng giá tham khảo” nhưng giá chỉ hiện trong biểu mẫu đặt vé "
     "sau khi chọn ngày và cơ cấu vé — không đọc được giá tĩnh",
     "baotanglamdong.com.vn", "https://baotanglamdong.com.vn/tickets",
     "quan sát bằng trình duyệt", False),

    # --- ket qua am, ghi lai de khoi thu lai ---
    ("DL-23", "kiem_tra_website",
     "crazyhouse.vn: trình duyệt thật trả về ERR_ABORTED; ticket.crazyhouse.vn: "
     "chứng chỉ TLS sai tên miền (ERR_CERT_COMMON_NAME_INVALID). Không phải giới hạn "
     "công cụ — máy chủ cấu hình sai. Chỉ còn cách gọi điện.",
     "kiểm tra bằng trình duyệt", "https://ticket.crazyhouse.vn/",
     "Playwright Chrome 28/07/2026", True),
]

rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
idx = {(r["id"], r["field"]): i for i, r in enumerate(rows)}
added = fixed = 0
for pid, field, value, src, url, note, overwrite in OBSERVED:
    rec = {"id": pid, "field": field, "value": value, "source": src, "url": url,
           "date": D, "method": "pass7-browser", "note": note, "match_m": None}
    key = (pid, field)
    if key in idx:
        if overwrite:
            rows[idx[key]] = rec
            fixed += 1
    else:
        idx[key] = len(rows)
        rows.append(rec)
        added += 1

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"enrichment.json: {before} -> {len(rows)}  (+{added} moi, {fixed} SUA LAI)")
print("\nket qua Pass 7:")
print("  1 trang chinh chu tu mau thuan  -> gia tri cu da bi ghi de bang canh bao")
print("  2 ten mien loi ky thuat that    -> xac nhan bang trinh duyet, khong phai loi cong cu")
print("  0 gia ve tinh doc duoc          -> gia nam sau bieu mau dat ve")
for k, v in Counter(r["method"] for r in rows).most_common():
    print(f"  {v:4d}  {k}")
