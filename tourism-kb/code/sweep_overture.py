# -*- coding: utf-8 -*-
"""Overture Maps Places (CDLA-Permissive 2.0) -> Da Lat bbox, via DuckDB predicate pushdown.

Public bucket, anonymous access confirmed (HTTP 200). Places theme contains NO OpenStreetMap
data, so it carries none of ODbL's share-alike obligations.
"""
import sys, os, io, json, time
import duckdb

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dia_diem_config import cfg, slug_of

OUT = sys.argv[1]
REL = sys.argv[2] if len(sys.argv) > 2 else "2026-07-22.0"
XMIN, YMIN, XMAX, YMAX = cfg(OUT)["bbox"]
print(f"dia diem: {slug_of(OUT)}  bbox: {XMIN},{YMIN},{XMAX},{YMAX}")
SRC = f"s3://overturemaps-us-west-2/release/{REL}/theme=places/type=place/*.parquet"

t0 = time.time()
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute("SET s3_region='us-west-2';")
con.execute("SET s3_use_ssl=true;")
con.execute("SET enable_progress_bar=false;")
# anonymous access to a public bucket
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
"""
print(f"source: {SRC}")
print("querying Overture Places (bbox pushdown) ...", flush=True)
rows = con.execute(q).fetchall()
cols = [d[0] for d in con.description]
print(f"elapsed {time.time()-t0:.0f}s   rows {len(rows)}")

recs = []
for r in rows:
    d = dict(zip(cols, r))
    for k, v in list(d.items()):
        if isinstance(v, (list, tuple)):
            d[k] = [str(x) for x in v]
    recs.append(d)
json.dump(recs, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("saved ->", OUT)

from collections import Counter
c = Counter(r.get("category") or "(none)" for r in recs)
print("\n--- top 30 categories ---")
for k, v in c.most_common(30):
    print(f"   {v:5d}  {k}")

named = [r for r in recs if r.get("name")]
withweb = [r for r in recs if r.get("websites")]
withtel = [r for r in recs if r.get("phones")]
print(f"\nnamed: {len(named)}/{len(recs)}   website: {len(withweb)}   phone: {len(withtel)}")

INTEREST = ("attraction", "landmark", "monument", "museum", "temple", "church", "buddhist",
            "park", "waterfall", "lake", "market", "scenic", "tourist", "historic", "garden")
poi = [r for r in recs if r.get("category") and any(k in str(r["category"]).lower() for k in INTEREST)]
print(f"\n--- tourism-relevant rows: {len(poi)} ---")
for r in sorted(poi, key=lambda x: str(x.get("category")))[:45]:
    print(f"   {str(r.get('category'))[:34]:36s} {str(r.get('name'))[:46]}")
