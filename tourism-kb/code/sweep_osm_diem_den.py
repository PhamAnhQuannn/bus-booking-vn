# -*- coding: utf-8 -*-
"""OSM (Overpass) diem den sweep — NGUON CHINH cho diem den moi tinh (thay Overture, von la
dataset POI thuong mai: khach san/du thuyen/BDS bi tag 'landmark' -> ~80% rac).

OSM tag tourism=/historic=/natural=/leisure=/amenity=place_of_worship la attraction THAT, co
ten sach + thuong mang tag `wikidata`/`wikipedia`/`heritage` = tin hieu noi tieng. Query theo
bbox (dia_diem_config), luu element co TEN -> osm_diem_den.json. build_diem_den doc file nay.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_osm_diem_den.py tourism-kb/raw/<slug>/scrape/osm_diem_den.json
"""
import sys, os, io, json, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of

OUT = sys.argv[1]
XMIN, YMIN, XMAX, YMAX = cfg(OUT)["bbox"]           # (lon_min, lat_min, lon_max, lat_max)
S, W, N, E = YMIN, XMIN, YMAX, XMAX                  # Overpass bbox = (south, west, north, east)
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Tag attraction (query rong; loc rac o build). place_of_worship + historic + natural chon loc.
QUERY = f"""[out:json][timeout:300];
(
 nwr["tourism"~"^(attraction|museum|viewpoint|theme_park|zoo|aquarium|artwork|gallery|water_park)$"]({S},{W},{N},{E});
 nwr["historic"~"^(castle|fort|palace|monument|memorial|ruins|archaeological_site|battlefield|city_gate|tower|church|temple|monastery|shrine|manor|citywalls)$"]({S},{W},{N},{E});
 nwr["natural"~"^(peak|volcano|waterfall|beach|cave_entrance|bay|hot_spring|arch)$"]({S},{W},{N},{E});
 nwr["waterway"="waterfall"]({S},{W},{N},{E});
 nwr["leisure"~"^(park|nature_reserve|garden)$"]({S},{W},{N},{E});
 nwr["place"~"^(island|islet)$"]({S},{W},{N},{E});
 nwr["amenity"="place_of_worship"]({S},{W},{N},{E});
 nwr["boundary"="national_park"]({S},{W},{N},{E});
);
out center tags;"""

# Tag giu lai de build map loai + tinh diem (bo phan con lai — nhe file).
KEEP_TAGS = ("name", "name:en", "name:vi", "int_name", "alt_name", "tourism", "historic",
             "natural", "waterway", "leisure", "place", "amenity", "religion", "boundary",
             "wikidata", "wikipedia", "heritage", "heritage:operator", "website", "phone",
             "opening_hours", "ele")


def fetch():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for ep in ENDPOINTS:
        for attempt in range(2):
            try:
                t0 = time.time()
                req = urllib.request.Request(ep, data=data, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=310) as r:
                    d = json.load(r)
                print("OK %s  %.0fs  elements=%d" % (ep, time.time() - t0, len(d.get("elements", []))))
                return d
            except Exception as e:
                last = e
                print("FAIL %s  %s %s" % (ep, type(e).__name__, getattr(e, "code", "")))
                time.sleep(3)
    raise SystemExit("Overpass het endpoint: %r" % last)


def main():
    print("dia diem: %s  bbox S,W,N,E = %.4f,%.4f,%.4f,%.4f" % (slug_of(OUT), S, W, N, E))
    d = fetch()
    recs = []
    for el in d.get("elements", []):
        t = el.get("tags") or {}
        name = t.get("name")
        if not name:
            continue
        if "lat" in el and "lon" in el:
            lat, lon = el["lat"], el["lon"]
        elif "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        recs.append({
            "osm_type": el.get("type"), "osm_id": el.get("id"),
            "name": name, "lat": lat, "lon": lon,
            "tags": {k: t[k] for k in KEEP_TAGS if k in t},
        })
    tmp = OUT + ".tmp"
    json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print("saved -> %s  (named elements: %d)" % (OUT, len(recs)))
    from collections import Counter
    def cls(t):
        for k in ("tourism", "historic", "natural", "waterway", "leisure", "place", "amenity", "boundary"):
            if k in t:
                return "%s=%s" % (k, t[k])
        return "?"
    c = Counter(cls(r["tags"]) for r in recs)
    for k, v in c.most_common(30):
        print("  %4d  %s" % (v, k))


if __name__ == "__main__":
    main()
