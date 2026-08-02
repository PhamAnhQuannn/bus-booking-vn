# -*- coding: utf-8 -*-
"""Thoi gian di duong THAT tu Ho Xuan Huong toi TUNG dong, khong phai toi diem moc khu vuc.

Doc raw/coords.json (do build_destinations_md.py xuat ra), goi OSRM table theo lo,
ghi raw/osrm_rows.json dang {"lat,lon": {"km": float, "min": float}}.

May chu demo OSRM gioi han 100 toa do moi lan goi -> moi lo 99 diem + 1 diem nguon.
"""
import sys, io, os, json, time, urllib.request

RAW = sys.argv[1]
CHUNK = 99
BASE = "https://router.project-osrm.org/table/v1/driving/"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places_dalat import PLACES

ORIGIN = (PLACES[0][2], PLACES[0][3])  # Ho Xuan Huong
print(f"diem nguon: {PLACES[0][1]}  {ORIGIN}")

coords = json.load(io.open(os.path.join(RAW, "coords.json"), encoding="utf-8"))
outfile = os.path.join(RAW, "osrm_rows.json")
out = {}
if os.path.exists(outfile):  # tiep tuc neu lan truoc dut giua chung
    out = json.load(io.open(outfile, encoding="utf-8"))
    print(f"da co san {len(out)} dong, chay tiep")

todo = [c for c in coords if f"{c[0]:.5f},{c[1]:.5f}" not in out]
print(f"can tinh: {len(todo)} / {len(coords)}")

fail = 0
for i in range(0, len(todo), CHUNK):
    batch = todo[i:i + CHUNK]
    pts = [ORIGIN] + [(c[0], c[1]) for c in batch]
    path = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in pts)
    url = f"{BASE}{path}?sources=0&annotations=duration,distance"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BusBooking-KB/0.1"})
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.load(r)
    except Exception as e:
        print(f"  lo {i//CHUNK+1}: LOI {type(e).__name__} {e}")
        fail += 1
        time.sleep(5)
        continue
    if d.get("code") != "Ok":
        print(f"  lo {i//CHUNK+1}: {d.get('code')} {d.get('message','')}")
        fail += 1
        continue
    dur = d["durations"][0]
    dist = d["distances"][0]
    for j, c in enumerate(batch, start=1):
        if dur[j] is None:
            continue
        out[f"{c[0]:.5f},{c[1]:.5f}"] = {"km": dist[j] / 1000.0, "min": dur[j] / 60.0}
    json.dump(out, io.open(outfile, "w", encoding="utf-8"))
    print(f"  lo {i//CHUNK+1}/{(len(todo)+CHUNK-1)//CHUNK}: tong {len(out)}")
    time.sleep(1.2)

print(f"\nSAVED {len(out)} dong -> {outfile}   (lo loi: {fail})")
if out:
    v = sorted(x["min"] for x in out.values())
    print(f"trung vi {v[len(v)//2]:.0f} phut   |   xa nhat {v[-1]:.0f} phut")
