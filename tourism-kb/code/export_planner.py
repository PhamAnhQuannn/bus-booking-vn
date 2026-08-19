# -*- coding: utf-8 -*-
"""Xuat du lieu Da Lat sang JSON truy-van-duoc cho AI trip-planner (SCHEMA GIAU).

Shared core + per-category ext; provenance FIELD-LEVEL (source_id -> sources.json);
null-skeleton (moi field luon co; null=chua xac minh; non-null=claim co provenance).
`verified_fields`, `source_ids` la SINH ra, khong tu tay. `conflicts` mang GIA TRI mau thuan.
KHONG co `visit_duration` (khong nguon) va KHONG co field rank (ToS — chi luu external_ids).

Ghi vao tourism-kb/export/<dia-diem>/ qua kiem_loi_ra (export/ da nam trong .gitignore + G8).
Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/export_planner.py [tourism-kb/raw/<slug>/scrape]
"""
import os
import re
import sys
import json
import hashlib
import unicodedata

import duong_dan_ra as _dr
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg as _cfg, slug_of as _slug_of
import anh_huong as _ah                        # sap output theo THU TU anh huong (VQS noi bo)
import trai_nghiem as _tn                       # nhan trai nghiem (category.primary -> "Ngam canh"...)
import vibes as _vb                             # slug vibe: rule (category) + fold cache LLM (enrich_vibes)

RAW = sys.argv[1] if len(sys.argv) > 1 else "tourism-kb/raw/da-lat/scrape"
DIA_DIEM = _slug_of(RAW)                      # slug tu duong dan (da-lat neu raw/ phang)
CITY_DIR = os.path.dirname(RAW.rstrip("/\\"))  # raw/<slug> — sibling noi-bo/ (rank anh huong)
CITY_CFG = _cfg(RAW)
OUT_DIR = "tourism-kb/export/" + DIA_DIEM
TOP_NHA_HANG = 250
DOW = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
_D2 = {"Mo": 0, "Tu": 1, "We": 2, "Th": 3, "Fr": 4, "Sa": 5, "Su": 6}

# ── tien ich ──────────────────────────────────────────────────────────────
def _doc(fn):
    with open(os.path.join(RAW, fn), encoding="utf-8") as f:
        return json.load(f)

def _doc_opt(fn, default):
    """Doc file tuy chon — city moi (scope diem-den) khong co nha_hang/luu_tru/place_id."""
    try:
        return _doc(fn)
    except FileNotFoundError:
        return default

# Cache vibe LLM (tuy chon) — {id: {"vibes":[...], "model":..., "date":...}}, sinh boi enrich_vibes.py.
# Vang cache -> vibes = rule-only (graceful). Build 2-pass: export -> enrich_vibes -> export lai.
VIBES_LLM = _doc_opt("vibes_llm.json", {})

def _vibes_for(rec):
    """Rule (tu category) + LLM cache -> (list slug ROI RAC, nguon). Chi giu slug trong VIBE_VOCAB."""
    cat = rec.get("category") or {}
    rule = _vb.nhan_vibes_rule(cat.get("primary"), cat.get("secondary"))
    ent = VIBES_LLM.get(rec.get("id")) or {}
    llm = [v for v in (ent.get("vibes") or []) if v in _vb.VIBE_SET]
    keep = set(rule) | set(llm)
    merged = [v for v in _vb.VIBE_VOCAB if v in keep]
    nguon = "rule+llm" if rule and llm else ("llm" if llm else ("rule" if rule else "none"))
    return merged, nguon

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "d")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def slug_id(prefix, ten, lat, lon, dia_chi):
    h = hashlib.md5("{}|{}|{}|{}".format(ten, lat, lon, dia_chi).encode("utf-8")).hexdigest()[:6]
    return "{}-{}-{}".format(prefix, fold(ten)[:40] or "x", h)

def rong(v):
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v

def num_m(s):
    if s is None:
        return None
    m = re.search(r"[-+]?\d+", str(s))
    return int(m.group()) if m else None

def ghi(fn, obj):
    p = _dr.kiem_loi_ra(os.path.join(OUT_DIR, fn))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)

# ── so hoa nguon (sources.json chuan hoa) ──────────────────────────────────
class Sources:
    def __init__(self):
        self._m = {}
        self.rows = []
    def id_of(self, name, url=None, type_=None, date=None):
        name = rong(name)
        if name is None and rong(url) is None:
            return None
        key = (name or "") + "|" + (url or "")
        if key not in self._m:
            sid = "src-{:03d}".format(len(self.rows) + 1)
            self._m[key] = sid
            self.rows.append({"id": sid, "name": name, "type": type_, "url": rong(url), "retrieved_at": rong(date)})
        return self._m[key]

SRC = Sources()

# ── phan tich gio mo OSM (nhe, fallback giu raw) ───────────────────────────
def day_range(a, b):
    ia, ib = _D2.get(a), _D2.get(b)
    if ia is None or ib is None:
        return DOW[:]
    return [DOW[i % 7] for i in range(ia, (ib if ib >= ia else ib + 7) + 1)]

def parse_hours(val):
    raw = rong(val)
    if raw is None:
        return None, False
    raw = raw.strip()
    if raw == "24/7":
        return {"raw": raw, "regular_schedule": [{"days": DOW[:], "open": "00:00", "close": "24:00"}]}, False
    sched = []
    for part in raw.split(";"):
        part = part.strip()
        days = DOW[:]
        m = re.match(r"^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})\s+(.*)$", part)
        rest = part
        if m and m.group(1) in _D2 and m.group(2) in _D2:
            days = day_range(m.group(1), m.group(2))
            rest = m.group(3)
        for o, c in re.findall(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", rest):
            sched.append({"days": days, "open": o, "close": c})
    if not sched:
        # khong phan tich duoc (vd ghi chu mau thuan) -> giu raw, danh dau
        return {"raw": raw, "regular_schedule": [], "note": "khong phan tich duoc gio tu chuoi"}, True
    return {"raw": raw, "regular_schedule": sched}, False

# ── nap du lieu ───────────────────────────────────────────────────────────
G = _doc("guide_data.json")
BUILD = G["build_date"]
PICKED = G["picked"]
NEAR = G.get("near", {})
MATRIX = G.get("matrix", {})

# enrichment.json OPTIONAL: city moi (OSM diem-den) co the export truoc, enrich (mo ta/anh/gio)
# la pass SAU. Thieu -> moi field enrich = null (dung policy "null = chua xac minh").
ENR = {}
for r in _doc_opt("enrichment.json", []):
    ENR.setdefault(r["id"], {})[r["field"]] = r

# manifest anh da tai ve (fetch_anh.py) -> gallery tro path local; thieu thi fallback URL
try:
    ANH_FILES = _doc("anh_files.json")
except FileNotFoundError:
    ANH_FILES = {}

# PID_MAP gop ca bundle DL (place_id.json) LAN Overture-resolved NT/DN (place_id_luu_tru/quan) ->
# hotel/quan NT/DN co identity.place_id -> rank-join manh (place_id > fold(ten)) + claim "rating live
# qua google_place_id" dung. Khong de len: file dau tien thang (setdefault).
PID_MAP = {}
for _pf in ("place_id.json", "place_id_luu_tru.json", "place_id_quan.json", "place_id_diem_den.json"):
    for r in _doc_opt(_pf, {}).get("co_so", []):
        if r.get("place_id"):
            PID_MAP.setdefault(fold(r["ten"]), r["place_id"])
def place_id_of(ten):
    return PID_MAP.get(fold(ten))

# editorial_group tu hang_muc (copy NHOM_QUAN cua an_ngu_data)
_NHOM = [
    ("Quán Việt", {"vietnamese_restaurant", "noodles_restaurant", "soup_restaurant", "eat_and_drink", "diner", "food_stand", "food"}),
    ("Lẩu · nướng · hải sản", {"barbecue_restaurant", "bar_and_grill_restaurant", "seafood_restaurant", "chicken_restaurant", "steakhouse", "hot_pot"}),
    ("Cà phê · trà", {"coffee_shop", "cafe", "tea_room", "bubble_tea", "smoothie_juice_bar", "hong_kong_style_cafe"}),
    ("Bánh · tráng miệng", {"bakery", "desserts", "ice_cream_shop", "delicatessen"}),
    ("Món chay", {"vegetarian_restaurant", "health_food_restaurant"}),
    ("Bếp nước ngoài", {"korean_restaurant", "japanese_restaurant", "thai_restaurant", "chinese_restaurant", "indian_restaurant", "french_restaurant", "italian_restaurant", "pizza_restaurant", "sushi_restaurant", "asian_restaurant", "american_restaurant", "burger_restaurant", "taiwanese_restaurant", "mediterranean_restaurant"}),
    ("Quán bar · pub", {"bar", "pub", "cocktail_bar", "beer_bar", "beer_garden", "wine_bar", "gastropub", "sports_bar", "brewery", "sake_bar"}),
]
def editorial_group(hm):
    for label, cats in _NHOM:
        if hm in cats:
            return label
    return None

# tourism_mentions tu quan_vlog (join theo ten da fold): so kenh YouTube doc lap >=2
VLOG = {}
for v in _doc_opt("quan_vlog.json", {}).get("quan", []):
    VLOG[fold(v["ten"])] = {"channel_count": v.get("so_kenh_nhac"), "video_count": v.get("so_video_nhac")}

def e(pid, field):
    """Tra ban ghi enrichment cho (pid, field) neu co value that."""
    r = ENR.get(pid, {}).get(field)
    if r and rong(r.get("value")) is not None:
        return r
    return None

def prov_val(pid, field, type_=None):
    """{value, source_id, retrieved_at} tu enrichment, hoac None."""
    r = e(pid, field)
    if not r:
        return None
    return {
        "value": r["value"],
        "source_id": SRC.id_of(r.get("source"), r.get("url"), type_, r.get("date")),
        "retrieved_at": rong(r.get("date")),
    }

# ── regions.json (vocab co dinh tu picked.area) ────────────────────────────
region_ids = {}
regions = []
for r in PICKED:
    area = rong(r.get("area"))
    if area and area not in region_ids:
        rid = fold(area)
        region_ids[area] = rid
        regions.append({"id": rid, "name": area})

# ── ho tro data_quality/source_ids sinh ra ─────────────────────────────────
def finalize(rec):
    """Sinh verified_fields[] + source_ids[] tu cac leaf co source_id (de quy)."""
    vf, sids = [], set()
    def walk(node, path):
        if isinstance(node, dict):
            if "source_id" in node and node.get("source_id"):
                vf.append(path.lstrip("."))
                sids.add(node["source_id"])
            for k, v in node.items():
                if k not in ("source_id", "retrieved_at", "value", "raw", "regular_schedule"):
                    walk(v, path + "." + k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, path + "[]")
    walk(rec, "")
    rec["data_quality"]["verified_fields"] = sorted(set(vf))
    rec["source_ids"] = sorted(sids)
    return rec

def core(id_, ten, lat, lon, cat_primary, cat_secondary, region_id, full_addr,
         phone, website, facebook, email, place_id, acc_note):
    return {
        "id": id_,
        "identity": {"place_id": place_id, "fold_key": fold(ten)},
        "slug": fold(ten),
        "name": ten,
        "alternate_names": [],
        "category": {"primary": cat_primary, "secondary": cat_secondary or []},
        "region_id": region_id,
        "address": {"full_address": full_addr, "city": CITY_CFG["city"], "province": CITY_CFG["province"], "country": "Việt Nam"},
        "coordinates": {"latitude": lat, "longitude": lon, "precision_m": None, "accuracy_note": acc_note},
        "contact": {"phone": phone, "website": website, "facebook": facebook, "email": email},
        "description": None,
        "external_ids": {"google_place_id": place_id, "tripadvisor_location_id": None},
        "data_quality": {"verified_fields": [], "conflicts": {}, "warnings": [],
                         "last_verified_at": None, "verification_method": None},
        "source_ids": [],
    }

# ── 1. diem den ────────────────────────────────────────────────────────────
# SÀN provenance cho diem den: source_ids sinh tu leaf enrichment; diem hint-only (khong co leaf,
# vd bai bien/ban dao chua enrich) tung ra source_ids=[] -> vi pham "0 dong bia". Mint tu nhan
# resolver (picked["src"]: Overture/Wikidata/curated hint) khi rong -> MOI diem >=1 source, hint ghi
# TRUNG THUC. Mirror pattern nha_hang/khach_san (rec["source_ids"]=[SRC]).
SRC_OVT_DD = SRC.id_of("Overture Maps (khop ten diem den)", None, "aggregate", BUILD)
SRC_WIKI_DD = SRC.id_of("Wikidata (khop toa do diem den)", None, "encyclopedia", BUILD)
SRC_OSM_DD = SRC.id_of("OpenStreetMap (tag diem den: tourism/historic/natural)", None, "aggregate", BUILD)
SRC_HINT_DD = SRC.id_of("Curator dat toa do (chua xac minh nguon ngoai)", None, "curated", BUILD)
SRC_CSDL_DD = SRC.id_of("Register diem den — Cuc Du lich Quoc gia (csdl.vietnamtourism.gov.vn/dest)",
                        None, "registry", BUILD)
def _src_dd(src):
    lab = (src or ["curated hint"])
    lab = str(lab[0] if isinstance(lab, list) and lab else lab).lower()
    if "overture" in lab:
        return SRC_OVT_DD
    if "wikidata" in lab:
        return SRC_WIKI_DD
    if "osm" in lab:
        return SRC_OSM_DD
    if "csdl" in lab:
        return SRC_CSDL_DD
    return SRC_HINT_DD

diem_den = []
for r in PICKED:
    if r.get("closed"):
        continue
    pid = r["id"]
    alt = list(r.get("alt") or [])
    for f in ("ten_en", "ten_vi", "ten_khac"):
        ev = e(pid, f)
        if ev and ev["value"] not in alt:
            alt.append(ev["value"])
    addr = prov_val(pid, "dia_chi_day_du") or prov_val(pid, "dia_chi_osm")
    rec = core(
        pid, r["name"], r["lat"], r["lon"], rong(r.get("loai_vn")), r.get("loai_phu"),
        region_ids.get(rong(r.get("area"))),
        (addr or {}).get("value") or rong(r.get("addr")),
        rong(r.get("tel")) or (e(pid, "dien_thoai_osm") or {}).get("value")
            or (e(pid, "dien_thoai_facility") or {}).get("value"),
        (prov_val(pid, "website_chinh_thuc") or {}).get("value") or rong(r.get("web"))
            or (e(pid, "website_osm") or {}).get("value") or (e(pid, "website_facility") or {}).get("value"),
        (prov_val(pid, "trang_facebook") or {}).get("value"),
        (prov_val(pid, "email") or prov_val(pid, "email_facebook") or {}).get("value"),
        place_id_of(r["name"]), "source_node",
    )
    rec["alternate_names"] = alt
    # description (verbatim wiki)
    dsc = prov_val(pid, "mo_ta_wikipedia", "encyclopedia")
    if dsc:
        rec["description"] = {"value": dsc["value"], "is_verbatim_quote": True,
                              "source_id": dsc["source_id"], "retrieved_at": dsc["retrieved_at"]}
    # opening_hours
    gh = e(pid, "gio_mo_cua")
    oh = None
    if gh:
        parsed, bad = parse_hours(gh["value"])
        if parsed:
            parsed["source_id"] = SRC.id_of(gh.get("source"), gh.get("url"), None, gh.get("date"))
            parsed["retrieved_at"] = rong(gh.get("date"))
            oh = parsed
            if bad:
                rec["data_quality"]["warnings"].append("gio_mo_cua: " + gh["value"][:80])
    # ticketing: giu HET gia tham khao
    tickets = []
    for f in ("gia_ve", "gia_ve_tham_khao", "gia_ve_wikipedia"):
        pv = prov_val(pid, f)
        if pv:
            tickets.append(pv)
    fac = {}
    for key, field in (("restroom", "nha_ve_sinh"), ("parking", "bai_do_xe"),
                       ("wheelchair_access", "loi_xe_lan"), ("wifi", "wifi"),
                       ("info_desk", "quay_thong_tin"), ("souvenir", "qua_luu_niem")):
        ev = e(pid, field)
        fac[key] = ev["value"] if ev else None
    env = {
        "elevation_m": num_m((e(pid, "do_cao") or {}).get("value")),
        "prominence_m": num_m((e(pid, "do_nho") or {}).get("value")),
        "open_view_directions": [x.strip() for x in re.split(r"[,;]", (e(pid, "huong_mo") or {}).get("value") or "") if x.strip()],
        "sunrise_azimuth": (e(pid, "huong_binh_minh") or {}).get("value"),
        "san_may": (e(pid, "san_may") or {}).get("value"),
    }
    road = e(pid, "duong_gan_nhat")
    road_v = road["value"] if road and "KHÔNG CÓ TÊN" not in road["value"] else None
    media = None
    files = ANH_FILES.get(pid) or []
    _seen_src = set()
    files = [im for im in files if im.get("source_url") not in _seen_src
             and not _seen_src.add(im.get("source_url"))]      # bo anh trung (cung file)
    if files:
        gallery = [{"path": im["path"], "license": im.get("license"),
                    "attribution": im.get("attribution"),
                    "source_id": SRC.id_of("Wikimedia Commons", im.get("source_url"), "media", BUILD)}
                   for im in files]
        media = {"cover_image_url": gallery[0]["path"], "license": gallery[0]["license"],
                 "source_id": gallery[0]["source_id"], "gallery": gallery}
    else:
        anh = e(pid, "anh")   # fallback: chua fetch -> giu URL Commons tu discovery
        if anh:
            media = {"cover_image_url": anh["value"], "license": anh.get("note"),
                     "source_id": SRC.id_of(anh.get("source"), anh.get("url"), "media", anh.get("date")),
                     "gallery": []}
    _vibes_v, _vibes_ng = _vibes_for(rec)
    rec["ext"] = {"destination": {
        "trai_nghiem": _tn.nhan_trai_nghiem(rec["category"]["primary"]),  # derived tu category (khong source_id)
        "trai_nghiem_nguon": "category",                                  # tang 2 override -> "fsq"/"overture"
        "vibes": _vibes_v,                                                # slug vibe roi rac (VIBE_VOCAB)
        "vibes_nguon": _vibes_ng,                                         # rule | llm | rule+llm | none
        "opening_hours": oh,
        "ticketing": tickets,
        "facilities": fac,
        "environment": env,
        "transport": {"distance_from_center_km": r.get("km"), "drive_time_min": r.get("min")},
        "nearby_destinations": [{"destination_id": n[0], "distance_km": n[1], "drive_time_minutes": n[2]}
                                for n in NEAR.get(pid, [])],
        "media": media,
        "map": {"google_maps_url": "https://www.google.com/maps/search/?api=1&query={},{}".format(r["lat"], r["lon"]),
                "nearest_main_road": road_v},
        # None = khong tim thay trong register (khong khang dinh "khong duoc cong nhan")
        "nha_nuoc_tham_dinh": True if r.get("csdl_tham_dinh") else None,
    }}
    # warnings + verification meta tu enrichment
    cb = e(pid, "canh_bao_website")
    if cb:
        rec["data_quality"]["warnings"].append(cb["value"])
    dates = [row.get("date") for row in ENR.get(pid, {}).values() if rong(row.get("date"))]
    rec["data_quality"]["last_verified_at"] = max(dates) if dates else BUILD
    methods = sorted(set(row.get("method") for row in ENR.get(pid, {}).values() if rong(row.get("method"))))
    rec["data_quality"]["verification_method"] = methods or None
    _dd = finalize(rec)
    if not _dd.get("source_ids"):                 # hint-only / chua enrich -> seed source tu resolver
        _dd["source_ids"] = [_src_dd(r.get("src"))]
    if r.get("csdl_tham_dinh") and SRC_CSDL_DD not in _dd["source_ids"]:
        _dd["source_ids"].append(SRC_CSDL_DD)     # register nha nuoc = nguon chung thuc
    diem_den.append(_dd)

# ── 2. nha hang ────────────────────────────────────────────────────────────
NH = _doc_opt("nha_hang.json", {"quan": []})["quan"]
cand = [q for q in NH if q.get("lat") is not None and q.get("lon") is not None and not q.get("da_dong_cua")]
# uu tien quan co vlog (tin hieu noi tieng) -> luon lot top; roi den co mon, roi tin_cay
cand.sort(key=lambda q: (1 if fold(q["ten"]) in VLOG else 0, 1 if q.get("mon") else 0, q.get("tin_cay") or 0.0), reverse=True)
SRC_NH = SRC.id_of("Quet nha_hang (Overture/FSQ/OSM)", None, "aggregate", BUILD)
nha_hang = []
for q in cand[:TOP_NHA_HANG]:
    rec = core(
        slug_id("nh", q["ten"], q["lat"], q["lon"], q.get("dia_chi", "")),
        q["ten"], q["lat"], q["lon"], rong(q.get("hang_muc")), [], None,
        rong(q.get("dia_chi")), rong(q.get("dien_thoai")), rong(q.get("website")),
        rong(q.get("facebook")), None, place_id_of(q["ten"]), "source_node",
    )
    rec["data_quality"]["last_verified_at"] = BUILD
    rec["data_quality"]["verification_method"] = ["sweep-nha-hang"]
    rec["ext"] = {"restaurant": {"mon": q.get("mon") or [], "tin_cay": q.get("tin_cay"),
                                 "facebook": rong(q.get("facebook")),
                                 "editorial_group": editorial_group(q.get("hang_muc")),
                                 "tourism_mentions": VLOG.get(fold(q["ten"]))}}
    rec["source_ids"] = [SRC_NH]
    nha_hang.append(rec)

# ── 3. khach san (+ chi-dia-chi) ───────────────────────────────────────────
def phan_khuc(gmin):
    if not gmin:
        return None
    if gmin < 200_000:
        return "binh dan (quy uoc gia, KHONG phai sao)"
    if gmin <= 450_000:
        return "trung binh (quy uoc gia, KHONG phai sao)"
    return "cao cap (quy uoc gia, KHONG phai sao)"

LT = _doc_opt("luu_tru.json", {"co_so": []})["co_so"]
SRC_NN = SRC.id_of("Dang ky luu tru nha nuoc (Lam Dong)", None, "registry", BUILD)
SRC_TD = SRC.id_of("Tu dang ky", None, "self-registered", BUILD)
# city khong co so dang ky (NT/DN) -> tham_dinh=None: KHONG dan nham "Tu dang ky" (claim sai). Nguon that
# la tong hop ben thu ba Overture, chua xac minh.
SRC_OT = SRC.id_of("Overture Maps (tong hop ben thu ba, chua xac minh)", None, "aggregate", BUILD)
def ks_rec(c, co_toa):
    addr = rong(c.get("dia_chi")) or rong(" ".join(x for x in [c.get("so_nha"), c.get("duong")] if x))
    rec = core(
        slug_id("ks", c["ten"], c.get("lat"), c.get("lon"), c.get("dia_chi", "")),
        c["ten"], (c["lat"] if co_toa else None), (c["lon"] if co_toa else None),
        rong(c.get("loai")), [], None, addr, rong(c.get("dien_thoai")), None,
        rong(c.get("facebook")), rong(c.get("email")), place_id_of(c["ten"]), "source_node",
    )
    rec["data_quality"]["last_verified_at"] = BUILD
    rec["data_quality"]["verification_method"] = ["sweep-luu-tru"]
    rec["ext"] = {"hotel": {"gia_min": c.get("gia_min"), "gia_max": c.get("gia_max"),
                            "phan_khuc": phan_khuc(c.get("gia_min")), "tham_dinh": rong(c.get("tham_dinh")),
                            "so_phong": c.get("so_phong")}}
    _td = c.get("tham_dinh")
    rec["source_ids"] = [SRC_NN if _td == "nhà nước" else SRC_TD if _td == "tự đăng ký" else SRC_OT]
    return rec
khach_san = [ks_rec(c, True) for c in LT
             if c.get("lat") is not None and c.get("lon") is not None and not c.get("da_dong_cua")]
khach_san_dc = [ks_rec(c, False) for c in LT
                if (c.get("lat") is None or c.get("lon") is None) and rong(c.get("dia_chi"))
                and not c.get("da_dong_cua")]

# SPEC CONFLICT (QUYET DINH chu san pham 2026-08-05): sap output khach theo THU TU anh huong
# (VQS noi bo), KHONG in so. Doctrine cu sap nha_hang theo (vlog,mon,tin_cay) va khach_san theo
# thu tu nguon; nay reorder theo rank noi-bo. Chi THU TU doi — khong them field diem/hang.
def _sap_log(recs, loai):
    # LOUD: rank rong -> no-op im lang trong khi export "trong giong nhu da xep hang". Bao ra.
    idx = _ah.thu_tu(CITY_DIR, loai)
    if not idx:
        print("⚠ rank file missing/empty cho %s — export GIU thu tu thu thap, KHONG phai anh huong "
              "(chua chay rank_noi_bo_%s.py?)" % (loai, loai))
    return _ah.sap_xep(recs, CITY_DIR, loai)
nha_hang = _sap_log(nha_hang, "nha_hang")
khach_san = _sap_log(khach_san, "khach_san")
khach_san_dc = _sap_log(khach_san_dc, "khach_san")

# ── meta + ghi ─────────────────────────────────────────────────────────────
lats = [d["coordinates"]["latitude"] for d in diem_den]
lons = [d["coordinates"]["longitude"] for d in diem_den]
meta = {
    "dataset_name": "Điểm đến / nhà hàng / khách sạn Đà Lạt (cho planner)",
    "dia_diem": DIA_DIEM, "generated_at": BUILD, "language": "vi",
    "missing_field_policy": "Moi field luon co mat. null = chua xac minh / chua thu thap. "
                            "Mot leaf non-null la mot claim va phai truy ve source_id (xem sources.json).",
    "tam": {"lat": sum(lats) / len(lats), "lon": sum(lons) / len(lons)},
    "bbox": {"min_lat": min(lats), "min_lon": min(lons), "max_lat": max(lats), "max_lon": max(lons)},
    "so_luong": {"diem_den": len(diem_den), "nha_hang": len(nha_hang),
                 "khach_san": len(khach_san), "khach_san_chi_dia_chi": len(khach_san_dc)},
    "osrm_diem_den": MATRIX,
    "ghi_chu": [
        "Thu tu nha_hang/khach_san = MUC DO ANH HUONG noi bo (VQS: sqrt(luot)*chat-luong^3); "
        "KHONG co field rank/diem/sao trong record — chi THU TU. Rating tinh LIVE qua "
        "external_ids.google_place_id. Record chua co rank giu thu tu cu (xuong sau).",
        "Gio mo chi co o diem den; nha hang/khach san khong co -> 'goi truoc'.",
        "phan_khuc khach san la QUY UOC GIA, KHONG phai hang sao.",
        "SDT deu chua goi xac minh cho toi khi co nguoi goi.",
    ],
}

ghi("meta.json", meta)
ghi("regions.json", regions)
ghi("sources.json", SRC.rows)
ghi("diem-den.json", diem_den)
ghi("nha-hang.json", nha_hang)
ghi("khach-san.json", khach_san)
ghi("khach-san-chi-dia-chi.json", khach_san_dc)
print("Da xuat -> {}/  (sources={})".format(OUT_DIR, len(SRC.rows)))
print("  diem-den={}  nha-hang={}  khach-san={}  khach-san-chi-dia-chi={}  regions={}".format(
    len(diem_den), len(nha_hang), len(khach_san), len(khach_san_dc), len(regions)))
