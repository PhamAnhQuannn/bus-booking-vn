# -*- coding: utf-8 -*-
"""Web-curate Giờ mở + Giá vé cho điểm đến Đà Nẵng (như enrich_web.py của Đà Lạt).

⚠ MỌI DÒNG DƯỚI ĐÂY LÀ THỨ ĐÃ FETCH VỀ THẬT ngày 05/08/2026, kèm URL nguồn. KHÔNG dòng nào
lấy từ trí nhớ mô hình. Điểm không tìm được giờ/giá trên trang thật -> BỎ (giữ "Chưa xác minh").

Giá vé -> `gia_ve_tham_khao` (nguồn thương mại/không chính thức, phải gọi xác nhận; +MÂU THUẪN nếu
nhiều nguồn). Giờ -> `gio_mo_cua` cú pháp OSM. DN-13 công viên TẠM ĐÓNG cải tạo -> canh_bao_website.

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_web_da_nang.py tourism-kb/raw/da-nang/scrape
"""
import json, os, sys, io
from collections import Counter

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
D = "05/08/2026"

GIO = [
    ("DN-02", "Mo-Su 17:30-22:30", "daivietourist.vn", "https://daivietourist.vn/helio-center-da-nang/"),
    ("DN-03", "Mo-Su 07:00-17:00", "bonboncar.vn", "https://www.bonboncar.vn/blog/bao-tang-dieu-khac-cham-da-nang-2025-gia-ve-gio-mo-cua-kinh-nghiem-tham-quan/"),
    ("DN-05", "Mo-Su 06:00-19:00", "danangwander.com", "https://danangwander.com/en/diem-den/kinh-nghiem-di-cho-han-da-nang-mua-dac-san-va-an-vat-gon-le-en/"),
    ("DN-06", "Mo-Su 05:00-17:00", "tourdanangcity.vn", "https://tourdanangcity.vn/nha-tho-chinh-toa/"),
    ("DN-07", "24/7", "sovaba.travel", "https://sovaba.travel/blog/bai-viet-kinh-nghiem-tham-quan-cau-tinh-yeu-gia-ve-gio-mo-cua-cach-di"),
    ("DN-08", "Mo-Su 08:00-17:00", "wheres.vn", "https://wheres.vn/bao-tang-my-thuat-da-nang/"),
    ("DN-10", "24/7", "mia.vn", "https://mia.vn/cam-nang-du-lich/tuong-ca-chep-hoa-rong-da-nang-bieu-tuong-cua-khao-khat-phon-vinh-1830"),
    ("DN-11", "Mo-Su 08:00-17:00", "baotangdanang.vn", "https://baotangdanang.vn/"),
    ("DN-12", "Mo-Su 07:00-19:30", "greensm.com", "https://www.greensm.com/news/cho-con-da-nang"),
    ("DN-15", "Mo-Su 15:00-22:00", "sunworld.vn", "https://sunworld.vn/vi/tin-tuc-sunworld/chinh-sach-gia-ve-lich-hoat-dong-cua-cong-vien-chau-a-asia-park-nam-2024-6145"),
    ("DN-16", "Mo-Su 08:00-22:00", "vecaptreobanahills.com", "https://www.vecaptreobanahills.com/bang-gia-ve-cap-treo-ba-na-hills/"),
    ("DN-19", "24/7", "danangbest.com", "https://danangbest.com/bai-bien-my-khe-bai-bien-dep-nhat-da-nang.html"),
    ("DN-20", "24/7", "vinwonders.com", "https://vinwonders.com/vi/wonderpedia/news/cong-vien-bien-dong-da-nang/"),
    ("DN-22", "24/7", "pystravel.vn", "https://pystravel.vn/tin/17558-cach-di-ban-dao-son-tra.html"),
    ("DN-23", "24/7", "danangbest.com", "https://danangbest.com/tham-quan-dinh-ban-co-chon-bong-lai-tien-canh.html"),
    ("DN-24", "Mo-Su 06:00-21:00", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/chua-linh-ung-bai-but-da-nang.html"),
    ("DN-25", "Mo-Su 06:00-18:00", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/chua-quan-the-am-ngu-hanh-son.html"),
    ("DN-26", "Mo-Su 07:00-17:00", "nguhanhson.org", "https://nguhanhson.org/news/thong-tin-can-biet/gia-ve-tham-quan/"),
    ("DN-27", "24/7", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/bai-bien-non-nuoc-da-nang.html"),
]

PRICES = {
    "DN-02": ("miễn phí vé vào cổng; trò chơi trả phí riêng (~20.000đ/lượt)", "daivietourist.vn", "https://daivietourist.vn/helio-center-da-nang/", False),
    "DN-03": ("40.000đ người lớn / 5.000đ sinh viên / <16 tuổi miễn phí (một số nguồn ghi 60.000đ)", "bonboncar.vn", "https://www.bonboncar.vn/blog/bao-tang-dieu-khac-cham-da-nang-2025-gia-ve-gio-mo-cua-kinh-nghiem-tham-quan/", True),
    "DN-05": ("miễn phí", "danangwander.com", "https://danangwander.com/en/diem-den/kinh-nghiem-di-cho-han-da-nang-mua-dac-san-va-an-vat-gon-le-en/", False),
    "DN-06": ("miễn phí", "tourdanangcity.vn", "https://tourdanangcity.vn/nha-tho-chinh-toa/", False),
    "DN-07": ("miễn phí", "sovaba.travel", "https://sovaba.travel/blog/bai-viet-kinh-nghiem-tham-quan-cau-tinh-yeu-gia-ve-gio-mo-cua-cach-di", False),
    "DN-08": ("20.000đ; miễn phí trẻ em / HSSV / >60 tuổi / người khuyết tật", "wheres.vn", "https://wheres.vn/bao-tang-my-thuat-da-nang/", False),
    "DN-10": ("miễn phí", "mia.vn", "https://mia.vn/cam-nang-du-lich/tuong-ca-chep-hoa-rong-da-nang-bieu-tuong-cua-khao-khat-phon-vinh-1830", False),
    "DN-11": ("50.000đ người lớn / 20.000đ cư dân ĐN & SV / miễn phí <16, 60+, HS", "baotangdanang.vn", "https://baotangdanang.vn/", False),
    "DN-13": ("miễn phí", "ngocthachtravel.vn", "https://ngocthachtravel.vn/cong-vien-29-thang-3-da-nang/", False),
    "DN-14": ("miễn phí", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/cau-song-han-da-nang.html", False),
    "DN-15": ("250.000đ người lớn / 125.000đ trẻ 1–1,4m (All-in-One); vé lẻ Sun Wheel 150.000/75.000đ", "sunworld.vn", "https://sunworld.vn/vi/tin-tuc-sunworld/chinh-sach-gia-ve-lich-hoat-dong-cua-cong-vien-chau-a-asia-park-nam-2024-6145", False),
    "DN-16": ("cáp treo khứ hồi 1.000.000đ người lớn / 800.000đ trẻ 1–1,4m & cao tuổi; combo buffet 1.300.000/1.000.000đ (một số nguồn 950.000/750.000đ)", "vecaptreobanahills.com", "https://www.vecaptreobanahills.com/bang-gia-ve-cap-treo-ba-na-hills/", True),
    "DN-17": ("miễn phí vào chùa; bắt buộc mua vé cáp treo Bà Nà để tới nơi (xem Bà Nà Hills)", "danangbest.com", "https://danangbest.com/chua-linh-ung-ba-na-hills-ngoi-chua-tren-dinh-may-cao-1500m-giua-nui-rung-da-nang-2026.html", False),
    "DN-18": ("miễn phí (gửi xe 5.000–15.000đ)", "bazantravel.com", "https://bazantravel.com/nhung-diem-tham-quan-mien-phi-tai-da-nang/", False),
    "DN-19": ("miễn phí (thuê ghế/dù/gửi xe tính phí riêng)", "danangbest.com", "https://danangbest.com/bai-bien-my-khe-bai-bien-dep-nhat-da-nang.html", False),
    "DN-20": ("miễn phí", "vinwonders.com", "https://vinwonders.com/vi/wonderpedia/news/cong-vien-bien-dong-da-nang/", False),
    "DN-21": ("miễn phí (gửi xe tính phí)", "vinwonders.com", "https://vinwonders.com/vi/wonderpedia/news/cong-vien-bien-dong-da-nang/", False),
    "DN-22": ("miễn phí", "pystravel.vn", "https://pystravel.vn/tin/17558-cach-di-ban-dao-son-tra.html", False),
    "DN-23": ("miễn phí", "danangbest.com", "https://danangbest.com/tham-quan-dinh-ban-co-chon-bong-lai-tien-canh.html", False),
    "DN-24": ("miễn phí vào chùa; thang máy trong tượng Phật 30.000đ người lớn / 15.000đ trẻ <12t", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/chua-linh-ung-bai-but-da-nang.html", False),
    "DN-25": ("miễn phí", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/chua-quan-the-am-ngu-hanh-son.html", False),
    "DN-26": ("Thủy Sơn 40.000đ / HSSV 10.000đ; Động Âm Phủ 20.000đ; thang máy 15.000đ/lượt (nguồn chính thức BQL)", "nguhanhson.org", "https://nguhanhson.org/news/thong-tin-can-biet/gia-ve-tham-quan/", True),
    "DN-27": ("miễn phí (thuê ghế/dù 50.000–100.000đ)", "vietnambooking.com", "https://www.vietnambooking.com/du-lich/blog-du-lich/bai-bien-non-nuoc-da-nang.html", False),
    "DN-28": ("miễn phí hoàn toàn (nguồn chính thức BQL Ngũ Hành Sơn)", "nguhanhson.org", "https://nguhanhson.org/news/thong-tin-can-biet/gia-ve-tham-quan/", False),
}
# DN-01 (cầu Thuận Phước) · DN-04 (cầu Rồng) · DN-09 (nhà hát): không có giờ/giá cố định -> để trống.
CANH_BAO = [
    ("DN-13", "⚠ TẠM ĐÓNG để cải tạo tới 30/9/2026 — kiểm tra trước khi đến",
     "visitdanang.travel", "https://visitdanang.travel/"),
]

rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}


def emit(pid, field, value, source, url, note, method="web-curate-dn"):
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
for pid, val, src, url in CANH_BAO:
    emit(pid, "canh_bao_website", val, src, url, "trạng thái cơ sở tại thời điểm curate")

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("enrichment.json: %d -> %d  (+%d)" % (before, len(rows), len(rows) - before))
for k, v in Counter(r["field"] for r in rows if r["method"] == "web-curate-dn").most_common():
    print("  +%3d  %s" % (v, k))
print("giờ: %d · giá: %d · cảnh báo: %d" % (len(GIO), len(PRICES), len(CANH_BAO)))
