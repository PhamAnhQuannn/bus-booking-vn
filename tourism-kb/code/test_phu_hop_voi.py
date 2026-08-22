# -*- coding: utf-8 -*-
"""Guard test cho editorial tier (002) — câu "phù hợp với" phải thuần controlled-vocab.

Chạy: PYTHONIOENCODING=utf-8 python tourism-kb/code/test_phu_hop_voi.py
"""
import re
import phu_hop_voi_data as m


def test_no_numbers():
    # 002 hard-limit: editorial KHÔNG chứa số (giá/khoảng cách/thời lượng — nguồn LLM bịa cổ điển)
    for k, v in list(m.PHRASE_TABLE.items()) + list(m.CATEGORY_FALLBACK.items()):
        assert not re.search(r"\d", v), f"PHRASE có SỐ (cấm): {k} -> {v}"


def test_lookup_shape():
    # có vibes khớp -> câu; catch-all (rỗng + không fallback) -> None (omit trung thực)
    assert m.phu_hop_voi(["ngam-canh", "thien-nhien-mao-hiem"], "Thác nước") == \
        "Đây là điểm phù hợp với khách muốn kết hợp ngắm cảnh với vui chơi ngoài trời."
    assert m.phu_hop_voi([], "Điểm tham quan") is None            # catch-all -> omit
    assert m.phu_hop_voi([], "Bảo tàng") is not None              # fallback category rõ
    assert m.phu_hop_voi(None, None) is None


def test_output_in_table():
    # mọi output (bỏ tiền tố + dấu chấm) PHẢI ∈ PHRASE_TABLE ∪ CATEGORY_FALLBACK — không tự sinh
    allowed = set(m.PHRASE_TABLE.values()) | set(m.CATEGORY_FALLBACK.values())
    for vibes, cat in [(["tam-linh"], "Đền / Miếu"), (["mua-sam"], "Chợ / Mua sắm"),
                       ([], "Khu du lịch giải trí (vui chơi trả phí)"), (["lich-su-van-hoa"], "Dinh thự / Di tích")]:
        out = m.phu_hop_voi(vibes, cat)
        if out:
            mid = out[len("Đây là điểm phù hợp với khách muốn "):].rstrip(".")
            assert mid in allowed, f"output NGOÀI bảng: {out}"


if __name__ == "__main__":
    test_no_numbers()
    test_lookup_shape()
    test_output_in_table()
    print("tat ca phep kiem editorial dat.")
