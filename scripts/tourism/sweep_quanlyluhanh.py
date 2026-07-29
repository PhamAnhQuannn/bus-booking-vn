# -*- coding: utf-8 -*-
"""Dang ky doanh nghiep lu hanh co giay phep (quanlyluhanh.vn) -> Lam Dong.

Tra loi cau hoi "cong ty nay co giay phep that khong" - huy hieu tinh chinh danh.
Nguon cong bo nha nuoc; doc va trich dan la dung muc dich.
"""
import sys, io, re, json, time
import requests
from bs4 import BeautifulSoup

OUT = sys.argv[1]
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
PROV = "68, 60, 67"  # Lam Dong sau sap nhap 2025

s = requests.Session()
s.headers["User-Agent"] = UA
s.verify = False
try:
    import urllib3
    urllib3.disable_warnings()
except Exception:
    pass

BASES = ["https://www.quanlyluhanh.vn/search/", "https://103.139.202.245/search/"]

rows, seen = [], set()
base_ok = None
for page in range(1, 80):
    got = 0
    for base in ([base_ok] if base_ok else BASES):
        try:
            r = s.get(base, params={"diaphuong": PROV, "page": page}, timeout=60)
        except Exception as e:
            print(f"  {base} loi: {type(e).__name__}")
            continue
        if r.status_code != 200:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        if page == 1:
            m = re.search(r"[Tt]ổng số[^\d]{0,20}([\d.,]+)", r.text)
            print(f"[{base}] Tổng số: {m.group(1) if m else '?'}   len={len(r.text)}")
        for blk in soup.select(".company-name, .tendn"):
            box = blk.find_parent(["div", "li", "tr"]) or blk
            txt = " ".join(box.get_text(" ", strip=True).split())
            name = " ".join(blk.get_text(" ", strip=True).split())
            if not name or name in seen:
                continue
            seen.add(name)
            lic = re.search(r"(\d{2}[-/]\d{3,}[-/]?\w*)", txt)
            rows.append({"ten": name, "giay_phep": lic.group(1) if lic else "",
                         "chi_tiet": txt[:300]})
            got += 1
        if got:
            base_ok = base
            break
    if page % 10 == 0 or got == 0:
        print(f"  page {page}: +{got}  (tong {len(rows)})")
    if got == 0:
        break
    time.sleep(1.0)

json.dump(rows, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nSAVED {len(rows)} doanh nghiep -> {OUT}")

dl = [r for r in rows if "Đà Lạt" in r["chi_tiet"]]
print(f"Lâm Đồng: {len(rows)}   |   ghi địa chỉ Đà Lạt: {len(dl)}")
print("\n=== 15 doanh nghiep dau ===")
for r in rows[:15]:
    print(f"  {r['ten'][:66]}")
