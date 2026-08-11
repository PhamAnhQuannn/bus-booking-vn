# -*- coding: utf-8 -*-
"""Resolve google place_id cho DIEM DEN (de app hien gio mo LIVE qua link — ToS cam LUU gio).

Doc export/<slug>/diem-den.json (ten+alt+coord+dia_chi), Text Search IDs-Only (Essentials, free
10k/thang => $0). Resolver 2-truc RIENG cho diem den (khac khach san `phan_giai` ban kinh 100m):
attraction TRAI RONG (ho/thung lung/thac cach pin Google km) nen ban kinh noi rong = 1000m, VA
khop ten tinh ca `alternate_names` (Crazy House == "Biet thu Hang Nga"). Ten van la truc bat buoc.
Borderline 1000-3000m (ten khop, xa) ghi rieng `borderline[]` de owner review, KHONG auto-nhan.
CHI luu place_id (discard field khac — ToS).

Ghi raw/<slug>/scrape/place_id_diem_den.json ({"co_so":[{ten,place_id}], "borderline":[...]}).
Chay TU GOC REPO:  python tourism-kb/code/sweep_placeid_diem_den.py [tourism-kb/raw/<slug>/scrape]
"""
import os, io, sys, json, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duong_dan_ra as _dr
from dia_diem_config import slug_of
from sweep_google_placeid import doc_khoa, goi, khop_ten, met
from yt_chung import fold

RADIUS_M = 1000.0        # diem den lon -> noi hon 100m cua khach san
BORDER_M = 3000.0        # ten khop nhung 1-3km -> borderline (review), khong auto-nhan

RAW = sys.argv[1] if len(sys.argv) > 1 else "tourism-kb/raw/da-lat/scrape"
SLUG = slug_of(RAW)
EXPORT = "tourism-kb/export/%s/diem-den.json" % SLUG
OUT = _dr.kiem_loi_ra(os.path.join(RAW, "place_id_diem_den.json"))

khoa, nguon = doc_khoa()
if not khoa:
    print("KHONG tim thay GOOGLE_MAPS_API_KEY (.env.tourism.local). Dung."); sys.exit(1)
print("key tu:", nguon)


def resolve(rec):
    """-> (place_id, dist_m, ly_do) hoac (None, dist|None, ly_do). Ten khop CA name+alt."""
    ten = rec["name"]
    names = [ten] + (rec.get("alternate_names") or [])
    c = rec.get("coordinates") or {}
    lat, lon = c.get("latitude"), c.get("longitude")
    dia_chi = (rec.get("address") or {}).get("full_address")
    try:
        ung = goi(ten, dia_chi, lat, lon, khoa)
    except Exception as e:
        return None, None, "LỖI %s: %s" % (type(e).__name__, str(e)[:70])
    if not ung:
        return None, None, "Google không trả kết quả"
    best = border = None                       # (pid, dist)
    for p in ung:
        g = fold((p.get("displayName") or {}).get("text"))
        if not g:
            continue
        if not any(khop_ten(g, fold(n)) for n in names):
            continue
        loc = p.get("location") or {}
        gla, glo = loc.get("latitude"), loc.get("longitude")
        d = met(lat, lon, gla, glo) if (lat and gla) else None
        if d is None:
            continue
        if d <= RADIUS_M:
            if best is None or d < best[1]:
                best = (p["id"], d)
        elif d <= BORDER_M:
            if border is None or d < border[1]:
                border = (p["id"], d)
    if best:
        return best[0], best[1], "khớp tên+vị trí (%.0f m)" % best[1]
    if border:
        return None, border[1], "BORDERLINE tên khớp nhưng xa (%.0f m)" % border[1]
    return None, None, "không ứng viên nào khớp tên+vị trí"


dd = json.load(io.open(EXPORT, encoding="utf-8"))
co_so, borderline = [], []
ok = miss = err = bord = 0
for r in dd:
    pid, dist, ly_do = resolve(r)
    if pid:
        co_so.append({"ten": r["name"], "place_id": pid}); ok += 1
        print("  OK   %-34s %s" % (r["name"][:34], ly_do))
    elif ly_do.startswith("BORDERLINE"):
        borderline.append({"ten": r["name"], "id": r["id"], "dist_m": round(dist)}); bord += 1
        print("  ??   %-34s %s" % (r["name"][:34], ly_do))
    else:
        if ly_do.startswith("LỖI"): err += 1
        else: miss += 1
        print("  --   %-34s %s" % (r["name"][:34], ly_do))
    time.sleep(0.2)

tmp = OUT + ".tmp"
json.dump({"co_so": co_so, "borderline": borderline},
          io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, OUT)
print("\n%s: nhận %d/%d  (borderline=%d miss=%d err=%d) -> %s"
      % (SLUG, ok, len(dd), bord, miss, err, OUT))
