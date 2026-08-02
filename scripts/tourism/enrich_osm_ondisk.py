# -*- coding: utf-8 -*-
"""Pass 0 — khai thac cac the OSM DA TAI VE nhung chua bao gio doc.

Khong goi mang. Bo trich xuat cu chi lay name/kind/hours/fee/ele/web/tel,
bo qua addr:*, name:en, wikidata, wikipedia, wikimedia_commons, description,
stars, email, check_date, year_of_construction...

Ghi ra enrichment.json — MOT dong cho moi (diem, truong): gia tri, nguon, ngay.
Day la cua duy nhat de mot truong doi tu [UNVERIFIED] sang co gia tri.
"""
import json, os, sys, io, math, unicodedata
from collections import Counter

RAW = sys.argv[1]
OUT = os.path.join(RAW, "enrichment.json")
SRC_LABEL = "OpenStreetMap"
PULL_DATE = "26/07/2026"
MAX_M = 300          # ban kinh khop diem <-> element OSM


def load(fn, default=None):
    for p in (os.path.join(RAW, fn), os.path.join(os.path.dirname(RAW.rstrip("/\\")), fn)):
        if os.path.exists(p):
            return json.load(io.open(p, encoding="utf-8"))
    return default


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


picked = load("guide_data.json", {}).get("picked", [])
els = []
for fn in ("dalat_see.json", "dalat_more.json", "confirm.json", "dalat_stay.json"):
    d = load(fn) or {}
    for e in d.get("elements", []):
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat and lon:
            els.append((lat, lon, e.get("tags") or {}, e.get("type"), e.get("id")))
print(f"{len(picked)} diem  |  {len(els)} element OSM tren dia")


def best_match(r):
    """Gan nhat trong MAX_M. Neu ten khop thi noi long gap doi ban kinh."""
    best, bd = None, 9e9
    f = fold(r["name"])
    for lat, lon, t, typ, oid in els:
        d = hav((r["lat"], r["lon"]), (lat, lon))
        nm = fold(t.get("name"))
        lim = MAX_M * 2 if nm and (nm in f or f in nm) else MAX_M
        if d < bd and d < lim:
            bd, best = d, (t, typ, oid, d)
    return best


rows = []


def emit(pid, field, value, note="", el=None, dist=None):
    if value in (None, "") or (isinstance(value, str) and not value.strip()):
        return
    url = f"https://www.openstreetmap.org/{el[1]}/{el[2]}" if el else ""
    rows.append({"id": pid, "field": field, "value": str(value).strip(),
                 "source": SRC_LABEL, "url": url, "date": PULL_DATE,
                 "method": "pass0-ondisk", "note": note,
                 "match_m": round(dist) if dist is not None else None})


n_match = 0
for r in picked:
    m = best_match(r)
    if not m:
        continue
    t, typ, oid, d = m
    n_match += 1
    el = (t, typ, oid)

    # --- dia chi: ghep tu addr:* ---
    house, street = t.get("addr:housenumber"), t.get("addr:street")
    if street:
        emit(r["id"], "dia_chi_osm", " ".join(x for x in (house, street) if x), el=el, dist=d)
    ward = t.get("addr:subdistrict") or t.get("addr:quarter") or t.get("addr:suburb")
    if ward:
        emit(r["id"], "phuong_xa", ward, el=el, dist=d)

    # --- ten ---
    for k, lab in (("name:en", "ten_en"), ("name:vi", "ten_vi"), ("alt_name", "ten_khac")):
        if t.get(k):
            emit(r["id"], lab, t[k], el=el, dist=d)

    # --- gio mo cua / gia ve: truong gia tri nhat trong ca file ---
    if t.get("opening_hours"):
        emit(r["id"], "gio_mo_cua", t["opening_hours"],
             note=f"check_date={t['check_date:opening_hours']}" if t.get("check_date:opening_hours") else "",
             el=el, dist=d)
    if t.get("fee") or t.get("charge"):
        emit(r["id"], "gia_ve", t.get("charge") or t.get("fee"), el=el, dist=d)

    # --- lien he ---
    for k, lab in (("email", "email"), ("contact:email", "email"),
                   ("contact:facebook", "facebook"), ("contact:phone", "dien_thoai_osm"),
                   ("website", "website_osm"), ("contact:website", "website_osm")):
        if t.get(k):
            emit(r["id"], lab, t[k], el=el, dist=d)

    # --- hat giong cho Pass 2 ---
    for k, lab in (("wikidata", "wikidata_qid"), ("wikipedia", "wikipedia"),
                   ("wikimedia_commons", "commons")):
        if t.get(k):
            emit(r["id"], lab, t[k], el=el, dist=d)

    # --- boi canh, co nguon, khong phai bia ---
    if t.get("description"):
        emit(r["id"], "mo_ta_osm", t["description"], el=el, dist=d)
    if t.get("year_of_construction"):
        emit(r["id"], "nam_xay_dung", t["year_of_construction"], el=el, dist=d)
    if t.get("building:architecture"):
        emit(r["id"], "kien_truc", t["building:architecture"], el=el, dist=d)
    if t.get("stars"):
        emit(r["id"], "hang_sao_tu_khai", t["stars"],
             note="OSM stars la tu khai, KHONG phai xep hang nha nuoc", el=el, dist=d)
    if t.get("religion"):
        emit(r["id"], "ton_giao", t["religion"], el=el, dist=d)
    if t.get("check_date"):
        emit(r["id"], "osm_check_date", t["check_date"], el=el, dist=d)

    # --- tien nghi: gan nhu chac chan rong, van thu ---
    for k, lab in (("wheelchair", "loi_xe_lan"), ("toilets", "nha_ve_sinh"),
                   ("toilets:wheelchair", "wc_xe_lan"), ("bench", "cho_ngoi"),
                   ("drinking_water", "nuoc_uong"), ("internet_access", "wifi"),
                   ("outdoor_seating", "cho_ngoi_ngoai_troi")):
        if t.get(k):
            emit(r["id"], lab, t[k], el=el, dist=d)

json.dump(rows, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"khop duoc {n_match}/{len(picked)} diem voi element OSM")
print(f"SAVED {len(rows)} dong -> {OUT}\n")
c = Counter(r["field"] for r in rows)
for k, v in c.most_common():
    print(f"  {v:3d}  {k}")
print(f"\nso diem duoc bo sung it nhat 1 truong: {len({r['id'] for r in rows})}")
