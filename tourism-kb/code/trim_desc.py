# -*- coding: utf-8 -*-
"""trim_desc (B2) — rút mô tả Wikipedia hiển thị: 2 câu đầu, LOẠI câu địa-chỉ/khoảng-cách-TP-khác.

KHÔNG phá `description.value` gốc — chỉ sinh field dẫn xuất `mo_ta`. Giữ nguyên văn câu (verbatim,
CC-BY-SA — attribution "Theo Wikipedia" ở UI). 0 câu sau lọc → câu đầu nguyên bản (mo_ta là phụ, đã có
intro.fact phía trên).
"""
import re

_ADDR = re.compile(r"số\s+\d+\s+(đường|phố)", re.I)                                  # địa chỉ đầy đủ
_DIST_CITY = re.compile(r"cách\s+.{0,30}(Thành phố|TP)\.?\s+.{0,25}\d+\s?km", re.I)  # khoảng cách tới TP khác
_TOA_LAC = re.compile(r"tọa lạc tại số", re.I)


def _split_sentences(t):
    return [p.strip() for p in re.split(r"(?<=\.)\s+", (t or "").strip()) if p.strip()]


def trim_desc(text):
    sents = _split_sentences(text)
    if not sents:
        return text
    kept = [s for s in sents if not (_ADDR.search(s) or _DIST_CITY.search(s) or _TOA_LAC.search(s))]
    return " ".join(kept[:2] if kept else sents[:1])
