# -*- coding: utf-8 -*-
"""Wrapper rebuild KB tourism theo DUNG thu tu, ghi log + diff, assert coverage.

Thu tu: [sweep_overture_vn (chi khi rebuild TOAN BO)] -> export_planner (moi tinh) ->
enrich_trai_nghiem -> build_diem_den_docx (moi tinh). Toan bo stdout/err ghi vao
tourism-kb/raw/_shared/rebuild-<ts>.log (gitignored). Cuoi: kiem moi diem-den co trai_nghiem.

Chay TU GOC REPO:
    python tourism-kb/code/rebuild_tourism.py            # toan bo 37 tinh (co refresh Overture)
    python tourism-kb/code/rebuild_tourism.py da-lat     # 1 tinh (dung cache Overture hien co)

Exit != 0 neu bat ky buoc nao fail (vd Word dang mo file docx -> PermissionError).
"""
import os, io, sys, glob, subprocess
from datetime import datetime

CODE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CODE)
import duong_dan_ra as _dr

PY = sys.executable
SLUG = sys.argv[1] if len(sys.argv) > 1 else None
TS = datetime.now().strftime("%Y%m%d-%H%M%S")
LOG = _dr.kiem_loi_ra("tourism-kb/raw/_shared/rebuild-%s.log" % TS)
os.makedirs(os.path.dirname(LOG), exist_ok=True)
LOGF = io.open(LOG, "w", encoding="utf-8")

ENV = dict(os.environ, PYTHONIOENCODING="utf-8")
failures = []


def log(msg):
    print(msg, flush=True)
    LOGF.write(msg + "\n"); LOGF.flush()


def run(args, label):
    log("\n===== %s :: %s =====" % (datetime.now().strftime("%H:%M:%S"), label))
    p = subprocess.run([PY] + args, cwd=os.getcwd(), env=ENV,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (p.stdout or "") + (p.stderr or "")
    LOGF.write(out); LOGF.flush()
    tail = "\n".join(out.strip().splitlines()[-6:])
    print(tail, flush=True)
    if p.returncode != 0:
        why = "Word dang MO file docx?" if "PermissionError" in out else "exit %d" % p.returncode
        failures.append("%s (%s)" % (label, why))
        log("!! FAIL: %s (%s)" % (label, why))
    return p.returncode


provinces = [SLUG] if SLUG else sorted(os.path.basename(os.path.dirname(p))
                                       for p in glob.glob("tourism-kb/export/*/"))

log("rebuild tourism | slug=%s | %d tinh | log=%s" % (SLUG or "ALL", len(provinces), LOG))

# 1) refresh Overture cache (chi khi rebuild toan bo — 1 tinh dung cache san)
if not SLUG:
    run(["tourism-kb/code/sweep_overture_vn.py"], "sweep_overture_vn (refresh cache)")

# 2) export tang 1
for slug in provinces:
    run(["tourism-kb/code/export_planner.py", "tourism-kb/raw/%s/scrape" % slug], "export_planner %s" % slug)

# 3) enrich tang 2 (xu ly toan bo; idempotent)
run(["tourism-kb/code/enrich_trai_nghiem.py"], "enrich_trai_nghiem (refine + diff)")

# 4) docx
for slug in provinces:
    run(["tourism-kb/code/build_diem_den_docx.py", "tourism-kb/raw/%s/scrape" % slug], "build_diem_den_docx %s" % slug)

# 5) assert coverage (moi diem-den co trai_nghiem)
import json
tot = miss = 0
for slug in provinces:
    f = "tourism-kb/export/%s/diem-den.json" % slug
    try:
        for r in json.load(io.open(f, encoding="utf-8")):
            tot += 1
            if not r.get("ext", {}).get("destination", {}).get("trai_nghiem"):
                miss += 1
    except FileNotFoundError:
        failures.append("thieu export %s" % slug)
log("\ncoverage: %d/%d co trai_nghiem (missing=%d)" % (tot - miss, tot, miss))
if miss:
    failures.append("coverage thieu %d record" % miss)

log("\n==== KET QUA: %s ====" % ("OK" if not failures else "FAIL (%d)" % len(failures)))
for x in failures:
    log("  - " + x)
LOGF.close()
sys.exit(1 if failures else 0)
