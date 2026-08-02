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

# CHUNG THUC TLS BAT BUOC. Khong dat `s.verify = False`, khong goi
# `urllib3.disable_warnings()`, khong them dia chi IP tran vao BASES.
#
# Ba thu do tung cung ton tai o day va chung cung co: mot URL dang IP tran khong
# bao gio khop chung chi cua ten mien, nen no CHI chay duoc khi da tat kiem tra —
# va viec tat canh bao khien nguoi chay khong he biet. Bo mot thu ma giu hai thu
# kia thi khong sua duoc gi.
#
# Vi sao dieu do nghiem trong o DUNG file nay: docstring o tren noi ro muc dich —
# tra loi "cong ty nay co giay phep that khong". Ta ghi lai ho so DANG KY NHA NUOC
# roi trinh bay nhu mot dau hieu chinh danh. Khong chung thuc TLS nghia la bat ky
# ai nam tren duong truyen cung co the tra ve mot danh sach gia, va duong ong nay
# se luu no xuong dia nhu giay phep that. Chinh thuoc tinh ma du lieu nay hua hen
# la thu bi danh mat o tang van chuyen.
#
# Neu mot ngay chung chi that su khong hop le: GHIM chung chi
# (`s.verify = "/duong/dan/cert.pem"`) va ghi ro ly do + ngay ngay tai day.
# Tuyet doi khong quay lai `verify = False`.
BASES = ["https://www.quanlyluhanh.vn/search/"]

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
