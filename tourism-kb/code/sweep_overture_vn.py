# -*- coding: utf-8 -*-
"""Overture Maps Places (CDLA-Permissive 2.0) -> TOAN VN (1 query), cache chung cho refine trai_nghiem.

Mot lan quet S3 (anonymous, no key, FREE) bbox toan VN thay vi 37 lan/tinh. Ghi cache
tourism-kb/raw/_shared/overture_vn.json (gitignored duoi raw/). CHI enrich_trai_nghiem.py doc file nay
— khong dung vao pipeline resolve_diem_den (tranh doi ket qua resolve cac tinh khac).

Schema cot = giong sweep_overture.py (drop-in). Chay TU GOC REPO:
    python tourism-kb/code/sweep_overture_vn.py
"""
import os, io, json, time, sys, re, urllib.request
import duckdb

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duong_dan_ra as _dr
from refine_trai_nghiem import ATTR_CATS

REL_PINNED = "2026-07-22.0"   # fallback neu list S3 loi


def resolve_latest_release():
    """List release/ tren S3 (delimiter, anonymous) -> version lon nhat (YYYY-MM-DD.N sort dung ngay).
    Fallback REL_PINNED neu loi. Lich chay dinh ky can cai nay, khong thi fetch data y het."""
    url = "https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            xml = r.read().decode("utf-8", "replace")
        rels = re.findall(r"<Prefix>release/([^<]+?)/</Prefix>", xml)
        if rels:
            latest = sorted(rels)[-1]
            print("resolve release: latest =", latest, "(trong %d release)" % len(rels))
            return latest
    except Exception as e:
        print("resolve release LOI (%s) -> fallback %s" % (type(e).__name__, REL_PINNED))
    return REL_PINNED


REL = sys.argv[1] if len(sys.argv) > 1 else resolve_latest_release()
# bbox toan VN (bao 37 tinh; tinh tu dia_diem_config trong plan)
XMIN, YMIN, XMAX, YMAX = 102.144, 8.179, 110.532, 23.393
SRC = f"s3://overturemaps-us-west-2/release/{REL}/theme=places/type=place/*.parquet"
OUT = _dr.kiem_loi_ra("tourism-kb/raw/_shared/overture_vn.json")
_cats = ", ".join("'%s'" % c.replace("'", "''") for c in sorted(ATTR_CATS))

t0 = time.time()
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute("SET s3_region='us-west-2';")
con.execute("SET s3_use_ssl=true;")
con.execute("SET enable_progress_bar=false;")
try:
    con.execute("CREATE SECRET ovt (TYPE s3, PROVIDER config, REGION 'us-west-2');")
except Exception:
    pass

q = f"""
SELECT names.primary                AS name,
       categories.primary           AS category,
       bbox.xmin                    AS lon,
       bbox.ymin                    AS lat,
       confidence,
       websites, phones, socials,
       addresses[1].freeform        AS address,
       sources[1].dataset           AS src_dataset
FROM read_parquet('{SRC}', filename=false, hive_partitioning=0)
WHERE bbox.xmin BETWEEN {XMIN} AND {XMAX}
  AND bbox.ymin BETWEEN {YMIN} AND {YMAX}
  AND names.primary IS NOT NULL
  AND categories.primary IN ({_cats})
"""
print(f"VN bbox {XMIN},{YMIN},{XMAX},{YMAX}\nsource: {SRC}\nquerying Overture Places (VN, bbox pushdown) ...", flush=True)
rows = con.execute(q).fetchall()
cols = [d[0] for d in con.description]
recs = []
for r in rows:
    d = dict(zip(cols, r))
    for k, v in list(d.items()):
        if isinstance(v, (list, tuple)):
            d[k] = [str(x) for x in v]
    recs.append(d)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
tmp = OUT + ".tmp"
json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, default=str)
os.replace(tmp, OUT)
print(f"elapsed {time.time()-t0:.0f}s   rows {len(recs)}   {os.path.getsize(OUT)/1e6:.1f} MB -> {OUT}")
