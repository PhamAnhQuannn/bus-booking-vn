# -*- coding: utf-8 -*-
"""OSRM road distance/duration matrix for Da Lat places. Public demo server, one table call."""
import json, sys, io, os, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places_dalat import PLACES

RAW = sys.argv[1] if len(sys.argv) > 1 else "osrm_matrix.json"
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
coords = ";".join(f"{lon},{lat}" for _, _, lat, lon, _ in PLACES)
url = (f"https://router.project-osrm.org/table/v1/driving/{urllib.parse.quote(coords)}"
       "?annotations=duration,distance")
req = urllib.request.Request(url, headers={"User-Agent": UA})
with urllib.request.urlopen(req, timeout=120) as r:
    data = json.load(r)
with io.open(RAW, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

print("code:", data.get("code"))
d = data["distances"]; t = data["durations"]
n = len(PLACES)
ok = sum(1 for i in range(n) for j in range(n) if d[i][j] is not None)
print(f"matrix {n}x{n} = {n*n} cells, non-null {ok} ({100*ok/(n*n):.1f}%)")

import math
def hav(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[2]), math.radians(b[2])
    dp = p2 - p1; dl = math.radians(b[3] - a[3])
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(x))

ratios = []
for i in range(n):
    for j in range(n):
        if i != j and d[i][j]:
            sl = hav(PLACES[i], PLACES[j])
            if sl > 0.3:
                ratios.append((d[i][j]/1000.0)/sl)
ratios.sort()
print(f"road/straight-line ratio: median {ratios[len(ratios)//2]:.2f}, "
      f"p10 {ratios[len(ratios)//10]:.2f}, p90 {ratios[9*len(ratios)//10]:.2f}")

ref = 0
print("\n--- Road distance & drive time from Hồ Xuân Hương ---")
rows = sorted(range(1, n), key=lambda j: d[ref][j] if d[ref][j] else 9e9)
for j in rows:
    km = d[ref][j]/1000.0; mins = t[ref][j]/60.0
    sl = hav(PLACES[ref], PLACES[j])
    print(f"{PLACES[j][0]}  {km:6.1f} km  {mins:5.1f} min   (straight {sl:5.1f} km)  {PLACES[j][1]}")
