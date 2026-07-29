# -*- coding: utf-8 -*-
"""Pass 6 — ten duong gan nhat, tu OSRM /nearest/.

Bo sot o Pass 1. Cung dich vu, cung giay phep (ODbL), da co san trong quy trinh:
  https://router.project-osrm.org/nearest/v1/driving/{lon},{lat}
tra ve waypoints[0].name = ten con duong dinh tuyen gan nhat.

Dien duoc `Đường chính gần nhất`. KHONG dien duoc `Tình trạng đường` — tinh trang
mat duong la danh gia vat ly, OSM khong mang truong do.
"""
import json, os, sys, io, time, urllib.request

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
BASE = "https://router.project-osrm.org/nearest/v1/driving/"
D = "28/07/2026"

picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
rows = json.load(io.open(ENRICH, encoding="utf-8")) if os.path.exists(ENRICH) else []
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}

ok, unnamed, fail = 0, 0, 0
for p in picked:
    if (p["id"], "duong_gan_nhat") in seen:
        continue
    url = f"{BASE}{p['lon']:.6f},{p['lat']:.6f}?number=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BusBooking-KB/0.1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
    except Exception as e:
        print(f"  {p['id']}: LOI {type(e).__name__}")
        fail += 1
        time.sleep(1.0)
        continue
    if d.get("code") != "Ok" or not d.get("waypoints"):
        fail += 1
        time.sleep(1.0)
        continue
    wp = d["waypoints"][0]
    name = (wp.get("name") or "").strip()
    dist = wp.get("distance")
    if not name:
        # OSRM tra ve chuoi rong khi doan duong khong co ten — la ket qua that,
        # khong phai loi. Ghi lai de khoi hoi lai lan sau.
        unnamed += 1
        seen.add((p["id"], "duong_gan_nhat"))
        rows.append({"id": p["id"], "field": "duong_gan_nhat",
                     "value": "đoạn đường gần nhất KHÔNG CÓ TÊN trong OpenStreetMap",
                     "source": "OSRM / OpenStreetMap", "url": url, "date": D,
                     "method": "pass6-osrm-nearest",
                     "note": f"cách {dist:.0f} m" if dist is not None else "",
                     "match_m": round(dist) if dist is not None else None})
        time.sleep(1.0)
        continue
    ok += 1
    seen.add((p["id"], "duong_gan_nhat"))
    rows.append({"id": p["id"], "field": "duong_gan_nhat", "value": name,
                 "source": "OSRM / OpenStreetMap", "url": url, "date": D,
                 "method": "pass6-osrm-nearest",
                 "note": f"điểm bám đường cách {dist:.0f} m" if dist is not None else "",
                 "match_m": round(dist) if dist is not None else None})
    print(f"  {p['id']:6s} {name[:38]:40s} ({dist:.0f} m)")
    time.sleep(1.0)

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nenrichment.json: {before} -> {len(rows)}  (+{len(rows)-before})")
print(f"co ten duong: {ok}   |   doan duong khong ten: {unnamed}   |   loi: {fail}")
