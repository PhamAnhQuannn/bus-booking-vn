# -*- coding: utf-8 -*-
"""Test compose_intro V2 — golden + property toàn KB. Chạy: PYTHONIOENCODING=utf-8 python .../test_compose_intro.py"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose_intro as C

EXPORT = os.path.join(os.path.dirname(__file__), "..", "export")
GOLDEN = ("Thác Datanla là khu du lịch thác nước kết hợp tham quan thiên nhiên và các hoạt động "
          "phiêu lưu, mạo hiểm, nằm trên khu vực đèo Prenn.")
BANNED = ["tuyệt đẹp", "nổi tiếng", "hàng đầu", "không thể bỏ qua", "thiên đường", "tuyệt vời"]


def _all_records():
    for f in glob.glob(os.path.join(EXPORT, "*", "diem-den.json")):
        for r in json.load(open(f, encoding="utf-8")):
            yield r


def test_golden():
    dl = next(r for r in _all_records() if "Datanla" in r.get("name", ""))
    res = C.compose_intro(dl, editorial_on=True)
    assert res["fact"] == GOLDEN, res["fact"]
    assert res["tier"] == "A"
    assert res["editorial"] == "Đây là điểm phù hợp với khách muốn kết hợp ngắm cảnh với vui chơi ngoài trời."


def test_tier_c_null():
    # "Điểm tham quan" (rổ chung) -> fact null, KHÔNG fallback "Đây là …"
    r = next(r for r in _all_records() if (r.get("category") or {}).get("primary") == "Điểm tham quan")
    res = C.compose_intro(r, editorial_on=True)
    assert res["fact"] is None and res["tier"] == "C"


def test_thap_tram_huong():
    # gốc lỗi phân loại (Dinh thự / Di tích) -> "di tích lịch sử", KHÔNG còn "Đây là dinh thự/di tích."
    r = next((r for r in _all_records() if "Trầm Hương" in r.get("name", "")), None)
    if r:
        res = C.compose_intro(r, editorial_on=False)
        assert res["fact"] is None or "di tích lịch sử" in res["fact"]
        assert not (res["fact"] or "").startswith("Đây là")


def test_properties_whole_kb():
    cat_vals = set(C.CATEGORY_PHRASE.values()) | {v for v in C.CATEGORY_SECONDARY_OVERRIDE.values()}
    n = 0
    for r in _all_records():
        n += 1
        res = C.compose_intro(r, editorial_on=True)
        fact, edi, tier = res["fact"], res["editorial"], res["tier"]
        # tier C ⟺ fact null
        assert (tier == "C") == (fact is None), (tier, fact)
        if fact:
            # số trong fact CHỈ được phép nếu nằm trong TÊN (composer không tự thêm số)
            digits_name = set(re.findall(r"\d", r.get("name", "")))
            assert set(re.findall(r"\d", fact)) <= digits_name, f"số lạ: {fact}"
            # phải có dạng "{tên} là …" + chứa ≥1 cụm loại trong từ điển
            assert " là " in fact
            assert any(p in fact for p in cat_vals), f"không cụm loại: {fact}"
            # không từ cảm thán — CHỈ soi phần từ-điển (bỏ TÊN: "Động Thiên Đường" là tên thật)
            tail = fact.replace(r.get("name", ""), "").lower()
            assert not any(b in tail for b in BANNED), f"từ cảm thán: {fact}"
        if edi:
            import phu_hop_voi_data as P
            mid = edi[len("Đây là điểm phù hợp với khách muốn "):].rstrip(".")
            assert mid in (set(P.PHRASE_TABLE.values()) | set(P.CATEGORY_FALLBACK.values())), edi
    assert n > 2000


def test_idempotent():
    r = next(r for r in _all_records() if "Datanla" in r.get("name", ""))
    assert C.compose_intro(r, True) == C.compose_intro(r, True)


def _report():
    from collections import Counter
    t = Counter(); miss_cat = Counter(); miss_vibe = Counter(); n = 0
    for r in _all_records():
        n += 1; res = C.compose_intro(r, editorial_on=True); t[res["tier"]] += 1
        prim = (r.get("category") or {}).get("primary")
        if prim and prim not in C.CATEGORY_PHRASE and prim != "Điểm tham quan":
            miss_cat[prim] += 1
        sig = "+".join(sorted(v for v in ((r.get("ext") or {}).get("destination") or {}).get("vibes") or [] if v))
        if sig and sig not in C.EXPERIENCE_PHRASE:
            miss_vibe[sig] += 1
    print(f"  TỔNG {n} | tier A={t['A']} B={t['B']} C={t['C']} | fact-coverage {100*(t['A']+t['B'])/n:.1f}%")
    if miss_cat:
        print("  category THIẾU từ điển:", dict(miss_cat.most_common(10)))
    if miss_vibe:
        print("  vibe-signature THIẾU EXPERIENCE_PHRASE:", dict(miss_vibe.most_common(10)))


if __name__ == "__main__":
    test_golden(); test_tier_c_null(); test_thap_tram_huong()
    test_properties_whole_kb(); test_idempotent()
    print("tat ca phep kiem compose_intro dat.")
    _report()
