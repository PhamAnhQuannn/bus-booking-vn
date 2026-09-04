# -*- coding: utf-8 -*-
"""Pass 2 — Wikidata + Wikipedia tieng Viet + Wikimedia Commons.

CC0 / CC-BY-SA, khong vuong dieu khoan nao. Lay:
  - anh tu do ban quyen (P18) — ca du an chua co tam anh nao
  - website chinh thuc (P856) — de doi chieu voi truong website da bi nhiem ban
  - nam khanh thanh (P571), kien truc su (P84), di tich (P1435)
  - doan mo dau bai Wikipedia tieng Viet => mo ta CO NGUON, khong phai bia
  - gia ve / gio mo cua neu bai viet co neu, TRICH NGUYEN VAN cau do

QID lay tu Pass 0 truoc, sau do do lai theo toa do tu wikidata.json da tai.
"""
import json, os, sys, io, re, math, time, urllib.request, urllib.parse

RAW = sys.argv[1]
ENRICH = os.path.join(RAW, "enrichment.json")
PULL_DATE = "28/07/2026"
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


import unicodedata
_GENERIC = {"chua", "den", "mieu", "nha", "tho", "khu", "di", "tich", "thap", "ho",
            "nui", "thac", "dao", "bai", "vuon", "cong", "vien", "diem", "du", "lich",
            "quang", "truong", "bao", "tang", "danh", "thang"}   # +tu chi LOAI (quang truong,
            #                                          bao tang, danh thang) — chan collision 2-token type


def _fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().replace("đ", "d").split())


def _core(s):
    return frozenset(t for t in _fold(s).split() if len(t) > 2 and t not in _GENERIC)


_HANH_CHINH = ("xã", "huyện", "phường", "thị trấn", "tỉnh", "thành phố", "quận",
               "đơn vị hành chính", "làng", "thôn", "khu dân cư")


def _la_hanh_chinh(type_label):
    t = (type_label or "").lower()
    return any(w in t for w in _HANH_CHINH)


# Bai ve SU KIEN lich su (chien dich/tran/vu...) — diem den la NOI, khong phai su kien.
# Nha tho/chua dat theo dia danh se trung toponym voi tran danh cung dia danh (Phuoc Long).
_SU_KIEN = ("chiến dịch", "trận ", "vụ ", "cuộc ", "khởi nghĩa", "phong trào",
            "sự kiện", "chiến tranh", "thảm sát", "nổi dậy",
            "trường ", "đại học", "trung học", "học viện")   # su kien HOAC truong hoc != diem den


def _la_su_kien(label):
    return (label or "").strip().lower().startswith(_SU_KIEN)


def _ten_khop(a, b):
    """Danh tu rieng chung MANH -> cung mot noi. Mot token chung (meo/son/ban) la trung
    am, KHONG du (Chua Meo <-> Na Meo cach 47km). Doi: fold bang nhau, HOAC >=2 token
    danh-tu-rieng chung, HOAC tap con nhau voi >=2 token — chan trung-am 1-token."""
    fa, fb = _fold(a), _fold(b)
    if not fa or not fb:
        return False
    if fa == fb:
        return True
    ca, cb = _core(a), _core(b)
    if not ca or not cb:
        return False
    inter = ca & cb
    if len(inter) >= 2:
        return True
    if (ca <= cb or cb <= ca) and min(len(ca), len(cb)) >= 2:
        return True
    return False


# typeLabel Wikidata co the la ha-tang giao thong (cau/duong/ham) trong khi diem KB la bai bien/nui/
# ho... — trung TOPONYM (vd "Nha Trang") nhung KHAC LOAI hoan toan (Nha Trang tung khop nham voi bai
# Wikidata ve MOT CAY CAU ten trung dia danh). _ten_khop chi xet ten, khong xet loai — them guard
# rieng bang typeLabel de loai truong hop nay du ten khop.
_HA_TANG_TYPE = ("cầu", "bridge", "đường", "road", "hầm", "tunnel", "cống")
_BAI_BIEN_TU = ("bãi biển", "beach", "bờ biển")


def _khac_loai(type_label, ten_diem):
    """True neu typeLabel la ha-tang (cau/duong/ham) nhung diem KB la bai bien — khac lop doi tuong,
    tu choi ngay ca khi _ten_khop() khop toponym."""
    t = (type_label or "").lower()
    n = (ten_diem or "").lower()
    return any(w in t for w in _HA_TANG_TYPE) and any(w in n for w in _BAI_BIEN_TU)


picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
name_of = {c["id"]: c["name"] for c in picked}
rows = json.load(io.open(ENRICH, encoding="utf-8"))
# SELF-HEAL: xoa row do CHINH script nay sinh o lan truoc (mo_ta/QID pass2/gia-ve wiki...),
# roi dung lai qua guard hien tai. Neu khong, `emit` seen-guarded se giu mo_ta cu SAI (tu
# lan chay 400m-no-guard) — misattribution song sot. Giu row OSM-goc (source khong phai wiki).
rows = [r for r in rows if not (str(r.get("source", "")).startswith(("Wikidata", "Wikipedia"))
                                or str(r.get("method", "")).startswith("pass2"))]
before = len(rows)
seen = {(r["id"], r["field"]) for r in rows}

# QID tu Pass 0
qid_of = {r["id"]: r["value"] for r in rows if r["field"] == "wikidata_qid"}
wp_of = {r["id"]: r["value"] for r in rows if r["field"] == "wikipedia"}

# bo sung QID bang cach do toa do voi ban thu Wikidata da co
wd = json.load(io.open(os.path.join(RAW, "wikidata.json"), encoding="utf-8"))
wd_pts = []
for b in wd.get("results", {}).get("bindings", []):
    c = b.get("coord", {}).get("value", "")
    if not c.startswith("Point("):
        continue
    try:
        lon, lat = [float(x) for x in c[6:-1].split()]
    except Exception:
        continue
    wd_pts.append((lat, lon, b["item"]["value"].rsplit("/", 1)[-1],
                   b.get("viLabel", {}).get("value") or b.get("itemLabel", {}).get("value", ""),
                   b.get("image", {}).get("value", ""),
                   b.get("typeLabel", {}).get("value", "")))
for p in picked:
    if p["id"] in qid_of:
        continue
    best, bd = None, 9e9
    for lat, lon, q, lab, img, typ in wd_pts:
        # bo don vi HANH CHINH (xa/huyen/phuong...) — bai Wikipedia ta VUNG, khong ta diem;
        # gan cho mot lang nghe se mo ta ca xa, la misattribution.
        if _la_hanh_chinh(typ) or _la_su_kien(lab):   # don vi HC hoac su kien lich su -> bo
            continue
        d = hav((p["lat"], p["lon"]), (lat, lon))
        # identity 2 truc: ten khop MANH VA cung tinh (<6km — feature lon nhu VQG/ho
        # cach centroid vai km; ten manh + cung tinh = cung noi). Ten manh chan trung-am.
        # + guard loai: typeLabel ha-tang (cau/duong) khong duoc gan cho diem bai bien (_khac_loai).
        if d < bd and d < 6000 and not _khac_loai(typ, p["name"]) and _ten_khop(p["name"], lab):
            bd, best = d, (q, lab, img)
    if best:
        qid_of[p["id"]] = best[0]
        rows.append({"id": p["id"], "field": "wikidata_qid", "value": best[0],
                     "source": "Wikidata", "url": f"https://www.wikidata.org/wiki/{best[0]}",
                     "date": PULL_DATE, "method": "pass2-coord-match",
                     "note": f"khớp toạ độ {bd:.0f} m — {best[1]}", "match_m": round(bd)})
        seen.add((p["id"], "wikidata_qid"))
print(f"QID: {len(qid_of)}/{len(picked)} diem")


def emit(pid, field, value, source, url, note=""):
    if not value or (pid, field) in seen:
        return
    seen.add((pid, field))
    rows.append({"id": pid, "field": field, "value": str(value).strip(), "source": source,
                 "url": url, "date": PULL_DATE, "method": "pass2-wiki", "note": note,
                 "match_m": None})


PROPS = {"P18": "anh", "P856": "website_chinh_thuc", "P571": "nam_khanh_thanh",
         "P84": "kien_truc_su", "P1435": "xep_hang_di_tich", "P2048": "chieu_cao",
         "P2046": "dien_tich", "P625": None}
n_wd = 0
for pid, qid in sorted(qid_of.items()):
    try:
        d = get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")
    except Exception as e:
        print(f"  {pid} {qid}: {type(e).__name__}")
        continue
    ent = d.get("entities", {}).get(qid, {})
    claims = ent.get("claims", {})
    wurl = f"https://www.wikidata.org/wiki/{qid}"
    for prop, field in PROPS.items():
        if not field or prop not in claims:
            continue
        try:
            dv = claims[prop][0]["mainsnak"]["datavalue"]["value"]
        except Exception:
            continue
        if prop == "P18":
            fn = urllib.parse.quote(str(dv).replace(" ", "_"))
            emit(pid, "anh", f"https://commons.wikimedia.org/wiki/Special:FilePath/{fn}",
                 "Wikimedia Commons", wurl, "ảnh tự do bản quyền")
        elif prop == "P571":
            emit(pid, field, str(dv.get("time", ""))[1:11] if isinstance(dv, dict) else dv,
                 "Wikidata", wurl)
        elif isinstance(dv, dict):
            emit(pid, field, dv.get("amount") or dv.get("id") or "", "Wikidata", wurl)
        else:
            emit(pid, field, dv, "Wikidata", wurl)
    # Ten bai Wikipedia TIENG VIET — GAN DE, khong setdefault.
    # The `wikipedia` cua OSM co dang <ngonngu>:<tieu de> va nguoi dong gop dat
    # bang bat ky thu tieng nao (ko:, en:, de:). Truoc day hat giong tu OSM duoc
    # nap TRUOC roi setdefault nen the tieng Han/Duc luon thang lien ket viwiki,
    # va tai lieu tieng Viet co ba doan mo ta bang tieng Han.
    site = ent.get("sitelinks", {}).get("viwiki", {}).get("title")
    if site:
        wp_of[pid] = "vi:" + site
    n_wd += 1
    time.sleep(0.3)
print(f"doc xong {n_wd} thuc the Wikidata")

# ---- Wikipedia tieng Viet: doan mo dau + cau co gia ve / gio mo cua ----
PRICE_RE = re.compile(r"[^.]*\b(giá vé|vé vào cổng|phí tham quan|giờ mở cửa|mở cửa từ)\b[^.]*\.",
                      re.IGNORECASE)
n_wp = 0
for pid, raw in sorted(wp_of.items()):
    lang, _, title = raw.partition(":")
    if not title:
        lang, title = "vi", raw
    # CHI tieng Viet. Khong co ban tieng Viet thi KHONG lay ban tieng khac —
    # mot muc khong co mo ta van tot hon mot muc nguoi doc khong doc duoc.
    if lang != "vi":
        print(f"  bo qua {pid}: chi co ban '{lang}', khong co ban tieng Viet")
        continue
    api = (f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=extracts"
           f"&explaintext=1&format=json&redirects=1&titles={urllib.parse.quote(title)}")
    try:
        d = get(api)
    except Exception as e:
        print(f"  {pid} {title}: {type(e).__name__}")
        continue
    pages = d.get("query", {}).get("pages", {})
    text = rtitle = ""
    for _, pg in pages.items():
        text = pg.get("extract") or ""
        rtitle = pg.get("title") or title       # tieu de SAU redirect (khac title yeu cau)
    if not text:
        continue
    # GUARD ten: tieu de bai (SAU redirect) phai khop ten diem — chan mis-tag OSM (sub-feature
    # gan wikidata diem CHA) VA redirect lech (vd "Phước Lộc" -> bai "Chiến dịch Đường 14").
    if _la_su_kien(rtitle) or not _ten_khop(name_of.get(pid, ""), rtitle):
        print(f"  bo qua {pid}: bai '{rtitle}' (su kien / khong khop ten '{name_of.get(pid,'')[:24]}')")
        continue
    n_wp += 1
    url = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title)}"
    # Lay LEAD section: toi da 3 doan, dung o header "==", cap 1500 ky tu cat an-toan-cau.
    # (Truoc day split("\n")[0] bo doan 2+ — bai lon nhu Ho Hoan Kiem/Vinh Ha Long bi cat con 1.)
    _paras = []
    for _p in text.split("\n"):
        _p = _p.strip()
        if not _p:
            continue
        if _p.startswith("=="):
            break
        _paras.append(_p)
        if len(_paras) >= 3:
            break
    intro = "\n\n".join(_paras)
    if len(intro) > 1500:
        _cut = intro[:1500]
        _dot = _cut.rfind(". ")
        intro = _cut[:_dot + 1] if _dot > 800 else _cut
    if len(intro) > 40:
        emit(pid, "mo_ta_wikipedia", intro, f"Wikipedia {lang}", url,
             "đoạn mở đầu (tối đa 3 đoạn), trích nguyên văn")
    for m in PRICE_RE.finditer(text):
        s = " ".join(m.group(0).split())
        if len(s) < 260:
            fld = "gia_ve_wikipedia" if re.search(r"giá vé|vé vào|phí tham quan", s, re.I) \
                else "gio_mo_cua_wikipedia"
            emit(pid, fld, s, f"Wikipedia {lang}", url,
                 "TRÍCH NGUYÊN VĂN — Wikipedia không ghi ngày, phải gọi xác nhận")
            break
    time.sleep(0.3)
print(f"doc xong {n_wp} bai Wikipedia")

# ghi atomic (.tmp + os.replace): crash giua batch 34 tinh khong lam truncate enrichment.json
_tmp = ENRICH + ".tmp"
json.dump(rows, io.open(_tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(_tmp, ENRICH)
from collections import Counter
print(f"\nenrichment.json: {before} -> {len(rows)}  (+{len(rows)-before})")
for k, v in Counter(r["field"] for r in rows if r["method"].startswith("pass2")).most_common():
    print(f"  +{v:3d}  {k}")
