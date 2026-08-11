# -*- coding: utf-8 -*-
"""Tai anh gallery ve dia -> export/<slug>/anh/<DL-xx>/<n>.<ext>, xuat manifest.

Doc enrichment anh/anh2/anh3/anh4 (URL Commons FilePath do enrich_anh.py tim).
Moi anh tai qua ?width=1600 (cap kich thuoc — Commons full-res co the >50MB).
Ghi QUA duong_dan_ra.kiem_loi_ra (guard PII: chi cho ghi trong export/...).
Idempotent: bo qua file da co. Xuat raw/anh_files.json cho export_planner.

Chay TU GOC REPO:  python tourism-kb/code/fetch_anh.py tourism-kb/raw
"""
import json, os, sys, io, time, urllib.request, urllib.parse, urllib.error
import duong_dan_ra as _dr
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import slug_of

RAW = sys.argv[1]
SLUG = slug_of(RAW)                      # da-lat cho raw/ phang; nha-trang cho raw/nha-trang
OUT_DIR = os.path.join("tourism-kb", "export", SLUG)
UA = {"User-Agent": "BusBooking-KB/0.1 (tourism research; phamanhquan4068@gmail.com)"}
FIELDS = ["anh", "anh2", "anh3", "anh4"]
CT_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
          "image/gif": ".gif", "image/tiff": ".jpg", "image/svg+xml": ".png"}


def download(url, tries=5):
    """Retry + backoff — Commons rate-limit (429) khi tai nhieu ?width= lien tiep."""
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                ct = (r.headers.get("Content-Type") or "").split(";")[0].strip()
                return r.read(), ct
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** i)          # 1,2,4,8,16s
                continue
            raise
    raise last


def save(relpath, data):
    p = _dr.kiem_loi_ra(relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, p)
    return p


rows = json.load(io.open(os.path.join(RAW, "enrichment.json"), encoding="utf-8"))
by_pid = {}
for r in rows:
    if r["field"] in FIELDS:
        by_pid.setdefault(r["id"], {})[r["field"]] = r

manifest = {}
n_files = n_skip = n_err = 0
for pid in sorted(by_pid):
    entries = []
    n = 0
    for field in FIELDS:
        r = by_pid[pid].get(field)
        if not r:
            continue
        n += 1
        fp = r["value"]            # https://commons.wikimedia.org/wiki/Special:FilePath/<file>
        fn = urllib.parse.unquote(fp.rsplit("/", 1)[-1])
        base_ext = os.path.splitext(fn)[1].lower() or ".jpg"
        # doan ext tam de kiem ton tai (idempotent) — chinh lai sau khi biet content-type
        rel_noext = "anh/%s/%d" % (pid, n)
        already = None
        for ext in (base_ext, ".jpg", ".png", ".webp"):
            cand = os.path.join(OUT_DIR, rel_noext + ext)
            if os.path.exists(_dr.kiem_loi_ra(cand)):
                already = rel_noext + ext
                break
        if already:
            n_skip += 1
            path = already
        else:
            try:
                data, ct = download(fp + "?width=1600")
                ext = CT_EXT.get(ct, base_ext if base_ext in (".jpg", ".png", ".webp", ".gif") else ".jpg")
                path = rel_noext + ext
                save(os.path.join(OUT_DIR, path), data)
                n_files += 1
                print("  %s/%d <- %s (%s, %dKB)" % (pid, n, fn[:44], ct, len(data) // 1024))
                time.sleep(0.5)
            except Exception as e:
                n_err += 1
                print("  %s/%d ERR %s: %s" % (pid, n, fn[:40], type(e).__name__))
                continue
        entries.append({"path": path, "license": r.get("note"),
                        "source_url": r.get("url"), "attribution": r.get("attribution")})
    if entries:
        manifest[pid] = entries

mpath = os.path.join(RAW, "anh_files.json")
tmp = mpath + ".tmp"
json.dump(manifest, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
os.replace(tmp, mpath)
print("\ntai moi: %d | bo qua (da co): %d | loi: %d" % (n_files, n_skip, n_err))
print("manifest: %s  (%d diem, %d anh)" % (mpath, len(manifest), sum(len(v) for v in manifest.values())))
