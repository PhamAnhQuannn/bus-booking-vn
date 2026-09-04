# -*- coding: utf-8 -*-
"""Pytest cho split_city.py (P2, hygiene). Dung fixture TONG HOP trong-bo-nho — KHONG doc
areas.json / diem-den.json / tourism-kb export/raw that (guard bat buoc). `import split_city`
AN TOAN: pipeline chinh (doc/ghi file, doc areas.json that) nam trong main(), chi chay khi
`python tourism-kb/code/split_city.py` — khong chay luc import module (xem split_city.main()).

Chay:  python -m pytest tourism-kb/code/tests/ -q   (tu goc repo)
"""
import os
import sys

_CODE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tourism-kb/code
if _CODE_DIR not in sys.path:
    sys.path.insert(0, _CODE_DIR)

import split_city as sc  # noqa: E402


def _rec(ten, ward, lat=22.34, lon=103.84):
    """Diem den tong hop toi gian — chi cac field split_city dung (ward_of/near)."""
    return {
        "id": "sy-" + ten.lower().replace(" ", "-"),
        "name": ten,
        "address": {"full_address": "%s, Sa Pa, Lào Cai" % ward},
        "coordinates": {"latitude": lat, "longitude": lon},
    }


# ── ward_of ──────────────────────────────────────────────────────────────────
def test_ward_of_extracts_leading_ward_token():
    r = _rec("Nhà thờ đá", "Phường Sa Pa")
    assert sc.ward_of(r) == "phường sa pa"


def test_ward_of_none_when_no_ward_segment():
    r = _rec("Đâu đó", "")
    r["address"]["full_address"] = "Không có ward, Lào Cai"
    assert sc.ward_of(r) is None


# ── carve_area: sa-pa ward-carve behavior (registry-driven, areas.json shape) ────────────────
def test_carve_area_sa_pa_ward_carve_splits_expected_subset():
    """Fixture tong hop mo phong khu Sa Pa: 3 diem trong ward-allow, 2 diem NGOAI (TP Lao Cai) —
    carve_area() phai giu DUNG 3 diem trong khu, loai 2 diem ngoai khu."""
    area = {
        "slug": "sa-pa",
        "parent": "lao-cai",
        "displayName": "Sa Pa",
        "center": {"lat": 22.34, "lon": 103.84},
        "wardAllow": ["phường sa pa", "xã tả van"],
    }
    in_ward = [
        _rec("Nhà thờ đá Sa Pa", "Phường Sa Pa"),
        _rec("Bản Cát Cát", "Phường Sa Pa"),
        _rec("Núi Hàm Rồng", "Phường Sa Pa"),
        _rec("Chợ đêm Sa Pa 2", "Phường Sa Pa"),
        _rec("Nhà thờ đá 2", "Phường Sa Pa"),
        _rec("Thác Tình Yêu", "Xã Tả Van"),
        _rec("Bản Tả Van", "Xã Tả Van"),
        _rec("Thắng cảnh Tả Van 2", "Xã Tả Van"),
    ]
    out_of_ward = [
        _rec("Chợ TP Lào Cai", "Phường Lào Cai"),        # NGOAI ward-allow
        _rec("Cầu Kiều biên giới", "Phường Duyên Hải"),   # NGOAI ward-allow
    ]
    dd = in_ward + out_of_ward

    def fake_load(parent, fn):
        assert parent == "lao-cai"  # dung parent tu area entry, khong hard-code
        if fn == "diem-den.json":
            return dd
        return []

    out = sc.carve_area(area, load_fn=fake_load)
    assert out is not None
    slug, ten, center, sub_dd, sub_nh, sub_ks, meta = out
    assert slug == "sa-pa"
    assert len(sub_dd) == len(in_ward)
    assert {r["name"] for r in sub_dd} == {r["name"] for r in in_ward}
    for r in out_of_ward:
        assert r["name"] not in {x["name"] for x in sub_dd}


def test_carve_area_skips_when_below_min_destinations():
    area = {"slug": "sa-pa", "parent": "lao-cai", "center": {"lat": 22.34, "lon": 103.84},
            "wardAllow": ["phường sa pa"]}
    dd = [_rec("Chỉ một điểm", "Phường Sa Pa")]  # < 8 -> SKIP

    def fake_load(parent, fn):
        return dd if fn == "diem-den.json" else []

    assert sc.carve_area(area, load_fn=fake_load) is None


# ── carve_area: P1 defensive-subscript hardening on malformed areas.json entries ─────────────
def test_carve_area_missing_parent_key_skips_no_crash():
    area = {"slug": "broken", "center": {"lat": 1, "lon": 2}, "wardAllow": []}  # thieu "parent"
    assert sc.carve_area(area) is None  # KHONG raise KeyError


def test_carve_area_missing_center_key_skips_no_crash():
    area = {"slug": "broken2", "parent": "lao-cai", "wardAllow": []}  # thieu "center" hoan toan
    assert sc.carve_area(area) is None  # KHONG raise KeyError/TypeError


def test_carve_area_malformed_center_type_skips_no_crash():
    area = {"slug": "broken3", "parent": "lao-cai", "center": "not-a-dict", "wardAllow": []}
    assert sc.carve_area(area) is None  # a["center"]["lat"] cu se raise TypeError tren string


def test_carve_area_non_dict_entry_skips_no_crash():
    assert sc.carve_area(["not", "a", "dict"]) is None
    assert sc.carve_area(None) is None


def test_carve_area_no_slug_skips():
    assert sc.carve_area({"parent": "lao-cai", "center": {"lat": 1, "lon": 2}}) is None


# ── _is_junk_anu (export_planner.py) ──────────────────────────────────────────────────────────
# export_planner.py chay TOAN BO pipeline export o muc top-level luc import (doc raw/, ghi
# export/ qua kiem_loi_ra) — KHONG duoc import truc tiep trong test (vi pham guard "khong
# chay pipeline/khong dong real data"). Trich rieng doan _JUNK_ANU/_is_junk_anu bang parse
# text tu chinh file nguon (khong copy tay logic) roi exec trong namespace co lap.
def _load_is_junk_anu():
    src_path = os.path.join(_CODE_DIR, "export_planner.py")
    with open(src_path, encoding="utf-8") as f:
        src = f.read()
    start = src.index("_JUNK_ANU = re.compile(")
    end = src.index("\ndiem_den = []")
    snippet = src[start:end]
    ns = {"re": __import__("re")}
    exec(compile(snippet, "export_planner.py::_is_junk_anu", "exec"), ns)
    return ns["_is_junk_anu"]


_is_junk_anu = _load_is_junk_anu()


def test_is_junk_anu_flags_id_suffix():
    assert _is_junk_anu("Quán ăn-120000103244") is True


def test_is_junk_anu_flags_coordinate_name():
    assert _is_junk_anu("(22.53 104.28)") is True


def test_is_junk_anu_flags_gas_station_mislabel():
    assert _is_junk_anu("Cây xăng Petrolimex") is True


def test_is_junk_anu_flags_photo_node():
    assert _is_junk_anu("photo booth abc") is True


def test_is_junk_anu_flags_google_business_hash():
    assert _is_junk_anu("Dlngockham") is True


def test_is_junk_anu_flags_empty_name():
    assert _is_junk_anu("") is True
    assert _is_junk_anu(None) is True


def test_is_junk_anu_passes_real_names():
    for ten in ("Nhà hàng Ngon Sài Gòn", "Khách sạn Mường Thanh Đà Lạt",
                "Quán Bún Chả Hương Liên", "Highlands Coffee Hồ Xuân Hương"):
        assert _is_junk_anu(ten) is False


# ── _ten_khop / _khac_loai type-guard (enrich_wikidata.py, P4) ───────────────────────────────
def _load_wikidata_matchers():
    """Trich _ten_khop + _khac_loai (+ ham/hang so ho tro) tu enrich_wikidata.py bang parse text.
    Module nay doc sys.argv[1] + raw/ that ngay dau file — KHONG duoc import truc tiep."""
    src_path = os.path.join(_CODE_DIR, "enrich_wikidata.py")
    with open(src_path, encoding="utf-8") as f:
        src = f.read()
    start = src.index("import unicodedata")
    end = src.index("picked = json.load(")
    snippet = src[start:end]
    ns = {}
    exec(compile(snippet, "enrich_wikidata.py::matchers", "exec"), ns)
    return ns["_ten_khop"], ns["_khac_loai"]


_ten_khop, _khac_loai = _load_wikidata_matchers()


def test_ten_khop_true_matches_still_pass():
    assert _ten_khop("Bãi biển Nha Trang", "Bãi biển Nha Trang") is True
    assert _ten_khop("Chùa Linh Ứng", "Chùa Linh Ứng Bãi Bụt") is True


def test_khac_loai_rejects_bridge_type_for_beach_name():
    # Thuc the Wikidata la CAU (ha tang), diem KB la BAI BIEN cung dia danh — khac loai.
    assert _khac_loai("cầu", "Bãi biển Nha Trang") is True
    assert _khac_loai("bridge", "Bãi biển Nha Trang") is True


def test_khac_loai_allows_matching_when_type_not_infra():
    assert _khac_loai("bãi biển", "Bãi biển Nha Trang") is False
    assert _khac_loai("", "Bãi biển Nha Trang") is False
    assert _khac_loai(None, "Bãi biển Nha Trang") is False


def test_khac_loai_ignores_non_beach_names():
    # Ha tang nhung ten diem KHONG phai bai bien -> guard nay khong ap dung (van con _ten_khop lo).
    assert _khac_loai("cầu", "Chợ Đà Lạt") is False


def test_type_guard_end_to_end_rejects_bridge_but_ten_khop_alone_would_pass():
    """Mo phong dung bug that: entity la cau TRUNG TEN voi bai bien -> _ten_khop() mot minh se
    khop (chi xet ten), nhung guard _khac_loai() phai chan truoc khi ket luan khop."""
    ten_diem, wd_label, wd_type = "Bãi biển Nha Trang", "Bãi biển Nha Trang", "cầu"
    assert _ten_khop(ten_diem, wd_label) is True          # ten khop hoan toan
    assert _khac_loai(wd_type, ten_diem) is True           # nhung khac loai -> phai bi tu choi
    accepted = (not _khac_loai(wd_type, ten_diem)) and _ten_khop(ten_diem, wd_label)
    assert accepted is False
