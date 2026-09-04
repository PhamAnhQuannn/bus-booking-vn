# -*- coding: utf-8 -*-
"""No-fabrication audit (doctrine: giá trị chạm doc = claim, phải truy nguồn). Khác audit_data_quality
(đo ĐỘ PHỦ), file này đo PROVENANCE:
  - record seed (source_ids==["seed-area"] hoặc verification_method bắt đầu "area-seed-") PHẢI có
    external_ids.google_place_id HOẶC wikidata_qid. Không → FAIL (bịa toạ độ/điểm).
  - record có opening_hours / ticketing|gia_ve_tham_khao PHẢI có verification_method non-empty
    (truy được stage lấy fact). Fact rỗng-nguồn → FAIL.

Chạy TỪ tourism-kb/:  python code/audit_no_fabrication.py [slug ...]   (mặc định 10 tp hot)
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")
HOT10 = ["ha-noi", "hue", "ninh-binh", "phu-quoc", "da-lat",
         "da-nang", "ha-long", "vung-tau", "nha-trang", "sa-pa"]


def audit(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        print("  [%s] MISSING" % slug); return 0
    d = json.load(io.open(p, encoding="utf-8"))
    unsourced_seed, unattributed_fact = [], []
    for r in d:
        ext = (r.get("ext") or {}).get("destination") or {}
        vm = (r.get("data_quality") or {}).get("verification_method") or []
        is_seed = (r.get("source_ids") == ["seed-area"]) or any(str(x).startswith("area-seed-") for x in vm)
        eid = r.get("external_ids") or {}
        if is_seed and not (eid.get("google_place_id") or eid.get("wikidata_qid")):
            unsourced_seed.append(r.get("name"))
        has_fact = bool(ext.get("opening_hours") or ext.get("ticketing")
                        or ext.get("gia_ve_tham_khao") or ext.get("gia_ve"))
        if has_fact and not vm:
            unattributed_fact.append(r.get("name"))
    bad = len(unsourced_seed) + len(unattributed_fact)
    print("  [%-11s] seed-unsourced=%d · fact-unattributed=%d %s"
          % (slug, len(unsourced_seed), len(unattributed_fact),
             "OK" if not bad else "FAIL"))
    for n in unsourced_seed:
        print("       seed KHÔNG nguồn: %s" % n)
    for n in unattributed_fact[:8]:
        print("       fact KHÔNG verification_method: %s" % n)
    return bad


def main():
    slugs = sys.argv[1:] or HOT10
    total = sum(audit(s) for s in slugs)
    print("\n%d slug · %d vi phạm no-fabrication" % (len(slugs), total))
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
