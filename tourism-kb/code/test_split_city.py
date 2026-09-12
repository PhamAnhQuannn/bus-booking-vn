# -*- coding: utf-8 -*-
"""Kiem split_city.subtract_from_parent() bang fixture tong hop — khong doc/ghi file, khong goi mang.

Chay:  PYTHONIOENCODING=utf-8 python tourism-kb/code/test_split_city.py

subtract_from_parent la buoc DUY NHAT trong pipeline MUTATE (mot chieu) export parent goc — tru diem-den
da carve ra child doc lap (Vung Tau/Con Dao khoi ho-chi-minh). Vi la mutation pha huy, no phai test duoc
tach khoi disk I/O (giong carve_area co load_fn injectable). Cac bay da tung am tham:
  - so_luong sai kieu -> diem_den meta khong cap nhat -> diem-den.json 309 nhung meta van 446 (drift).
  - ghi_chu co 3 hinh dang (list / None / scalar) -> nhanh sai lam mat ghi chu cu.
  - mutate input pmeta tai cho -> tac dung phu ngoai y muon.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import split_city as SC  # noqa: E402

# nhan ky vong cua note (dong bo voi SUBTRACT_FROM_PARENT) — dung hang so, khong go lai chuoi.
_CHILDREN = ", ".join(sorted(SC.SUBTRACT_FROM_PARENT))


def _rec(i):
    return {"id": i, "name": "diem %s" % i}


def t_basic_subtract():
    pdd = [_rec("A"), _rec("B"), _rec("C"), _rec("D")]
    kept, meta, removed, warns = SC.subtract_from_parent(pdd, {}, {"B", "C"})
    assert [r["id"] for r in kept] == ["A", "D"], kept
    assert removed == 2, removed
    assert warns == [], warns  # meta rong -> khong co so_luong -> khong canh bao


def t_two_children_one_parent():
    # 2 child (vung-tau + con-dao) tru cung 1 parent trong 1 run: drop set gop id cua ca hai.
    pdd = [_rec(i) for i in ("sg1", "sg2", "vt1", "vt2", "cd1")]
    drop = {"vt1", "vt2", "cd1"}
    kept, _meta, removed, _w = SC.subtract_from_parent(pdd, {}, drop)
    assert [r["id"] for r in kept] == ["sg1", "sg2"], kept
    assert removed == 3, removed


def t_so_luong_dict_updated():
    pdd = [_rec("A"), _rec("B"), _rec("C")]
    meta_in = {"so_luong": {"diem_den": 446, "nha_hang": 10, "khach_san": 5}}
    kept, meta, _r, warns = SC.subtract_from_parent(pdd, meta_in, {"C"})
    assert meta["so_luong"]["diem_den"] == 2, meta["so_luong"]  # 3 - 1 = 2 (khong con 446)
    assert meta["so_luong"]["nha_hang"] == 10, meta["so_luong"]  # cot khac giu nguyen
    assert warns == [], warns
    # KHONG mutate input:
    assert meta_in["so_luong"]["diem_den"] == 446, "khong duoc sua pmeta goc"


def t_so_luong_wrong_type_warns():
    # so_luong la int (sai kieu) -> khong cap nhat duoc -> PHAI canh bao (khong am tham).
    pdd = [_rec("A"), _rec("B")]
    kept, meta, _r, warns = SC.subtract_from_parent(pdd, {"so_luong": 446}, {"A"})
    assert len(warns) == 1, warns
    assert "so_luong" in warns[0] and "int" in warns[0], warns
    assert meta["so_luong"] == 446, meta  # giu nguyen gia tri sai (khong crash)


def t_so_luong_missing_no_warn():
    pdd = [_rec("A"), _rec("B")]
    _k, meta, _r, warns = SC.subtract_from_parent(pdd, {}, {"A"})
    assert warns == [], warns
    assert "so_luong" not in meta, meta  # khong tu them


def t_ghi_chu_shapes():
    pdd = [_rec("A"), _rec("B")]
    _note_frag = "da tach 1 diem-den ra child doc lap (%s)" % _CHILDREN
    # None -> [note]
    _k, meta, _r, _w = SC.subtract_from_parent(pdd, {}, {"A"})
    assert meta["ghi_chu"] == [_note_frag], meta["ghi_chu"]
    # list -> giu + append
    _k, meta, _r, _w = SC.subtract_from_parent(pdd, {"ghi_chu": ["cu"]}, {"A"})
    assert meta["ghi_chu"] == ["cu", _note_frag], meta["ghi_chu"]
    # scalar -> [str(cu), note]
    _k, meta, _r, _w = SC.subtract_from_parent(pdd, {"ghi_chu": "cu-scalar"}, {"A"})
    assert meta["ghi_chu"] == ["cu-scalar", _note_frag], meta["ghi_chu"]


def t_missing_id_kept():
    # record thieu "id" -> .get('id')=None, None khong nam trong drop -> GIU (khong bi tru nham).
    pdd = [{"name": "khong-id"}, _rec("A")]
    kept, _m, removed, _w = SC.subtract_from_parent(pdd, {}, {"A"})
    assert len(kept) == 1 and kept[0].get("name") == "khong-id", kept
    assert removed == 1, removed


def t_rerun_noop():
    # re-run: parent da tru roi -> drop id khong con trong pdd -> removed 0 (caller se skip, khong ghi de).
    pdd = [_rec("sg1"), _rec("sg2")]
    _k, _m, removed, _w = SC.subtract_from_parent(pdd, {}, {"vt1", "cd1"})
    assert removed == 0, removed


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("t_") and callable(v)]
    for t in tests:
        t()
        print("  ok  %s" % t.__name__)
    print("\n%d/%d PASS — subtract_from_parent" % (len(tests), len(tests)))


if __name__ == "__main__":
    main()
