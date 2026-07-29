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


picked = json.load(io.open(os.path.join(RAW, "guide_data.json"), encoding="utf-8"))["picked"]
rows = json.load(io.open(ENRICH, encoding="utf-8"))
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
                   b.get("image", {}).get("value", "")))
for p in picked:
    if p["id"] in qid_of:
        continue
    best, bd = None, 9e9
    for lat, lon, q, lab, img in wd_pts:
        d = hav((p["lat"], p["lon"]), (lat, lon))
        if d < bd and d < 400:
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
    text = ""
    for _, pg in pages.items():
        text = pg.get("extract") or ""
    if not text:
        continue
    n_wp += 1
    url = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title)}"
    intro = text.split("\n")[0].strip()
    if len(intro) > 40:
        emit(pid, "mo_ta_wikipedia", intro[:700], f"Wikipedia {lang}", url,
             "đoạn mở đầu, trích nguyên văn")
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

json.dump(rows, io.open(ENRICH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(f"\nenrichment.json: {before} -> {len(rows)}  (+{len(rows)-before})")
for k, v in Counter(r["field"] for r in rows if r["method"].startswith("pass2")).most_common():
    print(f"  +{v:3d}  {k}")
