# -*- coding: utf-8 -*-
"""compose_intro V2 — sinh "Giới thiệu nhanh" 2 câu cho 1 record KB (build-time, KHÔNG LLM).

Câu 1 (fact) = LẮP SLOT từ field có nguồn qua từ điển hữu hạn viết tay — mọi cụm truy về field.
Câu 2 (editorial) = tra sổ tay `phu_hop_voi_data` (002, controlled vocab, có nhãn Gợi ý biên tập).
Hai câu do hai module riêng. Bất biến: không sinh tự do · không con số · không chắc → để trống (CẤM
fallback "Đây là {category}.").

compose_intro(rec, editorial_on) -> dict {fact, editorial, tier, composed_from, source_ids}.
`vibes` (dù nguồn rule+llm) chỉ dùng để CHỌN NHÓM trải nghiệm (phân loại) — chữ nghĩa lấy từ từ điển tay.
"""
import re
import phu_hop_voi_data as _phv

# category.primary (19 giá trị THẬT trong KB) -> cụm loại hình đọc được. "Điểm tham quan" = rổ chung -> None (tier C).
CATEGORY_PHRASE = {
    "Thác nước": "thác nước",
    "Chùa / Thiền viện": "ngôi chùa",
    "Dinh thự / Di tích": "di tích lịch sử",
    "Nhà thờ": "nhà thờ",
    "Công viên / Vườn hoa": "công viên",
    "Bảo tàng": "bảo tàng",
    "Bãi biển": "bãi biển",
    "Vườn quốc gia / Khu bảo tồn": "vườn quốc gia",
    "Đền / Miếu": "ngôi đền",
    "Đảo": "hòn đảo",
    "Điểm ngắm cảnh": "điểm ngắm cảnh",
    "Hang động": "hang động",
    "Núi / Đèo / Đường mòn": "khu vực núi non",
    "Hồ / Đập": "hồ cảnh quan",
    "Khu du lịch giải trí (vui chơi trả phí)": "khu du lịch giải trí",
    "Khu vui chơi": "khu vui chơi giải trí",
    "Chợ / Mua sắm": "khu chợ",
    "Nông trại / Vườn": "nông trại",
    # "Điểm tham quan" -> KHÔNG có (rổ chung Overture catch-all) -> tier C
}

# (primary, secondary) đặc thù -> override cụm loại. Datanla = Thác nước + Khu vui chơi -> "khu du lịch thác nước".
CATEGORY_SECONDARY_OVERRIDE = {
    ("Thác nước", "Khu vui chơi"): "khu du lịch thác nước",
}

# vibe-signature ("+".join sorted) -> mệnh đề trải nghiệm (ghép SAU cụm loại, KHÔNG phẩy). 9 sig thực phủ ~99%.
EXPERIENCE_PHRASE = {
    "ngam-canh+thien-nhien-mao-hiem": "kết hợp tham quan thiên nhiên và các hoạt động phiêu lưu, mạo hiểm",
    "lich-su-van-hoa+tam-linh": "kết hợp tham quan kiến trúc và tìm hiểu văn hoá tâm linh",
    "ngam-canh": "để tham quan, ngắm cảnh",
    "bien-dao+ngam-canh": "để tắm biển, ngắm cảnh biển đảo",
    "tam-linh": "để chiêm bái",
    "lich-su-van-hoa": "để tìm hiểu lịch sử – văn hoá",
    "thien-nhien-mao-hiem": "để khám phá thiên nhiên",
    "mua-sam": "để mua sắm, thưởng thức ẩm thực địa phương",
    "nong-nghiep-sinh-thai": "để trải nghiệm sinh thái nông nghiệp",
}

REGION_LABEL = {}   # region_id -> "ở khu vực …" (viết tay khi cần; rỗng = bỏ mệnh đề vị trí tier-3)

_MAX_WORDS = 30
_fold = lambda s: (s or "").lower()


def _loai_phrase(cat):
    primary = (cat or {}).get("primary")
    secs = (cat or {}).get("secondary") or []
    for sc in secs:
        ov = CATEGORY_SECONDARY_OVERRIDE.get((primary, sc))
        if ov:
            return ov, True
    base = CATEGORY_PHRASE.get(primary)
    return base, False


def _vi_tri(rec, used):
    ext = (rec.get("ext") or {}).get("destination") or {}
    road = ((ext.get("map") or {}).get("nearest_main_road") or "").strip()
    full = (rec.get("address") or {}).get("full_address") or ""
    # bỏ đường CÓ SỐ (Quốc lộ 27, ĐT.101, tỉnh lộ N…): generic, ít giá trị định vị + vi phạm "0 số"
    if road and not re.search(r"\d", road):
        low = road.lower()
        if low.startswith("đèo "):
            used.append("ext.destination.map.nearest_main_road")
            return "nằm trên khu vực " + "đèo " + road[4:].strip()      # thường hoá "Đèo" -> "đèo"
        # tên đường thường: chỉ dùng khi full_address CŨNG chứa (chống OSRM snap lệch)
        if _fold(road) in _fold(full):
            used.append("ext.destination.map.nearest_main_road")
            return "nằm trên đường " + re.sub(r"^(đường|Đường)\s+", "", road)
    rid = rec.get("region_id")
    if rid and REGION_LABEL.get(rid):
        used.append("region_id")
        return REGION_LABEL[rid]
    return None


def compose_intro(rec, editorial_on=False):
    ext = (rec.get("ext") or {}).get("destination") or {}
    ten = rec.get("name") or ""
    used = []

    loai, used_sec = _loai_phrase(rec.get("category"))
    # Câu 2 (độc lập câu 1) — tra sổ tay 002; gated kill-switch ở tầng export
    editorial = _phv.phu_hop_voi(ext.get("vibes"), (rec.get("category") or {}).get("primary")) if editorial_on else None

    if not loai:
        return {"fact": None, "editorial": editorial, "tier": "C", "composed_from": [],
                "source_ids": rec.get("source_ids") or []}
    used.append("category.primary")
    if used_sec:
        used.append("category.secondary")

    sig = "+".join(sorted(v for v in (ext.get("vibes") or []) if v))
    exp = EXPERIENCE_PHRASE.get(sig)
    if exp:
        used.append("ext.destination.vibes")

    vi_tri = _vi_tri(rec, used)

    def _build(with_vitri, with_exp):
        s = f"{ten} là {loai}"
        if with_exp and exp:
            s += " " + exp
        if with_vitri and vi_tri:
            s += ", " + vi_tri
        return s + "."

    fact = _build(True, True)
    if len(fact.split()) > _MAX_WORDS:            # quá dài: bỏ vị trí, rồi bỏ trải nghiệm
        fact = _build(False, True)
        if "ext.destination.map.nearest_main_road" in used:
            used.remove("ext.destination.map.nearest_main_road")
        used[:] = [u for u in used if u != "region_id"]
    if len(fact.split()) > _MAX_WORDS:
        fact = _build(False, False)
        if "ext.destination.vibes" in used:
            used.remove("ext.destination.vibes")
        exp = None

    tier = "A" if exp else "B"
    # guard thoái hoá: câu chỉ còn "{ten} là {loai}." mà loai ≡ nhãn category thô -> hạ C (không render)
    if not exp and not (vi_tri and fact.endswith(vi_tri + ".")):
        raw = ((rec.get("category") or {}).get("primary") or "").lower()
        if _fold(loai) == raw:
            return {"fact": None, "editorial": editorial, "tier": "C", "composed_from": [],
                    "source_ids": rec.get("source_ids") or []}

    return {"fact": fact, "editorial": editorial, "tier": tier,
            "composed_from": used, "source_ids": rec.get("source_ids") or []}
