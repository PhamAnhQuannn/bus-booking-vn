# -*- coding: utf-8 -*-
"""Sắp output khách theo THỨ TỰ ẢNH HƯỞNG (VQS nội bộ) — KHÔNG in số.

QUYẾT ĐỊNH chủ sản phẩm (2026-08-05): bản khách (export/docx) sắp theo thứ tự VQS lấy từ
raw/<slug>/noi-bo/rank_noi_bo_<loai>.json. CHỈ THỨ TỰ chảy vào bản khách — điểm/★/lượt/hạng
KHÔNG BAO GIỜ in. Rank file vẫn gitignored (không ship); helper này chỉ đọc để lấy THỨ TỰ.

Đây là NGOẠI LỆ có chủ đích với doctrine cũ ("lưu chữ A và lưu THỨ TỰ rủi ro ngang",
xep_hang_song.py). Đánh đổi (user chấp nhận): thứ tự = hạng đóng băng sẽ cũ dần; order phái
sinh Google bake vào bản giao. Rating LIVE vẫn không in — chỉ thứ tự đổi.

Join rank→record: `place_id` khi có, else `fold(ten)`. Thiếu rank file -> no-op (giữ nguyên).
"""
import json, os, io
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_chung import fold

_BIG = 10 ** 9


def thu_tu(city_dir, loai):
    """{place_id->rank, fold(ten)->rank} từ noi-bo/rank_noi_bo_<loai>.json. Thiếu -> {}."""
    p = os.path.join(city_dir, "noi-bo", "rank_noi_bo_%s.json" % loai)
    if not os.path.exists(p):
        return {}
    d = json.load(io.open(p, encoding="utf-8"))
    idx = {}
    for r in d.get("xep_hang", []):
        rank = r.get("rank")
        if rank is None:
            continue
        if r.get("place_id"):
            idx.setdefault("pid:" + r["place_id"], rank)
        if r.get("ten"):
            idx.setdefault("ten:" + fold(r["ten"]), rank)
    return idx


def _khoa_rank(rec, idx):
    """Rank của record export theo place_id (ưu tiên) rồi fold(ten). Không có -> _BIG."""
    pid = (rec.get("identity") or {}).get("place_id") \
        or (rec.get("external_ids") or {}).get("google_place_id")
    if pid and ("pid:" + pid) in idx:
        return idx["pid:" + pid]
    ten = rec.get("name") or ""
    return idx.get("ten:" + fold(ten), _BIG)


def sap_xep(records, city_dir, loai):
    """Sắp ỔN ĐỊNH theo rank ảnh hưởng; record chưa rank giữ thứ tự tương đối cũ (xuống sau).
    KHÔNG thêm field số nào vào record — chỉ đổi thứ tự."""
    idx = thu_tu(city_dir, loai)
    if not idx:
        return records
    return sorted(records, key=lambda r: _khoa_rank(r, idx))
