# -*- coding: utf-8 -*-
"""Geocode ban ghi csdl_dest.json (Nominatim) — cap toa do cho dong NET-NEW.

/dest khong co toa do; build_diem_den.py can lat/lon de dedup/boundary/area. Geocode
"<ten>, <tinh moi>" qua Nominatim (1 req/s, UA dinh danh, countrycodes=vn). Ghi lat/lon
vao dong nao GIAI DUOC; dong khong giai -> lat=lon=None (KHONG doan). Do dac: yield ~33%
(dia chi cap huyen, ten IN HOA), va Nominatim doi khi tra sai tinh -> build_diem_den loc
bang in_boundary (guard that su, KHONG dua vao geocode dung tinh).

Resumable: bo qua dong da co lat. Ghi lai file sau moi tinh (atomic os.replace).

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_csdl_geocode.py [<slug>|all]
"""
import os, io, sys, glob, json, time, urllib.request, urllib.parse

UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
# Geocoding API bi tat tren project; Places API (New) searchText DA bat (dung cho place_id).
# FieldMask chi places.location -> tang Pro (5.000 free/thang). Chi goi cho phan Nominatim miss.
PLACES = "https://places.googleapis.com/v1/places:searchText"
ARG = sys.argv[1] if len(sys.argv) > 1 else "all"


def doc_khoa():
    """Google key: env -> .env.tourism.local -> .env.local (giong sweep_google_placeid.py)."""
    k = os.environ.get("GOOGLE_MAPS_API_KEY")
    if k and k.strip():
        return k.strip()
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("GOOGLE_MAPS_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v
    return None


GKEY = doc_khoa()


def geo_nominatim(q):
    u = NOMINATIM + "?" + urllib.parse.urlencode(
        {"q": q, "format": "json", "limit": 1, "countrycodes": "vn"})
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=30))
        return (float(d[0]["lat"]), float(d[0]["lon"])) if d else None
    except Exception:
        return None


def geo_google(q):
    """Places (New) searchText, FieldMask=places.location (Pro). Tra (lat, lon)."""
    if not GKEY:
        return None
    body = json.dumps({"textQuery": q, "languageCode": "vi", "maxResultCount": 1}).encode()
    req = urllib.request.Request(PLACES, data=body, headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": GKEY,
        "X-Goog-FieldMask": "places.location"})
    try:
        p = json.load(urllib.request.urlopen(req, timeout=30)).get("places", [])
        if p:
            loc = p[0]["location"]
            return (float(loc["latitude"]), float(loc["longitude"]))
    except Exception:
        return None
    return None


def do_file(path):
    rows = json.load(io.open(path, encoding="utf-8"))
    got_n = got_g = miss = skip = 0
    for r in rows:
        if r.get("lat") is not None:
            skip += 1
            continue
        prov = r.get("tinh") or ""
        q = f"{r['ten']}, {prov}"
        prev_miss = r.get("geo") == "miss"       # Nominatim da fail lan truoc -> thang Google
        res = None
        src = "nominatim"
        if not prev_miss:
            res = geo_nominatim(q)               # tang 1: free
            time.sleep(1.1)                      # Nominatim: 1 req/s
        if not res and GKEY:                     # tang 2: Google (chi tra cho phan miss)
            res = geo_google(q)
            src = "google"
        if res:
            r["lat"], r["lon"], r["geo"] = res[0], res[1], src
            got_g += (src == "google")
            got_n += (src == "nominatim")
        else:
            r["lat"] = r["lon"] = None
            r["geo"] = "miss"
            miss += 1
    tmp = path + ".tmp"
    json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    slug = os.path.basename(os.path.dirname(os.path.dirname(path)))
    print(f"  {slug:16} nom {got_n}  ggl {got_g}  miss {miss}  (skip {skip}) / {len(rows)}")
    return got_n + got_g, miss


def main():
    if ARG == "all":
        files = sorted(glob.glob("tourism-kb/raw/*/scrape/csdl_dest.json"))
    else:
        files = [f"tourism-kb/raw/{ARG}/scrape/csdl_dest.json"]
    tot_got = tot_miss = 0
    for f in files:
        if not os.path.exists(f):
            print("  (skip, khong co)", f)
            continue
        g, m = do_file(f)
        tot_got += g
        tot_miss += m
    print(f"\nTONG geocoded {tot_got}  miss {tot_miss}  yield {100*tot_got/max(tot_got+tot_miss,1):.0f}%")


if __name__ == "__main__":
    main()
