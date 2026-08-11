# -*- coding: utf-8 -*-
"""Pass 13 — lap truong trong tu cac nguon raw CHUA doc: osm_facilities.json,
overture_dalat.json, fsq_dalat.json.

Cac nguon nay khong keyed theo diem den — la node/ban ghi rieng le. Nen ap dung
IDENTITY-GATED join (bai hoc 2026-07-30 proximity/identity + 2026-07-29 tim_cum):
  - Ten: token-set cua ten diem la TAP CON token-set ten ban ghi (hoac nguoc lai),
    khop theo TOKEN co bien (khong phai substring — 'banh can' KHONG khop 'banh canh').
  - VA proximity < ban kinh (goc doi chung, khong phai proximity-only).
Chi khi CA HAI thoa moi emit. Node khong ten -> bo (khong co identity).

Dedup theo (id, field) ke ca voi enrichment.json san co -> gia tri cu THANG.
Skip-log dem so node khong khop ('matched nothing' != 'nothing to match').
Append-only, ghi atomic os.replace.
"""
import json, os, sys, io, math, unicodedata
from collections import Counter

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
PULL_DATE = "04/08/2026"
R_OSM = 300      # facility node phai NGAY tai diem
R_AGG = 250      # overture/fsq
GENERIC = {"da", "lat", "tp", "thanh", "pho", "khu", "du", "lich", "kdl", "moi",
           "viet", "nam", "xa", "phuong", "the", "va", "tai", "cua", "tren", "diem"}


def load(fn):
    # City moi (NT/DN) khong co fsq_dalat.json -> optional, tra {} thay vi crash.
    p = os.path.join(RAW, fn)
    if not os.path.exists(p):
        print("  (thiếu %s -> bỏ qua)" % fn)
        return {}
    return json.load(io.open(p, encoding="utf-8"))


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def tokset(name):
    return {t for t in fold(name).split() if len(t) > 2 and t not in GENERIC}


JUNK_WEB = ("wikipedia.org", "youtube.com", "youtu.be", "wikimedia.org")


def clean_web(u):
    """Bo link KHONG phai website lien he (wiki/youtube) — gan lam 'website' la sai."""
    u = (u or "").strip()
    lu = u.lower()
    return None if (not u or any(h in lu for h in JUNK_WEB)) else u


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


# tu category (loai dia diem) — khop chi tren cac tu nay KHONG phai identity
# (vd 'Cho Da Lat' vs 'Cho Do Cu' deu con lai {cho}); can it nhat 1 ten rieng.
CATEGORY = {"cho", "chua", "thac", "doi", "dinh", "nha", "tho", "vuon", "hoa",
            "nui", "deo", "suoi", "quang", "truong", "thien", "vien", "giao",
            "lang", "bao", "tang", "thung", "lung", "ho", "den", "mieu"}


def name_match(dtok, cname):
    """CHINH XAC token-set (bai hoc toponym 2026-07-30): business dat ten theo dia
    danh + o canh se khop neu chi doi hoi tap con -> doi hoi tap-token BANG NHAU.
    VA phai con >=1 ten rieng sau khi bo tu category (bai hoc 2026-07-29 proper-noun):
    khop tren mot minh 'cho'/'chua' la category, khong dinh danh duoc dia diem."""
    ct = tokset(cname)
    return bool(dtok) and dtok == ct and bool(dtok - CATEGORY)


picked = load("guide_data.json")["picked"]
rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}
DTOK = {p["id"]: tokset(p["name"]) for p in picked}


def emit(pid, field, value, source, url, dist):
    if value in (None, "") or (pid, field) in seen:
        return False
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": str(value).strip(), "source": source,
                 "url": url or "", "date": PULL_DATE, "method": "pass13-facilities",
                 "note": "join identity: ten khop + %dm" % round(dist), "match_m": round(dist)})
    return True


added = Counter()
skip = Counter()
MATCHES = []
NAME = {p["id"]: p["name"] for p in picked}

# ── 1. osm_facilities.json (Overpass elements) ─────────────────────────────
OSM_TAGS = [("opening_hours", "gio_mo_cua"), ("fee", "gia_ve"), ("charge", "gia_ve"),
            ("email", "email"), ("contact:email", "email"),
            ("phone", "dien_thoai_facility"), ("contact:phone", "dien_thoai_facility"),
            ("website", "website_facility"), ("contact:website", "website_facility"),
            ("wheelchair", "loi_xe_lan"), ("toilets", "nha_ve_sinh"),
            ("internet_access", "wifi")]
osm = load("osm_facilities.json").get("elements", [])
for el in osm:
    t = el.get("tags") or {}
    nm = t.get("name")
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    if not nm or lat is None or lon is None:
        skip["osm_no_name_or_coord"] += 1
        continue
    url = "https://www.openstreetmap.org/%s/%s" % (el.get("type"), el.get("id"))
    matched = False
    for p in picked:
        d = hav((p["lat"], p["lon"]), (lat, lon))
        if d < R_OSM and name_match(DTOK[p["id"]], nm):
            matched = True
            MATCHES.append((p["id"], NAME[p["id"]], nm, "OSM", round(d)))
            for tag, field in OSM_TAGS:
                if t.get(tag) and emit(p["id"], field, t[tag], "OpenStreetMap", url, d):
                    added[field] += 1
    if not matched:
        skip["osm_no_identity"] += 1

# ── 2. overture_dalat.json ─────────────────────────────────────────────────
ov = load("overture_dalat.json")
for rec in ov:
    nm, lat, lon = rec.get("name"), rec.get("lat"), rec.get("lon")
    if not nm or lat is None or lon is None:
        continue
    dtok = None
    best = None
    for p in picked:
        d = hav((p["lat"], p["lon"]), (lat, lon))
        if d < R_AGG and name_match(DTOK[p["id"]], nm):
            if best is None or d < best[1]:
                best = (p["id"], d)
    if not best:
        continue
    pid, d = best
    MATCHES.append((pid, NAME[pid], nm, "Overture", round(d)))
    for ph in (rec.get("phones") or []):
        if emit(pid, "dien_thoai_facility", ph, "Overture Maps", None, d):
            added["dien_thoai_facility"] += 1
        break
    for w in (rec.get("websites") or []):
        w = clean_web(w)
        if w and emit(pid, "website_facility", w, "Overture Maps", None, d):
            added["website_facility"] += 1
        if w:
            break

# ── 3. fsq_dalat.json ──────────────────────────────────────────────────────
fsq = load("fsq_dalat.json")
for rec in fsq:
    nm, lat, lon = rec.get("name"), rec.get("latitude"), rec.get("longitude")
    if not nm or lat is None or lon is None or rec.get("date_closed"):
        continue
    best = None
    for p in picked:
        d = hav((p["lat"], p["lon"]), (lat, lon))
        if d < R_AGG and name_match(DTOK[p["id"]], nm):
            if best is None or d < best[1]:
                best = (p["id"], d)
    if not best:
        continue
    pid, d = best
    MATCHES.append((pid, NAME[pid], nm, "FSQ", round(d)))
    if rec.get("tel") and emit(pid, "dien_thoai_facility", rec["tel"], "Foursquare",
                               "https://foursquare.com/v/" + str(rec.get("fsq_place_id", "")), d):
        added["dien_thoai_facility"] += 1
    fw = clean_web(rec.get("website"))
    if fw and emit(pid, "website_facility", fw, "Foursquare", None, d):
        added["website_facility"] += 1

tmp = ENRICH + ".tmp"
json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, ENRICH)
print("enrichment.json: %d -> %d  (+%d)" % (before, len(rows), len(rows) - before))
print("them theo truong:")
for k, v in added.most_common():
    print("  +%2d  %s" % (v, k))
print("skip:", dict(skip))
print("\n--- MATCHES (soi identity) ---")
for pid, dn, cn, src, d in MATCHES:
    print("  %s %-24s == %-30s [%s %dm]" % (pid, dn[:24], cn[:30], src, d))
