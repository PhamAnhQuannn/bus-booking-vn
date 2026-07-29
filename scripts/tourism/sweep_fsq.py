# -*- coding: utf-8 -*-
"""Foursquare OS Places (Apache 2.0) -> Da Lat bbox.

NOTE: the documented S3 path s3://fsq-os-places-us-east-1/release/dt=*/ is DEAD for
anonymous access (bucket root returns KeyCount=2, only LICENSE/NOTICE). The live route
is the HuggingFace mirror. Carries date_closed -- the only closure signal in the stack.
"""
import sys, io, json, os, time
import duckdb

OUT = sys.argv[1]
REL = sys.argv[2] if len(sys.argv) > 2 else "2026-07-09"
BBOX = (108.30, 11.75, 108.65, 12.10)  # xmin, ymin, xmax, ymax
SRC = f"hf://datasets/foursquare/fsq-os-places/release/dt={REL}/places/parquet/*.parquet"

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENVFILES = [os.path.join(REPO, ".env.local"), os.path.join(REPO, ".env.tourism.local")]


def resolve_token():
    """env var first, then the gitignored env files. Value is never printed.

    Tolerant of 'HF_TOKEN=x', 'HF_TOKEN = x' and surrounding quotes.
    """
    t = os.environ.get("HF_TOKEN", "").strip()
    if t:
        return t, "bien moi truong HF_TOKEN"
    for path in ENVFILES:
        if not os.path.exists(path):
            continue
        for line in io.open(path, encoding="utf-8", errors="replace"):
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            if key.strip() != "HF_TOKEN":
                continue
            val = val.strip().strip('"').strip("'")
            if val:
                return val, os.path.basename(path)
    return None, None


TOKEN, WHERE = resolve_token()
if not TOKEN:
    print("KHONG TIM THAY TOKEN.\n")
    print("Foursquare OS Places bi gated - phai co token HuggingFace.\n")
    print("  1. Dang nhap, bam dong y dieu khoan tai:")
    print("     https://huggingface.co/datasets/foursquare/fsq-os-places")
    print("  2. Tao token quyen READ tai:")
    print("     https://huggingface.co/settings/tokens")
    print(f"  3. Dan vao dong HF_TOKEN= trong: {ENVFILE}")
    print("     (hoac dat bien moi truong HF_TOKEN)")
    sys.exit(2)
print(f"token: da tim thay tu {WHERE} (khong in ra gia tri)")

t0 = time.time()
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute("SET enable_progress_bar=false;")

# hf:// throws "HTTP 0" in duckdb on this machine regardless of auth, so use
# explicit HTTPS resolve URLs with a bearer secret. Globs do not work over plain
# HTTPS, so enumerate the part files from the HF dataset API.
con.execute("CREATE SECRET hf_http (TYPE http, BEARER_TOKEN ?);", [TOKEN])

import urllib.request
api = "https://huggingface.co/api/datasets/foursquare/fsq-os-places"
with urllib.request.urlopen(urllib.request.Request(
        api, headers={"Authorization": f"Bearer {TOKEN}"}), timeout=90) as r:
    meta = json.load(r)
prefix = f"release/dt={REL}/places/parquet/"
parts = sorted(s["rfilename"] for s in meta.get("siblings", [])
               if s["rfilename"].startswith(prefix) and s["rfilename"].endswith(".parquet"))
if not parts:
    print(f"Khong tim thay file parquet nao cho release dt={REL}")
    sys.exit(3)
BASE = "https://huggingface.co/datasets/foursquare/fsq-os-places/resolve/main/"
URLS = [BASE + p for p in parts]
print(f"so file parquet: {len(URLS)}")
SRC = "', '".join(URLS)
SRC = f"['{SRC}']"

q = f"""
SELECT name, latitude, longitude, address, locality, region, country,
       fsq_category_labels, date_created, date_refreshed, date_closed,
       tel, website, fsq_place_id
FROM read_parquet({SRC})
WHERE country = 'VN'
  AND longitude BETWEEN {BBOX[0]} AND {BBOX[2]}
  AND latitude  BETWEEN {BBOX[1]} AND {BBOX[3]}
"""
print(f"source: {SRC}", flush=True)
print("querying Foursquare OS Places ...", flush=True)
rows = con.execute(q).fetchall()
cols = [d[0] for d in con.description]
print(f"elapsed {time.time()-t0:.0f}s   rows {len(rows)}")

recs = []
for r in rows:
    d = dict(zip(cols, r))
    for k, v in list(d.items()):
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, (list, tuple)):
            d[k] = [str(x) for x in v]
    recs.append(d)
json.dump(recs, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("saved ->", OUT)

closed = [r for r in recs if r.get("date_closed")]
print(f"\n*** date_closed present on {len(closed)} of {len(recs)} rows ***")
for r in closed[:20]:
    print(f"   CLOSED {r['date_closed']}  {r.get('name')}")

from collections import Counter
c = Counter()
for r in recs:
    for l in (r.get("fsq_category_labels") or []):
        c[str(l).split(">")[-1].strip()] += 1
print("\n--- top 25 categories ---")
for k, v in c.most_common(25):
    print(f"   {v:4d}  {k}")
