# -*- coding: utf-8 -*-
"""Resolve place_id cho DIEM DEN theo SLUG TƯỜNG MINH (khắc phục slug_of fallback da-lat cho tp
ngoài CONFIG). Text Search IDs-Only (Essentials, free 10k/tháng => $0). Chỉ lưu place_id (ToS).

Đọc export/<slug>/diem-den.json → ghi raw/<slug>/scrape/place_id_diem_den.json ({co_so:[{ten,place_id}]}).
Chạy TỪ GỐC:  python tourism-kb/code/resolve_placeid_batch.py <slug> [<slug> ...]
"""
import io
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import duong_dan_ra as _dr
from sweep_google_placeid import doc_khoa, goi, khop_ten, met
from yt_chung import fold

RADIUS_M = 1000.0
BORDER_M = 3000.0

khoa, nguon = doc_khoa()
if not khoa:
    print("KHONG tim thay GOOGLE_MAPS_API_KEY. Dung."); sys.exit(1)
print("key tu:", nguon)


def resolve(rec):
    ten = rec["name"]
    names = [ten] + (rec.get("alternate_names") or [])
    c = rec.get("coordinates") or {}
    lat, lon = c.get("latitude"), c.get("longitude")
    dia_chi = (rec.get("address") or {}).get("full_address")
    try:
        ung = goi(ten, dia_chi, lat, lon, khoa)
    except Exception as e:
        return None, "LOI %s" % type(e).__name__
    if not ung:
        return None, "khong ket qua"
    best = border = None
    for p in ung:
        g = fold((p.get("displayName") or {}).get("text"))
        if not g or not any(khop_ten(g, fold(n)) for n in names):
            continue
        loc = p.get("location") or {}
        gla, glo = loc.get("latitude"), loc.get("longitude")
        d = met(lat, lon, gla, glo) if (lat and gla) else None
        if d is None:
            continue
        if d <= RADIUS_M and (best is None or d < best[1]):
            best = (p["id"], d)
        elif RADIUS_M < d <= BORDER_M and (border is None or d < border[1]):
            border = (p["id"], d)
    if best:
        return best[0], "OK %.0fm" % best[1]
    return None, ("borderline %.0fm" % border[1]) if border else "khong khop"


def run(slug):
    exp = os.path.join(HERE, "..", "export", slug, "diem-den.json")
    if not os.path.exists(exp):
        print("[%s] khong co export" % slug); return
    dd = json.load(io.open(exp, encoding="utf-8"))
    out_dir = os.path.join(HERE, "..", "raw", slug, "scrape")
    os.makedirs(out_dir, exist_ok=True)
    co_so = []
    ok = 0
    for r in dd:
        pid, _ = resolve(r)
        if pid:
            co_so.append({"ten": r["name"], "place_id": pid}); ok += 1
        time.sleep(0.15)
    dest = _dr.kiem_loi_ra(os.path.join("tourism-kb", "raw", slug, "scrape", "place_id_diem_den.json"))
    tmp = dest + ".tmp"
    json.dump({"co_so": co_so}, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, dest)
    print("[%s] nhan %d/%d place_id" % (slug, ok, len(dd)))


for s in sys.argv[1:]:
    run(s)
