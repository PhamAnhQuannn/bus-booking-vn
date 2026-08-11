# -*- coding: utf-8 -*-
"""Web-curate Giờ mở + Giá vé cho điểm đến Nha Trang (như enrich_web.py của Đà Lạt).

⚠ MỌI DÒNG DƯỚI ĐÂY LÀ THỨ ĐÃ FETCH VỀ THẬT ngày 05/08/2026, kèm URL nguồn. KHÔNG dòng nào
lấy từ trí nhớ mô hình. Điểm không tìm được giờ/giá trên trang thật -> BỎ (giữ "Chưa xác minh").

Giá vé -> `gia_ve_tham_khao` (nguồn thương mại/không chính thức, phải gọi xác nhận; +MÂU THUẪN nếu
nhiều nguồn khác nhau) — KHÔNG ghi `gia_ve` chính thức. Giờ -> `gio_mo_cua` cú pháp OSM cho parse_hours.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_web_nha_trang.py tourism-kb/raw/nha-trang/scrape
"""
import json, os, sys, io
from collections import Counter

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
D = "05/08/2026"

# (id, gio OSM, source, url)
GIO = [
    ("NT-03", "Tu-Su 08:00-17:00", "donatourist.com", "https://donatourist.com/bao-tang-khanh-hoa-dia-chi-gia-ve-kinh-nghiem-tham-quan"),
    ("NT-04", "Mo-Su 06:00-18:00", "xanhsm.com", "https://www.xanhsm.com/news/nha-tho-nui-nha-trang"),
    ("NT-06", "Mo-Su 08:00-17:00", "klook.com", "https://www.klook.com/vi/blog/chua-long-son/"),
    ("NT-10", "Mo-Su 08:00-18:00", "soctrangtourism.vn", "https://soctrangtourism.vn/thap-ba-ponagar-nha-trang-gia-ve/"),
    ("NT-11", "Mo-Su 07:00-18:00", "namthientravel.com.vn", "https://namthientravel.com.vn/tam-bun-thap-ba-nha-trang/"),
    ("NT-15", "Mo-Su 06:00-19:00", "newlifetravel.vn", "https://newlifetravel.vn/hon-chong-nha-trang/"),
    ("NT-17", "Mo-Su 06:00-18:00", "nhatrang-tourist.com", "https://nhatrang-tourist.com/vien-hai-duong-hoc-nha-trang"),
    ("NT-18", "Mo-Su 08:00-16:20", "namthientravel.com.vn", "https://namthientravel.com.vn/tam-bun-hon-tam-nha-trang/"),
    ("NT-19", "Mo-Su 08:30-20:00", "newlifetravel.vn", "https://newlifetravel.vn/ve-vinwonders-nha-trang/"),
    ("NT-20", "Mo-Su 08:00-17:00", "newlifetravel.vn", "https://newlifetravel.vn/ho-ca-tri-nguyen-nha-trang/"),
]

# id -> (value, source, url, conflict)
PRICES = {
    "NT-03": ("30.000đ", "donatourist.com", "https://donatourist.com/bao-tang-khanh-hoa-dia-chi-gia-ve-kinh-nghiem-tham-quan", False),
    "NT-04": ("miễn phí", "xanhsm.com", "https://www.xanhsm.com/news/nha-tho-nui-nha-trang", False),
    "NT-06": ("miễn phí (công đức tùy tâm)", "klook.com", "https://www.klook.com/vi/blog/chua-long-son/", False),
    "NT-10": ("22.000–30.000đ (một số nguồn ghi 50.000đ người lớn)", "soctrangtourism.vn", "https://soctrangtourism.vn/thap-ba-ponagar-nha-trang-gia-ve/", True),
    "NT-11": ("120.000–650.000đ tùy gói (một số nguồn 180.000–1.800.000đ)", "namthientravel.com.vn", "https://namthientravel.com.vn/tam-bun-thap-ba-nha-trang/", True),
    "NT-12": ("miễn phí", "soctrangtourism.vn", "https://soctrangtourism.vn/cong-vien-yen-phi-nha-trang/", False),
    "NT-13": ("miễn phí (công đức tùy tâm)", "greensm.com", "https://www.greensm.com/news/chua-tong-lam-lo-son", False),
    "NT-15": ("22.000đ (một số nguồn ghi 30.000đ)", "newlifetravel.vn", "https://newlifetravel.vn/hon-chong-nha-trang/", True),
    "NT-17": ("40.000đ người lớn / 20.000đ sinh viên / <6 tuổi miễn phí (một số nguồn SV 10.000đ)", "nhatrang-tourist.com", "https://nhatrang-tourist.com/vien-hai-duong-hoc-nha-trang", True),
    "NT-18": ("350.000–1.299.000đ tùy gói; trẻ <1m miễn phí", "namthientravel.com.vn", "https://namthientravel.com.vn/tam-bun-hon-tam-nha-trang/", True),
    "NT-19": ("1.050.000đ người lớn / 800.000đ trẻ 100–139cm / <100cm miễn phí", "newlifetravel.vn", "https://newlifetravel.vn/ve-vinwonders-nha-trang/", False),
    "NT-20": ("150.000đ người lớn / 100.000đ trẻ 1–1,4m / <1m miễn phí", "newlifetravel.vn", "https://newlifetravel.vn/ho-ca-tri-nguyen-nha-trang/", False),
}
# NT-01/02 (chợ) · NT-05 (ga) · NT-07/08 · NT-09 (biển) · NT-14/16: KHÔNG có trang fetch riêng -> để trống (Chưa xác minh).

rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}


def emit(pid, field, value, source, url, note, method="web-curate-nt"):
    if (pid, field) in seen:
        return
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": value, "source": source, "url": url,
                 "date": D, "method": method, "note": note, "match_m": None})


for pid, gio, src, url in GIO:
    emit(pid, "gio_mo_cua", gio, src, url, "giờ mở cửa lấy từ trang du lịch, nên gọi xác nhận")
for pid, (val, src, url, conflict) in PRICES.items():
    note = ("⚠ CÁC NGUỒN MÂU THUẪN — chỉ ước lượng, PHẢI gọi xác nhận trước khi báo giá"
            if conflict else "nguồn thương mại/không chính thức — nên gọi xác nhận")
    emit(pid, "gia_ve_tham_khao", val, src, url, note)

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("enrichment.json: %d -> %d  (+%d)" % (before, len(rows), len(rows) - before))
for k, v in Counter(r["field"] for r in rows if r["method"] == "web-curate-nt").most_common():
    print("  +%3d  %s" % (v, k))
print("giờ: %d điểm · giá: %d điểm (miễn phí + có vé)" % (len(GIO), len(PRICES)))
