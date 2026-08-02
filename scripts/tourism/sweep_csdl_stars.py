# -*- coding: utf-8 -*-
"""Official star distribution via the rate[] filter — 7 queries instead of 1230 detail fetches."""
import sys, io, re, time, json, requests
from bs4 import BeautifulSoup
OUT = sys.argv[1]
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
BASE = "https://csdl.vietnamtourism.gov.vn/cslt/"
s = requests.Session(); s.headers["User-Agent"] = UA
def tok():
    return BeautifulSoup(s.get(BASE, timeout=60).text, "lxml").find("input", {"name":"csrf_name"})["value"]

LABELS = {"5":"5 sao","4":"4 sao","3":"3 sao","2":"2 sao","1":"1 sao",
          "7":"Đạt chuẩn phục vụ KDL","8":"Khác"}
res = {}
for code, label in LABELS.items():
    t = tok()
    r = s.post(BASE, data=[("csrf_name",t),("title",""),("province","68,60,67"),
                           ("rate[]",code),("sort_by_order","")], timeout=90)
    soup = BeautifulSoup(r.text, "lxml")
    m = re.search(r"Tổng số:\s*([\d.,]+)", r.text)
    total = int(m.group(1).replace(".","").replace(",","")) if m else -1
    names = [" ".join(i.get_text(" ",strip=True).split())[:95] for i in soup.select(".verticleilist")[:6]]
    res[label] = {"total": total, "sample": names}
    print(f"{label:24s} {total:5d}")
    time.sleep(1.2)

json.dump(res, io.open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
tot = sum(v["total"] for v in res.values() if v["total"]>0)
print(f"\nSum of tiers: {tot}   (province total was 1230)")
print("\n=== SAMPLE 5 SAO (Lâm Đồng) ===")
for n in res["5 sao"]["sample"]: print("  ", n)
print("\n=== SAMPLE 4 SAO ===")
for n in res["4 sao"]["sample"]: print("  ", n)
