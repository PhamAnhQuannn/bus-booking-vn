# -*- coding: utf-8 -*-
"""Enrich diem den PROVINCE-AGNOSTIC — mo ta (Wikipedia) + anh (Wikimedia P18) + gio + do cao.

Thay chuoi enrich cu (enrich_mo_ta/enrich_anh HARDCODE Da Lat: DIA_PHUONG gate, TEN_BAI,
search "+ Da Lat"). Nguon identity = OSM tag da co trong guide_data.picked[].tags:
  - wikipedia (vi:Title) / wikidata (Qxxx) -> link CHINH XAC (Tier A, tin, khong gate).
  - khong co tag -> FUZZY search vi.wikipedia theo ten, GATE locality bang cfg province/city
    (extract phai nhac tinh/thanh) + loai trang dinh huong (Tier B).
  - opening_hours / ele tag -> gio_mo_cua / do_cao truc tiep.

Ghi enrichment.json (field: mo_ta_wikipedia, anh, gio_mo_cua, do_cao) — export_planner doc san.
DOCTRINE: trich NGUYEN VAN (CC BY-SA collection, dan url); khong co bai -> null (khong bia).
Phan biet LOI-goi (429...) vs KHONG-co-bai: loi -> bo qua (khong ket luan), khong ghi "thieu".

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_diem_den.py tourism-kb/raw/<slug>/scrape
FREE (Wikipedia/Wikidata/Commons API, no key). --force ghi de field cu.
"""
import io, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of

RAW = sys.argv[1]
FORCE = "--force" in sys.argv[2:]
C = cfg(RAW)
SLUG = slug_of(RAW)
DATE = time.strftime("%d/%m/%Y")
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}
VI_API = "https://vi.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
MAX_CHU = 420
NGUONG_NGAN = 150
MANAGED = {"mo_ta_wikipedia", "anh", "gio_mo_cua", "do_cao"}     # --force ghi de sach cac field nay
FREE_RE = re.compile(r"(cc[ -]?by|cc0|public domain|pdm|no restrictions)", re.I)
DINH_HUONG = ("có thể chỉ đến", "có thể là:", "có thể chỉ:", "thường được dùng để chỉ",
              "trỏ đến", "có thể đề cập")
# Bai DON VI HANH CHINH (khong phai diem tham quan) — trung ten voi diem (Bai Chay phuong vs
# bai bien, Van Don dac khu vs dao). Loai: chu ngu la xa/phuong/huyen/tinh/dac khu...
ADMIN_RE = re.compile(r"\blà\s+(một\s+)?(xã|phường|thị trấn|thị xã|huyện|quận|"
                      r"thành phố|tỉnh|đặc khu|đơn vị hành chính)\b", re.I)


def is_admin(txt):
    return bool(ADMIN_RE.search((txt or "")[:70]))


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# Locality gate cho Tier B: extract nhac tinh HOAC thanh (fold, bo dau) -> tranh trung ten khac tinh.
LOC = [fold(C["province"]), fold(C["city"])]

# NAME-token gate (ap CA Tier A+B): bai phai chia se TEN RIENG voi diem — chan bai VUNG
# (Vinh Ha Long) gan cho sub-POI (Hang Bo Nau), va bai KHAC noi cung loai. Bo tu-chi-loai.
GEN = {"hang", "dong", "chua", "den", "mieu", "dinh", "phu", "nha", "tho", "bai", "bien",
       "nui", "deo", "dao", "hon", "thac", "ho", "dap", "vinh", "cong", "vien", "khu", "di",
       "tich", "thap", "bao", "tang", "thanh", "dia", "vuon", "quoc", "gia", "ton", "suoi",
       "cua", "va", "the", "tai", "diem", "danh", "thang", "lang", "cho", "ga", "cau",
       "pagoda", "temple", "mountain", "lake", "beach", "island", "cave", "park", "bridge",
       "market", "museum", "church", "waterfall", "national", "the", "of", "and", "mount"}


def ntoks(s):
    return {t for t in fold(s).split() if len(t) > 1 and t not in GEN}


def name_ok(pname, title):
    """Ten RIENG cua diem chia se du voi ten bai. Chan bai vung/khac-noi gan sai."""
    pt, tt = ntoks(pname), ntoks(title)
    if not pt:
        return True                                   # ten toan tu chung (hiem) -> khong chan
    sh = pt & tt
    return bool(sh) and (pt <= tt or len(sh) >= (len(pt) + 1) // 2)


def _get(url, lan=4):
    """Backoff 429/loi tam thoi. Loi ben tra ve None (KHONG ket luan 'khong co')."""
    for i in range(lan):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception:
            if i == lan - 1:
                return None
            time.sleep(2 * (i + 1))
    return None


def _cut(txt):
    """Cat theo CAU, MAX_CHU. Khong cat giua cau."""
    txt = (txt or "").replace("\n", " ").strip()
    if not txt:
        return None
    ra = ""
    for c in re.split(r"(?<=[.!?])\s+", txt):
        if ra and len(ra) + len(c) + 1 > MAX_CHU:
            break
        ra = (ra + " " + c).strip()
    return ra or None


def wiki_page(title, intro=True):
    """(extract_cat, real_title, qid, is_disambig) tu vi.wikipedia. (None,..) neu missing/loi."""
    ps = {"action": "query", "prop": "extracts|pageprops", "explaintext": 1, "redirects": 1,
          "format": "json", "titles": title, "ppprop": "wikibase_item|disambiguation"}
    if intro:
        ps["exintro"] = 1
    d = _get(VI_API + "?" + urllib.parse.urlencode(ps))
    if d is None:
        return None, None, None, False
    for pid, p in d.get("query", {}).get("pages", {}).items():
        if pid == "-1" or "missing" in p:
            return None, None, None, False
        pp = p.get("pageprops", {})
        qid = pp.get("wikibase_item")
        disamb = "disambiguation" in pp
        txt = (p.get("extract") or "").strip()
        return _cut(txt), p.get("title"), qid, disamb
    return None, None, None, False


def wiki_desc(title):
    """Extract verbatim; mo dau ngan -> lay ca bai. Tra (text, real_title, qid, disamb)."""
    txt, rt, qid, dis = wiki_page(title, intro=True)
    if txt and len(txt) < NGUONG_NGAN and not dis:
        full, rt2, qid2, dis2 = wiki_page(title, intro=False)
        if full and len(full) > len(txt):
            return full, rt2 or rt, qid2 or qid, dis2
    return txt, rt, qid, dis


def vi_sitelink(qid):
    """Wikidata QID -> ten bai vi.wikipedia (neu co)."""
    d = _get("https://www.wikidata.org/wiki/Special:EntityData/%s.json" % qid)
    if not d:
        return None
    ent = d.get("entities", {}).get(qid, {})
    return ent.get("sitelinks", {}).get("viwiki", {}).get("title")


def wd_p18(qid):
    """Wikidata P18 -> (filepath_url, file_page_url, license, attribution, label). Else None."""
    d = _get("https://www.wikidata.org/wiki/Special:EntityData/%s.json" % qid)
    if not d:
        return None
    ent = d.get("entities", {}).get(qid, {})
    labs = ent.get("labels", {})
    label = (labs.get("vi", {}) or labs.get("en", {}) or {}).get("value", "")
    cl = ent.get("claims", {}).get("P18")
    if not cl:
        return None
    fn = cl[0]["mainsnak"]["datavalue"]["value"]
    fnq = urllib.parse.quote(fn.replace(" ", "_"))
    ii = _get(COMMONS_API + "?action=query&prop=imageinfo&iiprop=url|extmetadata&format=json"
              "&titles=" + urllib.parse.quote("File:" + fn))
    lic, art = None, None
    if ii:
        for _, pg in ii.get("query", {}).get("pages", {}).items():
            info = pg.get("imageinfo")
            if info:
                em = info[0].get("extmetadata", {})
                lic = (em.get("LicenseShortName", {}) or {}).get("value")
                art = re.sub(r"<[^>]+>", "", (em.get("Artist", {}) or {}).get("value", "")).strip()[:120]
    if lic and not FREE_RE.search(lic):
        return None                                    # khong tu do -> bo (an toan license)
    return ("https://commons.wikimedia.org/wiki/Special:FilePath/" + fnq,
            "https://commons.wikimedia.org/wiki/File:" + fnq, lic, art, label)


def search_titles(name):
    d = _get(VI_API + "?action=query&list=search&srlimit=5&format=json&srsearch="
             + urllib.parse.quote(name))
    if not d:
        return []
    return [h["title"] for h in d.get("query", {}).get("search", [])]


def resolve(p):
    """Tra (desc_row_or_None, qid_or_None, tier). Tier A=tag exact, B=fuzzy, ''=khong."""
    tags = p.get("tags") or {}
    qid = tags.get("wikidata")
    wp = tags.get("wikipedia") or ""
    vi_title = wp.split(":", 1)[1] if wp.startswith("vi:") else None

    # Tier A: co vi title tag. OSM chi identity, NHUNG van gate name (OSM hay tag sub-POI
    # = bai VUNG: hang trong vinh gan wikipedia=Vinh Ha Long -> mo ta sai). Fail -> giu qid cho anh.
    if vi_title:
        txt, rt, q2, dis = wiki_desc(vi_title)
        if txt and not dis and not is_admin(txt) and name_ok(p["name"], rt or vi_title):
            return (txt, rt or vi_title), (qid or q2), "A"
        return None, (qid or None), "A"
    # Tier A': co QID tag -> lay vi sitelink (gate name + hanh chinh)
    if qid:
        vt = vi_sitelink(qid)
        if vt:
            txt, rt, _, dis = wiki_desc(vt)
            if txt and not dis and not is_admin(txt) and name_ok(p["name"], rt or vt):
                return (txt, rt or vt), qid, "A"
        return None, qid, "A"
    # Tier B: fuzzy search — GATE name (ten rieng) + hanh chinh + locality + dinh huong
    for t in search_titles(p["name"]):
        txt, rt, q2, dis = wiki_desc(t)
        if not txt or dis or is_admin(txt):            # bai don vi hanh chinh -> khong phai diem
            continue
        if not name_ok(p["name"], rt or t):            # bai khong chung ten rieng -> khac noi/bai vung
            continue
        if any(k in txt for k in DINH_HUONG):
            continue
        if not any(loc in fold(txt) for loc in LOC):   # bai khong nhac tinh/thanh -> trung ten khac tinh
            continue
        return (txt, rt or t), q2, "B"
    return None, None, ""


def main():
    G = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))
    picked = G["picked"]
    p_enr = os.path.join(RAW, "enrichment.json")
    enr = json.load(io.open(p_enr, encoding="utf-8")) if os.path.exists(p_enr) else []
    if FORCE:                                          # xoa sach field managed -> regen tu dau (bo row cu sai)
        enr = [e for e in enr if e["field"] not in MANAGED]
    have = {(e["id"], e["field"]) for e in enr}
    rows = list(enr)

    def add(pid, field, value, source, url, method, note=None):
        if not FORCE and (pid, field) in have:
            return False
        rows[:] = [r for r in rows if not (r["id"] == pid and r["field"] == field)]
        rows.append({"id": pid, "field": field, "value": value, "source": source,
                     "url": url, "date": DATE, "method": method, "note": note})
        have.add((pid, field))
        return True

    n_desc = n_img = n_hours = n_ele = 0
    tiers = {"A": 0, "B": 0, "": 0}
    for i, p in enumerate(picked, 1):
        pid = p["id"]
        tags = p.get("tags") or {}
        # gio + do cao tu OSM tag (truc tiep, khong goi API)
        if tags.get("opening_hours"):
            n_hours += add(pid, "gio_mo_cua", tags["opening_hours"], "OpenStreetMap",
                           "https://www.openstreetmap.org/%s/%s" % (p.get("kind", "node"), ""),
                           "osm-tag opening_hours")
        if tags.get("ele"):
            n_ele += add(pid, "do_cao", str(tags["ele"]) + " m", "OpenStreetMap", None, "osm-tag ele")
        # mo ta + anh
        desc, qid, tier = resolve(p)
        tiers[tier] = tiers.get(tier, 0) + 1
        if desc:
            txt, rt = desc
            n_desc += add(pid, "mo_ta_wikipedia", txt, "Wikipedia tiếng Việt",
                          "https://vi.wikipedia.org/wiki/" + urllib.parse.quote((rt).replace(" ", "_")),
                          "wikipedia api · trích nguyên văn · tier " + tier,
                          "trích nguyên văn, CC BY-SA 4.0")
        if qid:
            img = wd_p18(qid)
            if img:
                fp, page, lic, art, label = img
                # gate anh theo identity: co mo ta (da xac dinh) HOAC ten Wikidata khop ten diem
                if desc or name_ok(p["name"], label):
                    n_img += add(pid, "anh", fp, "Wikimedia Commons", page,
                                 "wikidata P18 · tier " + tier, lic or "")
        if i % 20 == 0:
            print("  ...%d/%d" % (i, len(picked)))
        time.sleep(0.25)

    tmp = p_enr + ".tmp"
    json.dump(rows, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, p_enr)
    print("[%s] %d điểm · mô tả +%d · ảnh +%d · giờ +%d · độ cao +%d  (tier A=%d B=%d none=%d)"
          % (SLUG, len(picked), n_desc, n_img, n_hours, n_ele, tiers["A"], tiers["B"], tiers[""]))


if __name__ == "__main__":
    main()
