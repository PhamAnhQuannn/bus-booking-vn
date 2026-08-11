# -*- coding: utf-8 -*-
"""Tang 2 pass — refine nhan trai_nghiem cua loai MO HO bang Overture. Chay SAU export_planner.

Doc cache chung raw/_shared/overture_vn.json (sweep_overture_vn.py), voi moi tinh loc POI theo bbox,
refine chi record category.primary thuoc AMBIG (refine_trai_nghiem.refine_label). Chi sua 2 field
trai_nghiem + trai_nghiem_nguon; khong dong field khac. Idempotent (chay lai an toan). Ghi atomic.

IN DIFF BAT BUOC: moi dong nhan DOI liet ke de soi tay truoc khi tin (lesson distribution/measure).

Chay TU GOC REPO (sau khi export_planner da chay):
    python tourism-kb/code/enrich_trai_nghiem.py
"""
import os, io, sys, json, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duong_dan_ra as _dr
from dia_diem_config import cfg
import refine_trai_nghiem as R
import trai_nghiem as T1

OVT = "tourism-kb/raw/_shared/overture_vn.json"
if not os.path.exists(OVT):
    print("THIEU cache Overture:", OVT, "- chay sweep_overture_vn.py truoc"); sys.exit(1)

print("nap Overture VN ...", flush=True)
ALL_OV = json.load(io.open(OVT, encoding="utf-8"))
# chuan hoa: lat/lon float, category lower; bo dong thieu toa do/ten
OV = []
for r in ALL_OV:
    try:
        lat = float(r["lat"]); lon = float(r["lon"])
    except (TypeError, ValueError, KeyError):
        continue
    if not r.get("name"):
        continue
    OV.append({"name": r["name"], "category": (r.get("category") or "").lower(),
               "lat": lat, "lon": lon, "confidence": r.get("confidence")})
print("Overture attraction POIs:", len(OV))


def in_box(p, b, pad=0.02):
    xmin, ymin, xmax, ymax = b
    return (ymin - pad) <= p["lat"] <= (ymax + pad) and (xmin - pad) <= p["lon"] <= (xmax + pad)


tot_ambig = tot_changed = 0
changes = []   # (slug, id, name, ov_cat, old, new)
for f in sorted(glob.glob("tourism-kb/export/*/diem-den.json")):
    slug = os.path.basename(os.path.dirname(f))
    raw = "tourism-kb/raw/%s/scrape" % slug
    try:
        box = cfg(raw)["bbox"]
    except Exception as e:
        print("  bbox-miss", slug, str(e)[:40]); continue
    pts = [p for p in OV if in_box(p, box)]
    recs = json.load(io.open(f, encoding="utf-8"))
    dirty = False
    for rec in recs:
        prim = rec.get("category", {}).get("primary")
        if prim not in R.AMBIG:
            continue
        tot_ambig += 1
        dn = rec.setdefault("ext", {}).setdefault("destination", {})
        base = T1.nhan_trai_nghiem(prim)                 # base tang 1 (idempotent: khong phu thuoc lan chay truoc)
        lab, nguon, ov_cat = R.refine_label(rec, pts)
        final = lab or base
        cur = dn.get("trai_nghiem")
        if lab and lab != base:                           # THUC SU refine (khac base tang 1)
            changes.append((slug, rec["id"], rec["name"], ov_cat, base, lab))
            tot_changed += 1
        if final != cur or dn.get("trai_nghiem_nguon") != nguon:
            dn["trai_nghiem"] = final
            dn["trai_nghiem_nguon"] = nguon
            dirty = True
    if dirty:
        p = _dr.kiem_loi_ra(f)
        tmp = p + ".tmp"
        json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, p)

from datetime import datetime
lines = ["=== DIFF (nhan DOI boi Overture) — %s ===" % datetime.now().strftime("%Y-%m-%d %H:%M")]
for slug, id_, name, ov_cat, old, new in changes:
    lines.append("  [%s] %-6s %-32s  %-28s | %r -> %r" % (slug, id_, name[:32], ov_cat, old, new))
lines.append("\nambig xet: %d   nhan doi: %d   (%d tinh)" %
             (tot_ambig, tot_changed, len({c[0] for c in changes})))
report = "\n".join(lines)
print("\n" + report)

# ghi diff ra file timestamp (duoi raw/ = gitignored) de hau kiem
diff_path = _dr.kiem_loi_ra("tourism-kb/raw/_shared/enrich-diff-%s.txt" % datetime.now().strftime("%Y%m%d-%H%M"))
os.makedirs(os.path.dirname(diff_path), exist_ok=True)
io.open(diff_path, "w", encoding="utf-8").write(report + "\n")
print("diff -> " + diff_path)
