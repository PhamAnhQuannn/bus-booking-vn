# -*- coding: utf-8 -*-
"""Register diem den chinh thuc (Cuc Du lich Quoc gia) — /dest, toan quoc.

Cung khuon CodeIgniter voi sweep_csdl.py (/cslt luu tru): csrf_name token + POST
phan trang + `.verticleilist`. Khac: khong loc tinh (province="") -> quet HET 1.038
ban ghi ca nuoc trong 1 luot, luu raw/_shared/csdl_dest.json (giong overture_vn.json).
parse_csdl_dest.py sau do bucket theo tinh (duoi dia chi) -> raw/<slug>/scrape/.

Listing da mang ten + dia chi (kem tinh); KHONG co toa do (geocode o buoc sau) va
KHONG co field them dang crawl detail. Nen chi doc listing.

robots.txt = 404 (khong co luat cam, 2026-08-19); giu UA dinh danh + rate-limit 1s.
Neu endpoint quay lai 403 giua chung -> DUNG, khong doi UA (rule 403 2026-07-31).

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_csdl_dest.py
"""
import os, io, re, sys, time, json, requests
from bs4 import BeautifulSoup

OUT = sys.argv[1] if len(sys.argv) > 1 else "tourism-kb/raw/_shared/csdl_dest.json"
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
BASE = "https://csdl.vietnamtourism.gov.vn/dest/"

s = requests.Session(); s.headers["User-Agent"] = UA
r0 = s.get(BASE, timeout=60)
if r0.status_code == 403:
    sys.exit("403 tren %s — DUNG, khong doi UA; xin quyen truy cap (rule 403)." % BASE)
tok = BeautifulSoup(r0.text, "lxml").find("input", {"name": "csrf_name"})["value"]

rows, seen = [], set()
for page in range(1, 200):
    url = BASE if page == 1 else f"{BASE}?page={page}"
    r = s.post(url, data=[("csrf_name", tok), ("title", ""), ("province", ""),
                          ("sort_by_order", "")], timeout=90)
    if r.status_code == 403:
        sys.exit("403 giua chung (page %d) — DUNG, khong doi UA (rule 403)." % page)
    soup = BeautifulSoup(r.text, "lxml")
    t2 = soup.find("input", {"name": "csrf_name"})
    if t2:
        tok = t2["value"]
    if page == 1:
        m = re.search(r"Tổng số:\s*([\d.,]+)", r.text)
        print("Tổng số:", m.group(1) if m else "?")
    got = 0
    for it in soup.select(".verticleilist"):
        a = it.find("a", href=re.compile(r"item=\d+"))
        iid = re.search(r"item=(\d+)", a["href"]).group(1) if a else None
        if iid and iid in seen:
            continue
        if iid:
            seen.add(iid)
        txt = " ".join(it.get_text(" ", strip=True).split())
        rows.append({"id": iid, "name": a.get_text(" ", strip=True) if a else "", "text": txt})
        got += 1
    if page % 10 == 0 or got == 0:
        print(f"  page {page}: +{got}  total {len(rows)}")
    if got == 0:
        break
    time.sleep(1.0)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
tmp = OUT + ".tmp"
json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, OUT)
print(f"SAVED {len(rows)} -> {OUT}")
