# -*- coding: utf-8 -*-
"""Stage (apply) — curation IN-PLACE trên export/<slug>/diem-den.json cho #696 + #700.
KHÔNG full re-export (build_diem_den re-gán id + revert tên Google pass16 — xem lesson
reexport-reverts-pass16-names). Patch export JSON trực tiếp, atomic (os.replace), idempotent,
khớp record theo `id` (ỔN ĐỊNH — xoá làm lệch index nên KHÔNG khớp theo vị trí).

Ba sửa (mọi thay đổi là additive/idempotent, re-run = no-op):
 1. #696 COORD_FIXES: vá toạ độ lệch. vung-tau HCM-S221 "núi lớn" stored 10.41,107.259 (~20.7km ENE,
    ngoài biển) → 10.370,107.080 (khối Núi Lớn, lõi thành phố). CHỈ record này; HCM-S219 "hồ tràm" xa
    ~41km là THẬT, KHÔNG đụng.
 2. #700 COMPLEX_IDS: gắn ext.destination.complex_id cho các record CÙNG quần thể tên-khác-nhau
    (da-nang Bà Nà/Sun World: Cáp Treo/Cầu Vàng/Chùa Linh Ứng-Bà Nà/sun world) → note-layer plan.ts
    (#713) nuốt drop-note khi một sibling đã xếp. Additive (vắng = no-op tới khi có).
 3. #700 DEDUP: vinh-long VL-36 == VL-37 (cùng place_id, ~65m). Port field độc nhất của VL-36 (website
    + source_id) sang VL-37 rồi XOÁ VL-36. Giữ VL-37 (nhiều nguồn hơn, state-verified).

Chạy TỪ tourism-kb/:  python code/apply_data_fixes.py
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")

# (slug, id) -> (lat, lon)
COORD_FIXES = {
    ("vung-tau", "HCM-S221"): (10.370, 107.080),
}
# slug -> { id: complex_id }
COMPLEX_IDS = {
    "da-nang": {"DN-16": "bana", "DN-17": "bana", "DN-S29": "bana", "DN-S31": "bana"},
}
# slug -> (keep_id, drop_id) : port field độc nhất của drop sang keep rồi xoá drop
DEDUP = {
    "vinh-long": ("VL-37", "VL-36"),
}


def _load(slug):
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return None, None
    return p, json.load(io.open(p, encoding="utf-8"))


def _save(p, recs):
    tmp = p + ".tmp"
    json.dump(recs, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def _by_id(recs, rid):
    for r in recs:
        if r.get("id") == rid:
            return r
    return None


def fix_coords():
    for (slug, rid), (lat, lon) in COORD_FIXES.items():
        p, recs = _load(slug)
        if recs is None:
            print("  ⚠ [%s] không có export" % slug); continue
        r = _by_id(recs, rid)
        if r is None:
            print("  ⚠ [%s] id %s không khớp record" % (slug, rid)); continue
        c = r.get("coordinates") or {}
        if c.get("latitude") == lat and c.get("longitude") == lon:
            print("  [%s] %s toạ độ đã đúng (no-op)" % (slug, rid)); continue
        old = (c.get("latitude"), c.get("longitude"))
        c["latitude"] = lat; c["longitude"] = lon
        r["coordinates"] = c
        _save(p, recs)
        print("  [%s] %s toạ độ %s -> (%s, %s)" % (slug, rid, old, lat, lon))


def add_complex():
    for slug, mapping in COMPLEX_IDS.items():
        p, recs = _load(slug)
        if recs is None:
            print("  ⚠ [%s] không có export" % slug); continue
        hits = []
        for rid, cid in mapping.items():
            r = _by_id(recs, rid)
            if r is None:
                print("  ⚠ [%s] id %s không khớp record" % (slug, rid)); continue
            ext = r.get("ext")
            if not isinstance(ext, dict):
                ext = r["ext"] = {}
            dest = ext.get("destination")
            if not isinstance(dest, dict):
                dest = ext["destination"] = {}
            if dest.get("complex_id") != cid:
                dest["complex_id"] = cid
                hits.append(rid)
        if hits:
            _save(p, recs)
        print("  [%s] complex_id +%d (%s)" % (slug, len(hits), ", ".join(hits) or "no-op"))


def dedup():
    for slug, (keep_id, drop_id) in DEDUP.items():
        p, recs = _load(slug)
        if recs is None:
            print("  ⚠ [%s] không có export" % slug); continue
        keep = _by_id(recs, keep_id)
        drop = _by_id(recs, drop_id)
        if drop is None:
            print("  [%s] %s đã xoá (no-op)" % (slug, drop_id)); continue
        if keep is None:
            print("  ⚠ [%s] keep id %s không khớp — BỎ QUA xoá" % (slug, keep_id)); continue
        # port field độc nhất: website (nếu keep thiếu) + source_ids hợp nhất
        kc = keep.get("contact") or {}
        dc = drop.get("contact") or {}
        if not kc.get("website") and dc.get("website"):
            kc["website"] = dc["website"]; keep["contact"] = kc
        ks = keep.get("source_ids") or []
        for s in (drop.get("source_ids") or []):
            if s not in ks:
                ks.append(s)
        keep["source_ids"] = ks
        recs = [r for r in recs if r.get("id") != drop_id]
        _save(p, recs)
        print("  [%s] xoá %s (dup của %s), port website+source_ids" % (slug, drop_id, keep_id))


def main():
    print("#696 toạ độ:"); fix_coords()
    print("#700 complex_id:"); add_complex()
    print("#700 dedup:"); dedup()


if __name__ == "__main__":
    main()
