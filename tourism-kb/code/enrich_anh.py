# -*- coding: utf-8 -*-
"""Pass 12 — DISCOVERY anh gallery (<=4/diem) tu Wikimedia Commons.

Chi TIM + license-check URL, KHONG tai file (viec do la fetch_anh.py).
Nguon xep theo identity manh -> yeu:
  1. Wikidata P373 -> Commons category -> categorymembers  (file duoc phan loai duoi diem)
  2. Commons category-search theo ten (ns 14) -> members     (category ten khop token)
  3. File name-search (ns 6), token khop du
  4. geosearch <=150m (geo identity)
Giu file .jpg/.png... license TU DO (CC-BY*/CC0/PD). Bo .pdf/.svg.

Emit rows anh/anh2/anh3/anh4 — cover cu (neu co) GIU NGUYEN (dedup), chi them slot trong.
Moi row: value=<Commons FilePath URL>, url=<Commons file page>, note=<license>,
them key "attribution"=<Artist> de fetch_anh mang sang manifest.
Append-only, dedup (id,field), ghi atomic os.replace.
"""
import json, os, sys, io, re, time, unicodedata, urllib.request, urllib.parse

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
PULL_DATE = "04/08/2026"
CAP = 4
MAX_PROBE = 24                      # so ung vien toi da license-check moi diem
GEO_R = 150
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}
IMG = (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".gif")
GENERIC = {"da", "lat", "tp", "thanh", "pho", "khu", "du", "lich", "kdl", "moi",
           "viet", "nam", "xa", "phuong", "the", "va", "tai", "cua", "tren", "diem"}
FREE_RE = re.compile(r"(cc[ -]?by|cc0|public domain|pdm|no restrictions)", re.I)
FIELDS = ["anh", "anh2", "anh3", "anh4"]


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return json.load(r)


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def toks(name):
    return [t for t in re.findall(r"[a-z0-9]+", fold(name)) if len(t) > 2 and t not in GENERIC]


def ttoks(title):
    """Token-set cua ten file/category (bo tien to File:/Category: + duoi anh)."""
    t = title.split(":", 1)[1] if ":" in title else title
    t = re.sub(r"\.[a-z0-9]+$", "", t, flags=re.I)
    return {x for x in re.findall(r"[a-z0-9]+", fold(t)) if len(x) > 2 and x not in GENERIC}


# Chuan hoa tu-chi-loai SONG NGU -> mot nhan chung, de khop VN<->EN (Bao Tang<->Museum,
# Chua<->Pagoda) NHUNG van phan biet loai khac nhau (Thac Cam Ly != Nha tho Cam Ly).
# Nhan chi la nhan — mien VN & EN cua CUNG khai niem cung nhan la du.
TYPE_EQUIV = {
    "thac": "WFALL", "waterfall": "WFALL", "falls": "WFALL",
    "lake": "LAKE",
    "chua": "PAGODA", "pagoda": "PAGODA",
    "thien": "MONAS", "vien": "MONAS", "monastery": "MONAS",
    "nha": "CHURCH", "tho": "CHURCH", "church": "CHURCH", "cathedral": "CHURCH",
    "cathederal": "CHURCH", "giao": "CHURCH",
    "dinh": "PALACE", "palace": "PALACE",
    "bao": "MUSEUM", "tang": "MUSEUM", "museum": "MUSEUM",
    "vuon": "GARDEN", "hoa": "GARDEN", "garden": "GARDEN", "park": "GARDEN", "cong": "GARDEN",
    "quang": "SQUARE", "truong": "SQUARE", "square": "SQUARE",
    "market": "MARKET",
    "lang": "VILLAGE", "village": "VILLAGE",
    "thung": "VALLEY", "lung": "VALLEY", "valley": "VALLEY",
    "nui": "MOUNTAIN", "mountain": "MOUNTAIN",
}
TYPE_CANON = set(TYPE_EQUIV.values())


def norm(tokset):
    return {TYPE_EQUIV.get(t, t) for t in tokset}


def id_subset(D, title):
    """Ten diem (chuan hoa) nam TRON trong ten title (chuan hoa)."""
    nd = norm(D)
    return bool(nd) and nd <= norm(ttoks(title))


def id_geo(D, title):
    """geo: chia se >=1 ten RIENG, VA khong mau thuan tu-loai (Thac != Nha tho)."""
    nd, nt = norm(D), norm(ttoks(title))
    if not (nd & nt) - TYPE_CANON:               # phai chung it nhat 1 ten rieng
        return False
    dt, tt = nd & TYPE_CANON, nt & TYPE_CANON     # tu-loai moi ben
    if dt and tt and not (dt & tt):               # ca hai co loai, KHAC loai -> loai
        return False
    return True


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def imageinfo(title):
    """(url, license, attribution) hoac (None, None, None)."""
    try:
        d = get("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo"
                "&iiprop=url|extmetadata&format=json&titles=" + urllib.parse.quote(title))
        pg = list(d["query"]["pages"].values())[0]
        ii = pg.get("imageinfo")
        if not ii:
            return None, None, None
        em = ii[0].get("extmetadata", {})
        lic = (em.get("LicenseShortName", {}) or {}).get("value")
        art = strip_html((em.get("Artist", {}) or {}).get("value", ""))[:120]
        return ii[0]["url"], lic, art
    except Exception:
        return None, None, None


def cat_files(cat):
    try:
        r = get("https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers"
                "&cmtitle=" + urllib.parse.quote(cat) + "&cmtype=file&cmlimit=50&format=json")
        return [m["title"] for m in r["query"]["categorymembers"] if m["title"].lower().endswith(IMG)]
    except Exception:
        return []


def candidates(p, qid):
    """List (title, rank, dist) da dedup, xep rank asc.

    IDENTITY theo TOKEN (khong substring — bai hoc tim_cum: 'lan' KHONG khop 'lances',
    'tau' KHONG khop 'vung tau'):
      rank0 P373: category cua chinh thuc the -> tin, giu het file.
      rank1 category-search: chi dung category co token-set CHUA DU dtok (va con ten rieng).
      rank2 file name-search: file title chua DU dtok.
      rank3 geosearch: file title chia se >=1 token dac trung (geo + ten).
    """
    D = set(toks(p["name"]))
    seen, out = set(), []

    def add(title, rank, dist=9e9):
        if title.lower().endswith(IMG) and title not in seen:
            seen.add(title)
            out.append((title, rank, dist))

    # 1. Wikidata P373 (category chinh thuc — tin)
    if qid:
        try:
            ent = get("https://www.wikidata.org/wiki/Special:EntityData/%s.json" % qid)["entities"][qid]
            c = ent.get("claims", {}).get("P373")
            if c:
                for f in cat_files("Category:" + c[0]["mainsnak"]["datavalue"]["value"]):
                    add(f, 0)
        except Exception:
            pass
    # 2. Commons category-search theo ten — category phai chua DU dtok (token, khong substring)
    try:
        sr = get("https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=14"
                 "&srlimit=6&format=json&srsearch=" + urllib.parse.quote(p["name"]))["query"]["search"]
        for h in sr:
            if id_subset(D, h["title"]):             # ten diem (chuan hoa) nam tron trong category
                for f in cat_files(h["title"]):
                    add(f, 1)
    except Exception:
        pass
    # 3. File name-search — file title chua DU ten diem (chuan hoa)
    try:
        fs = get("https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6"
                 "&srlimit=15&format=json&srsearch=" + urllib.parse.quote(p["name"] + " Da Lat"))["query"]["search"]
        for h in fs:
            if id_subset(D, h["title"]):
                add(h["title"], 2)
    except Exception:
        pass
    # 4. geosearch <=150m — chia se >=1 ten rieng (geo + ten)
    try:
        gs = get("https://commons.wikimedia.org/w/api.php?action=query&list=geosearch"
                 "&gscoord=%s|%s&gsradius=%d&gsnamespace=6&gslimit=40&format=json"
                 % (p["lat"], p["lon"], GEO_R))["query"].get("geosearch", [])
        for g in gs:
            if id_geo(D, g["title"]):
                add(g["title"], 3, g["dist"])
    except Exception:
        pass
    out.sort(key=lambda x: (x[1], x[2]))
    return out


picked = {p["id"]: p for p in json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]}
rows = json.load(io.open(ENRICH, encoding="utf-8"))
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}
# cover cu + file da dung / diem
cur = {}
for r in rows:
    if r["field"] in FIELDS:
        cur.setdefault(r["id"], {})[r["field"]] = r["value"]
qid_of = {r["id"]: r["value"] for r in rows if r["field"] == "wikidata_qid"}


def emit(pid, field, value, url, license_, attribution, dist):
    rows.append({"id": pid, "field": field, "value": value, "source": "Wikimedia Commons",
                 "url": url, "date": PULL_DATE, "method": "pass12-commons",
                 "note": license_, "attribution": attribution,
                 "match_m": round(dist) if dist and dist < 9e9 else None})
    seen.add((pid, field))


added = 0
for pid in picked:
    p = picked[pid]
    existing = cur.get(pid, {})
    used_files = {urllib.parse.unquote(v.rsplit("/", 1)[-1]) for v in existing.values()}   # file cover cu (khong lay lai)
    free_slots = [f for f in FIELDS if f not in existing]
    if not free_slots:
        continue
    kept = []
    probed = 0
    for title, rank, dist in candidates(p, qid_of.get(pid)):
        if len(kept) >= len(free_slots):
            break
        fn = title.split(":", 1)[1] if ":" in title else title
        if fn.replace(" ", "_") in used_files:
            continue
        if probed >= MAX_PROBE:
            break
        probed += 1
        url, lic, art = imageinfo(title)
        time.sleep(0.05)
        if url and lic and FREE_RE.search(lic):
            fp = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn.replace(" ", "_"))
            page = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
            kept.append((fp, page, lic.strip(), art, dist))
            used_files.add(fn.replace(" ", "_"))
    for slot, (fp, page, lic, art, dist) in zip(free_slots, kept):
        emit(pid, slot, fp, page, lic, art, dist)
        added += 1
    have_now = len(existing) + len(kept)
    print("  %s %-26s +%d anh  (tong %d)" % (pid, p["name"][:26], len(kept), have_now))
    time.sleep(0.1)

tmp = ENRICH + ".tmp"
json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, ENRICH)
gal = sum(1 for r in rows if r["field"] in FIELDS)
diem = len({r["id"] for r in rows if r["field"] in FIELDS})
print("\nenrichment.json: %d -> %d (+%d)   tong anh rows: %d tren %d/36 diem"
      % (before, len(rows), added, gal, diem))
