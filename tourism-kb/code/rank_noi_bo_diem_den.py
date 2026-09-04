# -*- coding: utf-8 -*-
"""⚠ NỘI BỘ — file sinh ra CẤM đưa vào sản phẩm/website/khách. ⚠

Lấy rating + số lượt Google (LIVE) cho ĐIỂM ĐẾN rồi ghi file NỘI BỘ `pop_diem_den.json`
để `diem_quan_trong.py` cộng popularity vào điểm quan trọng. Cùng NGOẠI LỆ có chủ đích như
`rank_noi_bo_nha_hang.py` (2026-08-05): file gitignored, KHÔNG ship; sản phẩm khách vẫn
"Chưa xác minh" + rating tính LIVE qua external_ids.google_place_id.

KHÁC rank nhà hàng: KHÔNG tính VQS ở đây — chỉ lưu (R, n) thô; điểm popularity do
`diem_quan_trong` tính bằng Wilson (xep_hang.wilson95) lúc xếp. Giữ file này thuần THU THẬP.

RÀNG BUỘC: chỉ ghi raw/<slug>/noi-bo/ (đã gitignored, G8 chặn commit). Đọc place_id từ
export/<slug>/diem-den.json (chỉ có place_id, không có rating). place_id null -> bỏ (không gọi).

Chạy:  PYTHONIOENCODING=utf-8 python tourism-kb/code/rank_noi_bo_diem_den.py <slug> [<slug> ...]
"""
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "..", "export")
RAW = os.path.join(HERE, "..", "raw")
API = "https://places.googleapis.com/v1/places/"
MASK = "rating,userRatingCount"


def doc_khoa():
    k = os.environ.get("GOOGLE_MAPS_API_KEY")
    if k and k.strip():
        return k.strip()
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("GOOGLE_MAPS_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v
    return None


def goi(place_id, khoa):
    req = urllib.request.Request(API + place_id,
                                 headers={"X-Goog-Api-Key": khoa, "X-Goog-FieldMask": MASK})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    return d.get("rating"), d.get("userRatingCount")


def place_ids(slug):
    """(place_id, ten) cua diem den co place_id, dedup."""
    p = os.path.join(EXPORT, slug, "diem-den.json")
    if not os.path.exists(p):
        return []
    seen, out = set(), []
    for r in json.load(io.open(p, encoding="utf-8")):
        pid = ((r.get("identity") or {}).get("place_id")
               or (r.get("external_ids") or {}).get("google_place_id"))
        if pid and pid not in seen:
            seen.add(pid)
            out.append((pid, r.get("name") or ""))
    return out


def chay(slug, khoa):
    ids = place_ids(slug)
    if not ids:
        print("  [%s] khong co place_id -> bo" % slug)
        return
    print("%s — %d place_id, goi Place Details (%s)" % (slug, len(ids), MASK))
    pop, hong = {}, 0
    for i, (pid, ten) in enumerate(ids, 1):
        try:
            R, n = goi(pid, khoa)
        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                print("  DUNG dong %d: HTTP %d — het han muc. KHONG ghi file do." % (i, e.code))
                sys.exit(1)
            R, n = None, None
        except Exception:
            R, n = None, None
        if R is None:
            hong += 1
        else:
            pop[pid] = {"R": R, "n": n}
        if i % 25 == 0:
            print("  ...%d/%d" % (i, len(ids)), flush=True)
        time.sleep(0.08)

    out = {
        "_CANH_BAO": "NOI BO — CAM dua vao san pham/website/khach. Google content, khong phat hanh. "
                     "Rating+luot lay live, cu theo thoi gian — dung de xep importance noi bo.",
        "lay_luc": time.strftime("%d/%m/%Y %H:%M"), "dia_diem": slug,
        "pop": pop, "khong_lay_duoc": hong,
    }
    out_dir = os.path.join(RAW, slug, "noi-bo")
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, "pop_diem_den.json")
    tmp = dest + ".tmp"
    json.dump(out, io.open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, dest)
    print("  -> %d/%d co danh gia (%d hong)  ghi %s" % (len(pop), len(ids), hong, dest))


def main():
    slugs = sys.argv[1:]
    if not slugs:
        print("cach dung: python rank_noi_bo_diem_den.py <slug> [<slug> ...]")
        sys.exit(1)
    khoa = doc_khoa()
    if not khoa:
        print("thieu GOOGLE_MAPS_API_KEY")
        sys.exit(1)
    for s in slugs:
        chay(s, khoa)


if __name__ == "__main__":
    main()
