# -*- coding: utf-8 -*-
"""Khach san / luu tru tu OSM (Overpass) — danh ba FREE, PIP clip theo tinh.

Thay sweep_luu_tru_overture.py (doc overture_dalat.json — chi 4 tinh + KHONG PIP). Query tourism luu tru
trong bbox tinh -> clip PIP -> luu_tru.json {co_so:[...]} (schema KHOP export_planner.ks_rec). `loai` = key
kieu-Overture (build_khach_san_docx.LOAI_VN doc). Sort theo diem day-du desc, cap ~CAP. **KHONG luu sao/gia**
(doctrine: no star grade; OSM stars self-declared -> bo). gia/tham_dinh/so_phong = null (export null-hoa).

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/sweep_osm_luu_tru.py tourism-kb/raw/<slug>/scrape
"""
import sys, os, io, json, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of
from ranh_gioi import load_boundary, in_boundary

RAW = sys.argv[1]
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 500
XMIN, YMIN, XMAX, YMAX = cfg(RAW)["bbox"]
S, W, N, E = YMIN, XMIN, YMAX, XMAX
SLUG = slug_of(RAW)
OUT = os.path.join(RAW, "luu_tru.json")
UA = "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"
ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter",
             "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

QUERY = f"""[out:json][timeout:300];
(
 nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment|chalet|resort|love_hotel|alpine_hut)$"]["name"]({S},{W},{N},{E});
);
out center tags;"""

# tourism -> key kieu-Overture LODGE (LOAI_VN biet). apartment/chalet/... -> accommodation.
LOAI = {"hotel": "hotel", "guest_house": "guest_house", "hostel": "hostel", "motel": "motel",
        "resort": "resort", "love_hotel": "motel", "apartment": "accommodation",
        "chalet": "accommodation", "alpine_hut": "accommodation"}


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


def main():
    print("dia diem: %s  bbox S,W,N,E = %.4f,%.4f,%.4f,%.4f" % (SLUG, S, W, N, E))
    B = load_boundary(RAW)
    print("boundary:", "co (clip PIP)" if B else "khong")
    d = fetch()
    seen, co_so, clip = set(), [], 0
    for el in d.get("elements", []):
        t = el.get("tags") or {}
        name = (t.get("name") or "").strip()
        if len(name) < 3:
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
        dia = addr(t)
        tel = t.get("phone") or t.get("contact:phone")
        fb = t.get("contact:facebook") or t.get("facebook")
        web = t.get("website") or t.get("contact:website")
        tin = round(sum([bool(web), bool(tel), bool(dia)]) / 3.0, 3)
        co_so.append({"ten": name, "loai": LOAI.get(t.get("tourism"), "accommodation"),
                      "lat": lat, "lon": lon, "dia_chi": dia, "dien_thoai": tel,
                      "facebook": fb, "tin_cay": tin})
    co_so.sort(key=lambda c: c["tin_cay"], reverse=True)
    tong = len(co_so)
    if CAP and tong > CAP:
        co_so = co_so[:CAP]
    if not co_so:
        # tinh khong co luu tru OSM -> ghi rong hop le (export null-hoa)
        print("%s — 0 cơ sở lưu trú OSM" % SLUG)
    tmp = OUT + ".tmp"
    json.dump({"nguon": "osm", "dia_diem": SLUG, "co_so": co_so, "dong_cua_ngoai_dang_ky": []},
              io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print("%s — %d/%d cơ sở lưu trú (clip ngoài tỉnh %d, cap %s) -> %s"
          % (SLUG, len(co_so), tong, clip, CAP or "—", OUT))
    print("   địa chỉ %d · điện thoại %d. Giá/sao/thẩm định = null (OSM không có / doctrine không lưu sao)."
          % (sum(1 for c in co_so if c["dia_chi"]), sum(1 for c in co_so if c["dien_thoai"])))


if __name__ == "__main__":
    main()
