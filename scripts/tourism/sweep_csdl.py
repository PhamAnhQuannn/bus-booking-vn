# -*- coding: utf-8 -*-
"""Official ranked-accommodation register (Cuc Du lich Quoc gia), Lam Dong post-merger 68,60,67."""
import sys, io, re, time, json, requests
from bs4 import BeautifulSoup
OUT = sys.argv[1]
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
BASE = "https://csdl.vietnamtourism.gov.vn/cslt/"
s = requests.Session(); s.headers["User-Agent"] = UA
tok = BeautifulSoup(s.get(BASE, timeout=60).text, "lxml").find("input", {"name":"csrf_name"})["value"]

rows, seen = [], set()
for page in range(1, 90):
    url = BASE if page == 1 else f"{BASE}?page={page}"
    r = s.post(url, data=[("csrf_name",tok),("title",""),("province","68,60,67"),("sort_by_order","")], timeout=90)
    soup = BeautifulSoup(r.text, "lxml")
    t2 = soup.find("input", {"name":"csrf_name"})
    if t2: tok = t2["value"]
    if page == 1:
        m = re.search(r"Tổng số:\s*([\d.,]+)", r.text); print("Tổng số:", m.group(1) if m else "?")
    items = soup.select(".verticleilist")
    got = 0
    for it in items:
        a = it.find("a", href=re.compile(r"item=\d+"))
        iid = re.search(r"item=(\d+)", a["href"]).group(1) if a else None
        txt = " ".join(it.get_text(" ", strip=True).split())
        if iid and iid in seen: continue
        if iid: seen.add(iid)
        rows.append({"id": iid, "name": a.get_text(" ",strip=True) if a else "", "text": txt})
        got += 1
    if page % 10 == 0 or got == 0: print(f"  page {page}: +{got}  total {len(rows)}")
    if got == 0: break
    time.sleep(1.0)

json.dump(rows, io.open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"SAVED {len(rows)} -> {OUT}\n")

def star(t):
    for k,v in [("5 sao",5),("4 sao",4),("3 sao",3),("2 sao",2),("1 sao",1)]:
        if k in t: return v
    return None
dl = [r for r in rows if "Đà Lạt" in r["text"]]
print(f"Toàn tỉnh Lâm Đồng: {len(rows)}   |   riêng Đà Lạt: {len(dl)}")
for label, subset in (("LÂM ĐỒNG", rows), ("ĐÀ LẠT", dl)):
    c = {}
    for r in subset:
        st = star(r["text"]); c[st] = c.get(st,0)+1
    line = "  ".join(f"{k} sao: {c[k]}" for k in [5,4,3,2,1] if k in c)
    print(f"{label:9s} {line}   không xếp hạng: {c.get(None,0)}")
selfreg = sum(1 for r in rows if "tự đăng ký" in r["text"])
print(f"\n'tự đăng ký' (self-registered, NOT state-certified): {selfreg} / {len(rows)} = {100*selfreg/max(len(rows),1):.0f}%")
print("\n=== ĐÀ LẠT 5* & 4* (chính thức) ===")
for r in dl:
    if star(r["text"]) in (5,4):
        print(f"  {star(r['text'])}* {r['name'][:60]}")
