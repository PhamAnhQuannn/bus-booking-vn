# -*- coding: utf-8 -*-
"""Stage 1 — resolve icon marquee THIẾU (có trong areas.json signatureSpots, vắng trong export).

Nguồn coords/mô-tả: Wikidata (name search → QID → P625/P17/P18 + mô-tả vi), ToS-sạch, storable.
place_id + address(ward) + coords-fallback: Google Text Search (sweep_google_placeid.goi).
KHÔNG BỊA: icon nào không resolve được (không Wikidata, không Google) → bỏ, in SKIP.

Chạy TỪ tourism-kb/:  python code/seed_missing_icons.py <slug> [<slug> ...]  [--write]
  (mặc định DRY: chỉ in + ghi raw/_shared/area_seed_resolved.json để review)
"""
import io
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sweep_google_placeid import doc_khoa, goi  # noqa: E402

EXPORT = os.path.join(HERE, "..", "export")
AREAS = os.path.join(HERE, "..", "..", "trip-planner", "lib", "planner", "areas.json")
OUT = os.path.join(HERE, "..", "raw", "_shared", "area_seed_resolved.json")
UA = "BusBookingTourismKB/1.0 (data-quality research; contact dev)"
WD = "https://www.wikidata.org/w/api.php?"
ENT = "https://www.wikidata.org/wiki/Special:EntityData/%s.json"
VN = "Q881"          # country Vietnam
DIST_KM = 60.0       # candidate phải trong bán kính này quanh tâm tp

# slug → hậu tố tìm kiếm (bối cảnh tỉnh/tp, disambiguate Wikidata/Google)
SUFFIX = {
    "sa-pa": "Sa Pa Lào Cai", "ninh-binh": "Ninh Bình", "ha-noi": "Hà Nội",
    "hue": "Huế", "phu-quoc": "Phú Quốc", "da-lat": "Đà Lạt", "da-nang": "Đà Nẵng",
    "ha-long": "Hạ Long Quảng Ninh", "vung-tau": "Vũng Tàu", "nha-trang": "Nha Trang",
}
# loai_vn theo keyword tên (đủ cho icon; fallback 'Điểm tham quan')
LOAI = [
    ("nhà thờ", "Nhà thờ"), ("chùa", "Chùa"), ("đền", "Đền"), ("thác", "Thác"),
    ("hang", "Hang động"), ("động", "Hang động"), ("đèo", "Đèo"), ("núi", "Núi"),
    ("đỉnh", "Núi"), ("thung lũng", "Thung lũng"), ("bản", "Bản làng"),
    ("vườn quốc gia", "Vườn quốc gia"), ("hồ", "Hồ"), ("cố đô", "Di tích lịch sử"),
    ("đầm", "Đầm/Hồ"), ("cầu", "Cầu"), ("quảng trường", "Quảng trường"),
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise


_LODGING = re.compile(r"hotel|hostel|homestay|bungalow|guest\s?house|resort|"
                      r"nhà nghỉ|khách sạn|nhà khách", re.I)


def hav(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2
                             + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


def fold(s):
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def loai_of(name):
    f = fold(name)
    for kw, lv in LOAI:
        if kw in f:
            return lv
    return "Điểm tham quan"


def sigmap():
    raw = json.load(io.open(AREAS, encoding="utf-8"))
    m = {}
    for k, v in raw.items():
        if isinstance(v, dict):
            for slug, val in v.items():
                if isinstance(val, dict) and val.get("signatureSpots"):
                    m[slug] = val["signatureSpots"]
    for a in raw.get("areas", []):
        if a.get("slug") and a.get("signatureSpots"):
            m[a["slug"]] = a["signatureSpots"]
    return m


def export_names(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return []
    return [fold(r.get("name", "")) for r in json.load(io.open(p, encoding="utf-8"))]


def center(slug):
    p = os.path.join(EXPORT, slug, "meta.json")
    t = (json.load(io.open(p, encoding="utf-8")).get("tam") or {}) if os.path.exists(p) else {}
    return (t.get("lat"), t.get("lon")) if t.get("lat") else None


def wikidata(name, cen):
    """Trả (qid, lat, lon, mo_ta, image_url) hoặc None."""
    q = urllib.parse.urlencode({"action": "wbsearchentities", "search": name,
                                "language": "vi", "uselang": "vi", "format": "json", "limit": 5})
    try:
        hits = get(WD + q).get("search", [])
    except Exception:
        return None
    best = None
    for h in hits:
        qid = h["id"]
        try:
            ent = get(ENT % qid)["entities"][qid]
        except Exception:
            continue
        cl = ent.get("claims", {})
        p625 = cl.get("P625")
        if not p625:
            continue
        try:
            v = p625[0]["mainsnak"]["datavalue"]["value"]
            lat, lon = v["latitude"], v["longitude"]
        except Exception:
            continue
        country = None
        if cl.get("P17"):
            try:
                country = cl["P17"][0]["mainsnak"]["datavalue"]["value"]["id"]
            except Exception:
                pass
        d = hav(cen, (lat, lon)) if cen else None
        if cen is not None:
            if d > DIST_KM:            # xa tâm tp = sai địa danh (kể cả trong VN: brand trùng tên)
                continue
        elif country != VN:            # không có tâm → ít nhất phải ở VN
            continue
        d = d if d is not None else 999
        # loại hotel/hostel/homestay: xét label + description MỌI ngôn ngữ (vi thường trống)
        blob = " ".join(
            [(ent.get("labels", {}).get(lg, {}) or {}).get("value", "") for lg in ("vi", "en")]
            + [(ent.get("descriptions", {}).get(lg, {}) or {}).get("value", "") for lg in ("vi", "en")])
        if _LODGING.search(blob):
            continue
        desc = (ent.get("descriptions", {}).get("vi", {}) or {}).get("value")
        img = None
        if cl.get("P18"):
            try:
                fn = cl["P18"][0]["mainsnak"]["datavalue"]["value"].replace(" ", "_")
                img = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn)
            except Exception:
                pass
        cand = (qid, lat, lon, desc, img, d)
        if best is None or d < best[5]:
            best = cand
    return best[:5] if best else None


def google(name, cen, khoa):
    """Trả (place_id, lat, lon, address) hoặc None — Text Search."""
    lat, lon = (cen or (None, None))
    try:
        res = goi(name, None, lat, lon, khoa)
    except Exception:
        return None
    for p in res or []:
        pid = p.get("id")
        loc = p.get("location") or {}
        gla, glo = loc.get("latitude"), loc.get("longitude")
        addr = p.get("formattedAddress")
        if pid and gla is not None:
            if cen and hav(cen, (gla, glo)) > DIST_KM:
                continue
            return pid, gla, glo, addr
    return None


def resolve_city(slug, khoa):
    sigs = sigmap().get(slug, [])
    have = export_names(slug)
    cen = center(slug)
    absent = [s for s in sigs if not any(fold(s) in nm or nm in fold(s) for nm in have)]
    print("\n== %s == center=%s · signatureSpots=%d · absent=%d"
          % (slug, cen, len(sigs), len(absent)))
    out = []
    for icon in absent:
        query = "%s %s" % (icon, SUFFIX.get(slug, ""))
        wd = wikidata(icon, cen)
        time.sleep(0.2)
        gg = google(query.strip(), cen, khoa) if khoa else None
        time.sleep(0.15)
        lat = lon = pid = qid = mo_ta = img = addr = None
        if wd:
            qid, lat, lon, mo_ta, img = wd
        if gg:
            pid, gla, glo, addr = gg
            if lat is None:      # Wikidata trượt → dùng coords Google
                lat, lon = gla, glo
        if lat is None:
            print("  SKIP  %-22s (không Wikidata, không Google)" % icon)
            continue
        rec = dict(slug=slug, icon=icon, ten=icon, lat=round(lat, 6), lon=round(lon, 6),
                   loai=loai_of(icon), place_id=pid, qid=qid,
                   mo_ta=mo_ta, image=img, address=addr,
                   src=("wikidata" if qid else "google"))
        out.append(rec)
        print("  OK    %-22s %-14s %s  pid=%s  (%.4f,%.4f)"
              % (icon, rec["loai"], "wd:" + qid if qid else "google", "Y" if pid else "-", lat, lon))
    # dedup theo (qid | place_id): cùng thực thể (vd fansipan≡phan xi păng) → 1 record, gộp alt
    seen = {}
    deduped = []
    for r in out:
        key = r.get("qid") or r.get("place_id")
        if key and key in seen:
            alt = seen[key].setdefault("alt", [])
            if r["icon"] not in alt:
                alt.append(r["icon"])
            print("  DEDUP %-22s ≡ %s" % (r["icon"], seen[key]["ten"]))
            continue
        if key:
            seen[key] = r
        deduped.append(r)
    return deduped


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    khoa, nguon = doc_khoa()
    print("google key:", "có (" + nguon + ")" if khoa else "KHÔNG (chỉ Wikidata)")
    allout = []
    for slug in args:
        allout += resolve_city(slug, khoa)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # merge với file cũ (theo slug đang chạy: thay entries của slug đó)
    prev = json.load(io.open(OUT, encoding="utf-8")) if os.path.exists(OUT) else []
    prev = [r for r in prev if r["slug"] not in args]
    data = prev + allout
    tmp = OUT + ".tmp"
    json.dump(data, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print("\nĐã ghi %d seed → %s (%s)" % (len(allout), OUT, "WRITE-mode" if write else "DRY review"))


if __name__ == "__main__":
    main()
