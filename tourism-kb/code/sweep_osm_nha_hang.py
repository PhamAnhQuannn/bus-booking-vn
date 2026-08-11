# -*- coding: utf-8 -*-
"""Nha hang / quan an tu OSM (Overpass) — danh ba FREE, PIP clip theo tinh.

Thay sweep_nha_hang.py (doc overture_dalat.json — chi 4 tinh co + KHONG PIP). Query amenity an-uong
trong bbox tinh -> clip PIP boundary.geojson -> nha_hang.json {quan:[...]} (schema KHOP export_planner).
`hang_muc` = key kieu-Overture (build_nha_hang_docx.HANG_MUC_VN doc) suy tu cuisine/amenity. `mon` = cuisine.
`tin_cay` = diem day-du (website/phone/dia_chi/cuisine) -> export sort chon quan established. `da_dong_cua`=None
(OSM khong co tin cay). Cap ~CAP theo tin_cay desc (export lay 250). KHONG rating/gia (doctrine).

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_osm_nha_hang.py tourism-kb/raw/<slug>/scrape
"""
import sys, os, io, json, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of
from ranh_gioi import load_boundary, in_boundary

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 300
XMIN, YMIN, XMAX, YMAX = cfg(RAW)["bbox"]
S, W, N, E = YMIN, XMIN, YMAX, XMAX
SLUG = slug_of(RAW)
OUT = os.path.join(RAW, "nha_hang.json")
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter",
             "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

QUERY = f"""[out:json][timeout:300];
(
 nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|biergarten|food_court|ice_cream)$"]["name"]({S},{W},{N},{E});
);
out center tags;"""

# amenity -> key kieu-Overture (HANG_MUC_VN biet). cuisine tinh te hon -> uu tien.
AMEN = {"restaurant": "restaurant", "cafe": "cafe", "fast_food": "fast_food_restaurant",
        "bar": "bar", "pub": "pub", "biergarten": "beer_garden", "food_court": "eat_and_drink",
        "ice_cream": "ice_cream_shop"}
CUIS = {"vietnamese": "vietnamese_restaurant", "coffee_shop": "coffee_shop", "coffee": "cafe",
        "seafood": "seafood_restaurant", "pizza": "pizza_restaurant", "chinese": "chinese_restaurant",
        "japanese": "japanese_restaurant", "sushi": "sushi_restaurant", "korean": "korean_restaurant",
        "thai": "thai_restaurant", "italian": "italian_restaurant", "indian": "indian_restaurant",
        "burger": "burger_restaurant", "noodle": "noodles_restaurant", "bbq": "barbecue_restaurant",
        "barbecue": "barbecue_restaurant", "vegetarian": "vegetarian_restaurant", "ice_cream": "ice_cream_shop",
        "bubble_tea": "bubble_tea", "dessert": "desserts", "bakery": "bakery", "steak": "steakhouse",
        "steak_house": "steakhouse", "chicken": "chicken_restaurant", "french": "french_restaurant",
        "american": "american_restaurant", "buffet": "buffet_restaurant", "fast_food": "fast_food_restaurant",
        "asian": "asian_restaurant", "cake": "bakery", "tea": "tea_room"}


def fetch():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for ep in ENDPOINTS:
        for _ in range(2):
            try:
                t0 = time.time()
                with urllib.request.urlopen(urllib.request.Request(ep, data=data, headers={"User-Agent": UA}), timeout=310) as r:
                    d = json.load(r)
                print("OK %s %.0fs elements=%d" % (ep, time.time() - t0, len(d.get("elements", []))))
                return d
            except Exception as e:
                last = e
                print("FAIL %s %s %s" % (ep, type(e).__name__, getattr(e, "code", "")))
                time.sleep(3)
    raise SystemExit("Overpass het endpoint: %r" % last)


def addr(t):
    hn, st = t.get("addr:housenumber"), t.get("addr:street")
    head = ("%s %s" % (hn, st)).strip() if st else None
    tail = [t[k] for k in ("addr:subdistrict", "addr:district", "addr:city", "addr:province") if t.get(k)]
    return ", ".join([x for x in [head] + tail if x]) or None


def hang_muc(t):
    for c in (t.get("cuisine") or "").split(";"):
        m = CUIS.get(c.strip().lower())
        if m:
            return m
    return AMEN.get(t.get("amenity"), "restaurant")


def main():
    print("dia diem: %s  bbox S,W,N,E = %.4f,%.4f,%.4f,%.4f" % (SLUG, S, W, N, E))
    B = load_boundary(RAW)
    print("boundary:", "co (clip PIP)" if B else "khong")
    d = fetch()
    seen, quan, clip = set(), [], 0
    for el in d.get("elements", []):
        t = el.get("tags") or {}
        name = (t.get("name") or "").strip()
        if len(name) < 2:
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        if not in_boundary(float(lon), float(lat), B):
            clip += 1
            continue
        key = (name.lower(), round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        mon = [c.strip() for c in (t.get("cuisine") or "").split(";") if c.strip()]
        dia = addr(t)
        web = t.get("website") or t.get("contact:website")
        tel = t.get("phone") or t.get("contact:phone")
        fb = t.get("contact:facebook") or t.get("facebook")
        tin = round(sum([bool(web), bool(tel), bool(dia), bool(mon)]) / 4.0, 3)
        quan.append({"ten": name, "hang_muc": hang_muc(t), "lat": lat, "lon": lon,
                     "dia_chi": dia, "dien_thoai": tel, "facebook": fb, "website": web,
                     "tin_cay": tin, "mon": mon, "da_dong_cua": None})
    quan.sort(key=lambda q: q["tin_cay"], reverse=True)
    tong = len(quan)
    if CAP and tong > CAP:
        quan = quan[:CAP]
    tmp = OUT + ".tmp"
    json.dump({"quan": quan, "dong_cua_ngoai_danh_sach": []}, io.open(tmp, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print("%s — %d/%d quán (clip ngoài tỉnh %d, cap %s) -> %s"
          % (SLUG, len(quan), tong, clip, CAP or "—", OUT))
    print("   địa chỉ %d · điện thoại %d · website %d · món %d"
          % (sum(1 for q in quan if q["dia_chi"]), sum(1 for q in quan if q["dien_thoai"]),
             sum(1 for q in quan if q["website"]), sum(1 for q in quan if q["mon"])))


if __name__ == "__main__":
    main()
