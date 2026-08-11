# -*- coding: utf-8 -*-
"""Nhan VIBE cho diem den — tang RULE (suy tu category), single source cua tap dong VIBE_VOCAB.

Vibe = "so thich / khong khi" khach neu (ngam-canh, lang-man, thu-gian...). Tang RULE nay chi suy
tu category.primary/secondary (tin cay). Cac category CATCH-ALL / mo ho (Khu vui choi, Bao tang,
Diem tham quan, Khac) COT Y BO QUA o day -> de tang ENRICH (enrich_vibes.py, doc name+description
bang LLM) quyet dinh, tranh gan sai (vd ga tau co bi tag "vui choi").

VIBE_VOCAB PHAI dong bo thu cong voi trip-planner/lib/planner/vibes.ts (sua 1 sua ca 2).
Nhan vibe la MANG SLUG ROI RAC — cam chuoi ghep "X/Y" (khop exact-set o engine plan.ts).
Rule tag khac tang trai_nghiem.py (nhan hien thi ghep) — dung nham.
"""

# Tap dong slug vibe — mirror VIBE_VOCAB ben TS.
VIBE_VOCAB = [
    # RULE (suy tu category)
    "ngam-canh",
    "tam-linh",
    "lich-su-van-hoa",
    "thien-nhien-mao-hiem",
    "mua-sam",
    "nong-nghiep-sinh-thai",
    "bien-dao",
    "suoi-nuoc-nong",
    # ENRICH (LLM offline)
    "song-ao-chup-hinh",
    "thu-gian-yen-tinh",
    "lang-man",
]
VIBE_SET = set(VIBE_VOCAB)

# category.primary/secondary -> [slug vibe]. Key khop Y HET chuoi trong trai_nghiem.py EXP_MAP
# (co space quanh "/"). Category mo ho KHONG co trong dict nay -> tra [] -> nho enrich.
VIBE_RULES = {
    "Chùa / Thiền viện": ["tam-linh", "lich-su-van-hoa"],
    "Nhà thờ": ["tam-linh", "lich-su-van-hoa"],
    "Đền / Miếu": ["tam-linh"],
    "Dinh thự / Di tích": ["lich-su-van-hoa"],
    "Thác nước": ["ngam-canh", "thien-nhien-mao-hiem"],
    "Hồ / Đập": ["ngam-canh"],
    "Công viên / Vườn hoa": ["ngam-canh"],
    "Điểm ngắm cảnh": ["ngam-canh"],
    "Cáp treo": ["ngam-canh"],
    "Núi / Đèo / Đường mòn": ["ngam-canh", "thien-nhien-mao-hiem"],
    "Hang động": ["thien-nhien-mao-hiem"],
    "Vườn quốc gia / Khu bảo tồn": ["thien-nhien-mao-hiem", "ngam-canh"],
    "Bãi biển": ["bien-dao", "ngam-canh"],
    "Đảo": ["bien-dao", "ngam-canh"],
    "Suối nước nóng": ["suoi-nuoc-nong"],
    "Chợ / Mua sắm": ["mua-sam"],
    "Nông trại / Vườn": ["nong-nghiep-sinh-thai"],
}

# Category catch-all/mo ho — cot y KHONG rule (lesson overture-catchall + QA-debate 2026-08-10).
AMBIG = {"Khu vui chơi", "Bảo tàng", "Điểm tham quan", "Khác"}


def nhan_vibes_rule(primary, secondary=None):
    """category.primary(+secondary) -> list slug vibe RULE (union, giu thu tu VIBE_VOCAB, dedupe).

    Category mo ho / khong biet -> [] (de enrich lo). Khong bao gio tra slug ngoai VIBE_VOCAB.
    """
    cats = [primary] + list(secondary or [])
    got = []
    for c in cats:
        for v in VIBE_RULES.get(c, []):
            if v not in got:
                got.append(v)
    # giu thu tu on dinh theo VIBE_VOCAB (tat dinh)
    return [v for v in VIBE_VOCAB if v in got]
