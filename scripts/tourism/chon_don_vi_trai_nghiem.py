# -*- coding: utf-8 -*-
"""P2a — chon cac don vi TO CHUC TRAI NGHIEM, sinh danh sach dich cho Facebook
va cho website. Khong cham mang.

Vi sao khong lay ca 310 don vi to_chuc: phan lon la tiem cho thue xe may. Chung
KHONG noi gi ve mua hay thoi luong — dung thu ta dang thieu. Loc con ~43 don vi
ban TRAI NGHIEM, la tap nho va dam dac.

Vi sao tach RIENG danh sach website: doan gioi thieu Facebook chi dai mot dong.
Phase O da do: no cho dung TEN hoat dong ("Đơn vị tổ chức Tour Săn Mây, Tour
Tham Quan, Xe Hợp Đồng") nhung khong cho lich trinh. Trang tour tren website moi
liet ke "Tour 1 ngày · đón 4h30 · 1.400.000đ" — dung thu can lap.

Chay:  python scripts/tourism/chon_don_vi_trai_nghiem.py <thu-muc-raw>
Ghi    raw/dv_trai_nghiem.json     (day du)
       raw/fb_targets_dv.json      (dung lai fb_pages_crawl.mts khong sua gi)
"""
import json, os, sys, io, re

RAW = sys.argv[1]

# Nhom hoat dong co LICH TRINH — tuc co the noi ve mua/gio/thoi luong.
# "Thuê xe máy", "Thuê ô tô", "Đơn vị lữ hành" bi loai: chung la dich vu di lai
# hoac thung chua chung, khong phai mot trai nghiem co lich.
TRAI_NGHIEM = {
    "Săn mây", "Canyoning / vượt thác", "Trekking / leo núi",
    "Xe jeep / xe địa hình", "Đạp xe", "Cắm trại / glamping",
    "Zipline / đu dây", "Tour ẩm thực", "Chèo SUP / kayak / du thuyền",
    "Câu cá", "Hái dâu tây tại vườn", "Tham quan nông trại",
    "Tham quan đồi chè / nông trại chè", "Giao lưu cồng chiêng",
    "Chụp ảnh ngoại cảnh",
}

acts = json.load(io.open(os.path.join(RAW, "hoat_dong.json"), encoding="utf-8"))
ovt = json.load(io.open(os.path.join(RAW, "overture_dalat.json"), encoding="utf-8"))

# hoat_dong.json khong mang cot `websites` — tra nguoc ve ban Overture goc.
# Cung mot loai bo sot da gay ra ca Phase O (merge bo cot `socials`).
web_of = {}
for r in ovt:
    web_of[(r.get("name"), round(r["lat"], 4))] = (r.get("websites") or [None])[0]

FB = re.compile(r"facebook\.com/", re.I)

dv = {}
for h in acts:
    if h["ten"] not in TRAI_NGHIEM:
        continue
    for c in h["co_so"]:
        if c["vai_tro"] != "to_chuc":
            continue
        key = (c["ten"], round(c["lat"], 4))
        d = dv.setdefault(key, {
            "ten": c["ten"], "lat": c["lat"], "lon": c["lon"],
            "hang_muc": c["hang_muc"], "tin_cay": c["tin_cay"],
            "dien_thoai": c["dien_thoai"],
            "facebook": c["facebook"] if c["facebook"] and FB.search(c["facebook"]) else None,
            "website": web_of.get(key),
            "hoat_dong": [],
        })
        d["hoat_dong"].append(h["ten"])

rows = sorted(dv.values(), key=lambda x: (-len(x["hoat_dong"]), -(x["tin_cay"] or 0)))
for i, r in enumerate(rows, 1):
    r["id"] = f"DV-{i:02d}"
    r["hoat_dong"] = sorted(set(r["hoat_dong"]))

json.dump(rows, io.open(os.path.join(RAW, "dv_trai_nghiem.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# Dinh dang y het fb_targets.json de fb_pages_crawl.mts chay khong can sua.
fb_t = [{"id": r["id"], "ten": r["ten"], "fb_url": r["facebook"],
         "lat": r["lat"], "lon": r["lon"],
         "dien_thoai_overture": r["dien_thoai"]}
        for r in rows if r["facebook"]]
json.dump(fb_t, io.open(os.path.join(RAW, "fb_targets_dv.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

n_web = sum(1 for r in rows if r["website"])
print(f"{len(rows)} đơn vị tổ chức trải nghiệm")
print(f"  có Facebook: {len(fb_t)}   có website: {n_web}\n")
print(f"{'ID':7s}{'Tên':40s}{'FB':3s}{'Web':4s} Hoạt động")
for r in rows:
    print(f"{r['id']:7s}{r['ten'][:38]:40s}"
          f"{'Y' if r['facebook'] else '-':3s}{'Y' if r['website'] else '-':4s} "
          f"{' / '.join(r['hoat_dong'])[:46]}")

print(f"\n→ raw/dv_trai_nghiem.json · raw/fb_targets_dv.json")
print("\nWEBSITE CAN XAC MINH TRUOC KHI FETCH — Phase F đo được khoảng một nửa")
print("trường website trỏ sang nơi không liên quan (chùa Linh Phước → tiệm giày):")
for r in rows:
    if r["website"]:
        print(f"  {r['id']}  {r['ten'][:34]:36s} {r['website'][:52]}")
