# -*- coding: utf-8 -*-
"""Pass 1 — hoi Overpass nhung the TIEN NGHI ma truy van goc chua bao gio hoi.

Truy van goc loc theo tourism/natural/leisure/historic/amenity nen khong bao gio
tra ve wheelchair, toilets, parking, bench, drinking_water.

Du bao: gan nhu rong. Kiem tra tren dia cho thay wheelchair=0, toilets=0 tren
ca 28 element da khop. Van chay MOT lan, vi bien "chua biet co hay khong" thanh
"da hoi va khong co" — mot ket qua am van la ket qua.

Co hoi thuc te: cac node amenity=toilets / amenity=parking duoc map RIENG nam
TRONG khuon vien diem tham quan, khong mang ten diem do.
"""
import json, os, sys, io, math, time, urllib.request, urllib.parse

RAW = sys.argv[1]
OUT = os.path.join(RAW, "osm_facilities.json")
ENRICH = os.path.join(RAW, "enrichment.json")
BBOX = (11.75, 108.30, 12.10, 108.65)      # south, west, north, east
ENDPOINT = "https://overpass-api.de/api/interpreter"
INSIDE_M = 250        # coi la "trong khuon vien"
PULL_DATE = "28/07/2026"

Q = f"""
[out:json][timeout:180];
(
  node["amenity"="toilets"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["amenity"="toilets"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"="parking"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["amenity"="parking"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"="bench"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"="drinking_water"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["tourism"="information"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["wheelchair"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["wheelchair"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"="first_aid"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["shop"="gift"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out center tags;
"""


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


if os.path.exists(OUT):
    data = json.load(io.open(OUT, encoding="utf-8"))
    print(f"dung lai ket qua da luu: {len(data.get('elements', []))} element")
else:
    print("goi Overpass (tien nghi) ...", flush=True)
    req = urllib.request.Request(
        ENDPOINT, data=urllib.parse.urlencode({"data": Q}).encode(),
        headers={"User-Agent": "BusBooking-KB/0.1 (tourism research)"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.load(r)
    print(f"  {time.time()-t0:.0f}s  {len(data.get('elements', []))} element")
    json.dump(data, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False)

els = []
for e in data.get("elements", []):
    lat = e.get("lat") or (e.get("center") or {}).get("lat")
    lon = e.get("lon") or (e.get("center") or {}).get("lon")
    if lat and lon:
        els.append((lat, lon, e.get("tags") or {}, e.get("type"), e.get("id")))

from collections import Counter
kinds = Counter()
for _, _, t, _, _ in els:
    kinds[t.get("amenity") or t.get("tourism") or t.get("shop") or "wheelchair-tagged"] += 1
print("\n--- thu duoc trong khung bao ---")
for k, v in kinds.most_common():
    print(f"  {v:5d}  {k}")

picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
FIELD = {"toilets": "nha_ve_sinh", "parking": "bai_do_xe", "bench": "cho_ngoi",
         "drinking_water": "nuoc_uong", "information": "quay_thong_tin",
         "first_aid": "so_cuu", "gift": "qua_luu_niem"}

rows = json.load(io.open(ENRICH, encoding="utf-8")) if os.path.exists(ENRICH) else []
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}
added = Counter()
for p in picked:
    for lat, lon, t, typ, oid in els:
        d = hav((p["lat"], p["lon"]), (lat, lon))
        if d > INSIDE_M:
            continue
        key = t.get("amenity") or t.get("tourism") or t.get("shop")
        fld = FIELD.get(key)
        if fld and (p["id"], fld) not in seen:
            seen.add((p["id"], fld))
            added[fld] += 1
            rows.append({"id": p["id"], "field": fld, "value": "có",
                         "source": "OpenStreetMap", "date": PULL_DATE,
                         "url": f"https://www.openstreetmap.org/{typ}/{oid}",
                         "method": "pass1-overpass-facilities",
                         "note": f"node riêng cách {d:.0f} m — trong khuôn viên",
                         "match_m": round(d)})
        if t.get("wheelchair") and (p["id"], "loi_xe_lan") not in seen:
            seen.add((p["id"], "loi_xe_lan"))
            added["loi_xe_lan"] += 1
            rows.append({"id": p["id"], "field": "loi_xe_lan", "value": t["wheelchair"],
                         "source": "OpenStreetMap", "date": PULL_DATE,
                         "url": f"https://www.openstreetmap.org/{typ}/{oid}",
                         "method": "pass1-overpass-facilities",
                         "note": f"cách {d:.0f} m", "match_m": round(d)})

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nenrichment.json: {before} -> {len(rows)}  (+{len(rows)-before})")
if added:
    for k, v in added.most_common():
        print(f"  +{v:3d}  {k}")
else:
    print("  KHONG THEM DUOC GI — ket qua am, da ghi nhan.")
    print("  => A.11 tien nghi khong co duong du lieu nao. Chi con goi dien / den tan noi.")
