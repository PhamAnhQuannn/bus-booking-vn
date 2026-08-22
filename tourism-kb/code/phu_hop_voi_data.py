# -*- coding: utf-8 -*-
"""Editorial tier (002) — câu "phù hợp với khách muốn…" per-LOẠI (controlled vocab).

Doctrine: Section-0 Rule 3 CẤM prose audience tự do. 002-editorial-tier cho phép tầng `bien-tap` dạng
CONTROLLED VOCAB keyed theo vibe-signature (KHÔNG per-place free prose). Câu ở đây là ORIGINAL (soạn từ
nghĩa vibe slug), KHÔNG paraphrase Wikipedia → CC-BY-SA clean. Người duyệt: owner. Không mint source_id
→ tự động ngoài verified_fields. Gated bởi kill-switch EDITORIAL_TIER (export_planner).

Key = "+".join(sorted(vibes)) — vibe-signature. Fallback theo category cho vài loại vibes-rỗng rõ ràng.
CATCH-ALL "Điểm tham quan" + combo đuôi hiếm → None (KHÔNG claim audience cho loại mơ hồ = null trung thực).
"""

# vibe-signature (sorted slug, "+"-join) -> mệnh đề sau "khách muốn"
PHRASE_TABLE = {
    "lich-su-van-hoa+tam-linh": "tham quan kiến trúc tôn giáo, tìm hiểu văn hoá – lịch sử",
    "ngam-canh": "ngắm cảnh, thư giãn ngoài trời",
    "lich-su-van-hoa": "tìm hiểu lịch sử – văn hoá",
    "ngam-canh+thien-nhien-mao-hiem": "kết hợp ngắm cảnh với vui chơi ngoài trời",
    "bien-dao+ngam-canh": "tắm biển, ngắm cảnh biển đảo",
    "tam-linh": "hành hương, chiêm bái",
    "thien-nhien-mao-hiem": "khám phá thiên nhiên, trải nghiệm ngoài trời",
    "mua-sam": "mua sắm, trải nghiệm ẩm thực địa phương",
    "nong-nghiep-sinh-thai": "trải nghiệm sinh thái nông nghiệp",
}

# fallback theo category.primary cho loại vibes-rỗng nhưng RÕ (không phải catch-all)
CATEGORY_FALLBACK = {
    "Bảo tàng": "tìm hiểu lịch sử – văn hoá",
    "Khu du lịch giải trí (vui chơi trả phí)": "vui chơi, giải trí",
}


def phu_hop_voi(vibes, category_primary):
    """Trả câu "Phù hợp với khách muốn …" hoặc None (omit — loại mơ hồ, không claim)."""
    sig = "+".join(sorted(v for v in (vibes or []) if v))
    mid = PHRASE_TABLE.get(sig) or (CATEGORY_FALLBACK.get(category_primary) if not sig else None)
    return f"Đây là điểm phù hợp với khách muốn {mid}." if mid else None
