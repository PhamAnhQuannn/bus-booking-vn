# -*- coding: utf-8 -*-
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places_dalat import PLACES
RAW = sys.argv[1]
data = json.load(open(RAW, encoding="utf-8"))
d, t = data["distances"], data["durations"]
idx = {p[0]: i for i, p in enumerate(PLACES)}
nm = {p[0]: p[1] for p in PLACES}
pairs = [("V-20","V-22"),("V-21","V-23"),("V-20","V-21"),("V-19","V-20"),
         ("V-26","V-27"),("V-27","V-25"),("V-26","V-25"),
         ("V-10","V-11"),("V-13","V-14"),("V-07","V-15"),("V-05","V-06"),
         ("V-28","V-29"),("V-31","V-18"),("V-16","V-15")]
print("=== KEY PAIRS: road vs the straight-line assumption ===")
for a,b in pairs:
    i,j = idx[a], idx[b]
    print(f"{nm[a]:28s} -> {nm[b]:28s} {d[i][j]/1000:5.1f} km  {t[i][j]/60:5.1f} min")
print()
print("=== NEAREST NEIGHBOUR BY DRIVE TIME ===")
for k,p in enumerate(PLACES):
    o = sorted(((t[k][j], PLACES[j][1]) for j in range(len(PLACES)) if j!=k))[:2]
    print(f"{p[1]:30s} -> {o[0][1]} ({o[0][0]/60:.0f}m), {o[1][1]} ({o[1][0]/60:.0f}m)")
