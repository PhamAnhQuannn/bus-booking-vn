# -*- coding: utf-8 -*-
"""Pass 3 + 5 — trang chinh chu va tim kiem web. Ghi lai QUAN SAT THUC TE.

Moi dong duoi day la thu DA LAY VE THAT ngay 28/07/2026, kem URL. Khong dong nao
lay tu tri nho mo hinh.

Ket qua quan trong nhat cua pass nay la MOT KET QUA AM:
gia ve tu cac trang blog du lich MAU THUAN NHAU toi 3 lan cho cung mot dia diem.
Vi vay gia ve KHONG duoc ghi vao truong `gia_ve` — no vao `gia_ve_tham_khao`
kem canh bao, con `gia_ve` giu nguyen [UNVERIFIED] cho toi khi goi dien xac nhan.
"""
import json, os, sys, io
from collections import Counter

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
D = "28/07/2026"

# ---------------------------------------------------------------- Pass 3
# Ket qua kiem tra TUNG URL da luu. Day la buoc bat buoc truoc khi lay du lieu:
# truong website bi nhiem ban VA co ten mien da chet.
SITE_CHECK = [
    # (id, url, ket luan)
    ("DL-32", "https://baotanglamdong.com.vn/", "CHÍNH CHỦ — lấy được giờ mở cửa"),
    ("DL-23", "https://www.crazyhouse.vn/", "CHÍNH CHỦ — không đăng giá/giờ trên trang"),
    ("DL-06", "https://dalattourist.com.vn/", "CHÍNH CHỦ nhưng trang rỗng nội dung"),
    ("DL-29", "http://kdlprenn.com.vn/", "TÊN MIỀN KHÔNG PHÂN GIẢI — đã chết"),
    ("DL-09", "http://khudulichthacbaodai.vn/", "TÊN MIỀN KHÔNG PHÂN GIẢI — đã chết"),
    ("DL-21", "http://vuonhoacamtucau.com/", "TÊN MIỀN KHÔNG PHÂN GIẢI — đã chết"),
    ("DL-16", "https://giaophandalat.org", "hết thời gian chờ, chưa kết luận được"),
]
# Truong website bi nhiem ban — cac URL nay KHONG phai trang cua dia diem.
CONTAMINATED = {
    "DL-14": ("http://sheshoes.vn/", "cửa hàng giày — KHÔNG liên quan chùa Linh Phước"),
    "DL-15": ("http://checkin.vn/", "trang rao vặt — KHÔNG phải trang hồ Xuân Hương"),
    "DL-25": ("http://dalatdaytours.com/", "công ty bán tour — KHÔNG phải nhà thờ"),
    "DL-13": ("http://hoatuoimaimai.com/", "shop hoa tươi — KHÔNG phải vườn hoa thành phố"),
    "DL-34": ("http://www.typictravel.com", "công ty bán tour — KHÔNG phải hồ Than Thở"),
    "DL-11": ("http://www.vietthienphu.com.vn/", "chưa xác minh là trang chính chủ"),
    "DL-30": ("https://voluongtho.vn/", "chưa xác minh là trang chính chủ"),
    "DL-31": ("https://www.youtube.com/@langculan.official", "kênh YouTube, không phải web chính thức"),
}

# Du lieu THAT lay duoc tu trang chinh chu.
#
# ⚠ KHONG dat SO DIEN THOAI vao bang nay. Day la bang dien TAY nam trong ma
# nguon duoc theo doi, con so lien he thuoc lop du lieu o `tourism-kb/raw/` (da
# gitignore). Dong DL-23 truoc day mang so tong dai that cua Crazy House, chep
# tu crazyhouse.vn; no lot moi bo quet vi `+84` roi den `263` — dau so vung,
# nam ngoai `[35789]` cua luat PII — va con co khoang trang chen giua.
# Hom nay bang giu mot so tong dai; lan ghi tiep cho mot homestay se la so di
# dong ca nhan, va khong co gi trong repo nhan ra dieu do.
OFFICIAL_FACTS = [
    ("DL-32", "gio_mo_cua", "07:30 – 17:30", "baotanglamdong.com.vn",
     "https://baotanglamdong.com.vn/", "trích nguyên văn “Giờ mở cửa: 07:30 - 17:30”"),
    ("DL-23", "can_dat_truoc", "có bán vé trước qua ticket.crazyhouse.vn",
     "crazyhouse.vn", "https://www.crazyhouse.vn/", "trang chính chủ"),
]

# ---------------------------------------------------------------- Pass 5
# BA nguon, BA muc gia khac nhau cho cung mot dia diem. Ghi ca ba, khong chon.
PRICE_SOURCES = {
    "A": ("hoadalattravel.vn", "https://hoadalattravel.vn/ve/"),
    "B": ("tổng hợp tìm kiếm web (intour.vn, agotourist.com)",
          "https://intour.vn/kinh-nghiem-du-lich/update-bang-gia-ve-cac-diem-tham-quan-tai-lam-dong-moi-nhat-1679.html"),
}
# id -> {nguon: "nguoi lon / tre em"}
PRICES = {
    "DL-08": {"A": "50.000 / 25.000", "B": "80.000 / 50.000"},          # Thác Datanla
    "DL-02": {"A": "250.000 / 125.000", "B": "155.000 / 95.000 (và một nguồn khác ghi 240.000)"},
    "DL-06": {"A": "50.000 / 25.000", "B": "155.000"},                   # Lang Biang
    "DL-29": {"A": "50.000 / 25.000"},                                   # Thác Prenn
    "DL-14": {"A": "miễn phí"},                                          # Chùa Linh Phước
    "DL-19": {"A": "miễn phí"},                                          # Chùa Linh Sơn
    "DL-34": {"A": "50.000 / 25.000"},                                   # Hồ Than Thở
    "DL-31": {"A": "150.000"},                                           # Làng Cù Lần
    "DL-13": {"A": "100.000 / 50.000"},                                  # Vườn hoa thành phố
}

rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}


def emit(pid, field, value, source, url, note, method):
    if (pid, field) in seen:
        return
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": value, "source": source, "url": url,
                 "date": D, "method": method, "note": note, "match_m": None})


for pid, url, verdict in SITE_CHECK:
    emit(pid, "kiem_tra_website", verdict, "kiểm tra thủ công", url,
         "đã mở trang và đối chiếu ngày 28/07/2026", "pass3-site-check")
for pid, (url, why) in CONTAMINATED.items():
    emit(pid, "canh_bao_website", f"⚠ {why}", "kiểm tra thủ công", url,
         "URL lưu trong dữ liệu KHÔNG phải trang của địa điểm này", "pass3-site-check")
for pid, field, value, src, url, note in OFFICIAL_FACTS:
    emit(pid, field, value, src, url, note, "pass3-official-site")

for pid, per in PRICES.items():
    parts, urls = [], []
    for k, v in sorted(per.items()):
        nm, u = PRICE_SOURCES[k]
        parts.append(f"{v} ({nm})")
        urls.append(u)
    conflict = len(per) > 1
    emit(pid, "gia_ve_tham_khao", " · ".join(parts),
         "trang du lịch thương mại", urls[0],
         ("⚠ CÁC NGUỒN MÂU THUẪN NHAU — chỉ dùng để ước lượng ngân sách, "
          "PHẢI gọi xác nhận trước khi báo giá cho khách"
          if conflict else
          "nguồn thương mại, không phải giá chính thức — phải gọi xác nhận"),
         "pass5-websearch")

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"enrichment.json: {before} -> {len(rows)}  (+{len(rows)-before})")
for k, v in Counter(r["field"] for r in rows
                    if r["method"].startswith(("pass3", "pass5"))).most_common():
    print(f"  +{v:3d}  {k}")
print(f"\nsố điểm có giá tham khảo : {len(PRICES)}")
print(f"trong đó nguồn mâu thuẫn : {sum(1 for p in PRICES.values() if len(p) > 1)}")
print(f"tên miền đã chết         : {sum(1 for _, _, v in SITE_CHECK if 'KHÔNG PHÂN GIẢI' in v)}")
print(f"website nhiễm bẩn        : {len(CONTAMINATED)}")
