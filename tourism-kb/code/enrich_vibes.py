# -*- coding: utf-8 -*-
"""Tang ENRICH — gan slug VIBE fuzzy (lang-man, thu-gian, song-ao...) bang LLM doc name+description.

VI SAO LLM (khac phan con lai cua pipeline = thuan OSM/Overture): vibe cam xuc (lang man / thu gian /
song ao) KHONG co tin hieu trong category — chi nam trong ten + mo ta free-text. Rule (vibes.py) lo
tang tin cay; tang nay lo tang mo ho + override category catch-all (Khu vui choi / Bao tang).

TAT DINH + AN TOAN (yeu cau QA-debate 2026-08-10):
  - temperature=0, model pin (gemini-flash-latest).
  - Guard 1: chi giu slug thuoc VIBE_VOCAB (reject hallucinate ngoai enum).
  - Guard 2 (lang-man): chi nhan neu ten HOAC mo ta co tu khoa cap doi tuong minh — KHONG suy tu "dep/view".
  - Cache theo id -> khong goi lai (idempotent); provenance {model, date}. Ghi raw/<slug>/scrape/vibes_llm.json
    qua kiem_loi_ra (raw/ trong THU_MUC_CHO_PHEP + .gitignore). Review tay 100% truoc khi export lai + upload.

Build 2-pass:  export_planner.py <raw>  ->  enrich_vibes.py <slug>  ->  export_planner.py <raw>
Chay:  GEMINI_API_KEY=... PYTHONIOENCODING=utf-8 python tourism-kb/code/enrich_vibes.py da-lat [--force]
"""
import os
import sys
import json
import time
import datetime
import unicodedata
import urllib.request
import urllib.error

import duong_dan_ra as _dr
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vibes as _vb

MODEL = "gemini-flash-latest"
URL = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}"

# Guard 2: "lang-man" chi gan khi ten/mo ta chua 1 trong cac tu nay (fold, khong dau).
LANGMAN_KW = [
    "lang man", "hen ho", "cap doi", "tinh yeu", "tinh nhan", "nguoi yeu",
    "doi lua", "honeymoon", "couple", "tho mong", "tuan trang mat",
]


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def _prompt(name, desc, primary):
    vocab = ", ".join(_vb.VIBE_VOCAB)
    return (
        "Bạn phân loại 'không khí/vibe' cho MỘT địa điểm du lịch, TRẢ VỀ JSON mảng mã.\n"
        "CHỈ được dùng mã trong enum: [" + vocab + "].\n"
        "QUY TẮC: chỉ gán mã khi TÊN hoặc MÔ TẢ có bằng chứng rõ. KHÔNG suy diễn. "
        "Đặc biệt 'lang-man' chỉ khi có ý cặp đôi/hẹn hò/tình yêu tường minh — KHÔNG suy từ 'đẹp/view'. "
        "Không chắc thì trả mảng rỗng []. Không bịa mã ngoài enum.\n"
        "Địa điểm:\n- Tên: " + (name or "") + "\n- Loại: " + (primary or "") +
        "\n- Mô tả: " + (desc or "(không có)") + "\n\nJSON:"
    )


def _call(prompt, key):
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": {"type": "array", "items": {"type": "string"}},
        },
    }).encode("utf-8")
    obj = {}
    for attempt in range(5):  # retry-backoff cho 429 (free tier ~15 RPM)
        try:
            req = urllib.request.Request(URL.format(MODEL, key), data=body,
                                        headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                obj = json.load(resp)
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    parts = (((obj.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    txt = "".join(p.get("text", "") for p in parts).strip()
    try:
        arr = json.loads(txt)
    except (ValueError, TypeError):
        return []
    return arr if isinstance(arr, list) else []


def _clean(raw_slugs, name, desc):
    """Guard 1 + 2: giu slug in VIBE_VOCAB; gate 'lang-man' theo tu khoa; dedupe theo thu tu VIBE_VOCAB."""
    hay = fold(name) + " " + fold(desc)
    ok = set()
    for s in raw_slugs:
        v = str(s).strip().lower()
        if v not in _vb.VIBE_SET:
            continue
        if v == "lang-man" and not any(k in hay for k in LANGMAN_KW):
            continue  # reject over-tag lang-man
        ok.add(v)
    return [v for v in _vb.VIBE_VOCAB if v in ok]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    slug = args[0] if args else "da-lat"
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY chua cau hinh")

    src = os.path.join("tourism-kb", "export", slug, "diem-den.json")
    with open(src, encoding="utf-8") as f:
        recs = json.load(f)

    # cache duoi raw/<slug>/scrape (goi qua kiem_loi_ra khi ghi)
    cache_path = os.path.join("tourism-kb", "raw", slug, "scrape", "vibes_llm.json")
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)

    today = datetime.date.today().isoformat()
    n_new = 0
    for rec in recs:
        rid = rec.get("id")
        if not rid or (rid in cache and not force):
            continue
        name = rec.get("name") or ""
        desc = ((rec.get("description") or {}).get("value")) or ""
        primary = ((rec.get("category") or {}).get("primary")) or ""
        try:
            raw_slugs = _call(_prompt(name, desc, primary), key)
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            print("  ! {} loi goi LLM: {}".format(rid, e))
            continue
        vibes = _clean(raw_slugs, name, desc)
        cache[rid] = {"vibes": vibes, "model": MODEL, "date": today}
        n_new += 1
        print("  {} {} -> {}".format(rid, name[:30], vibes))
        time.sleep(4)  # nhe tay rate (free tier ~15 RPM)

    p = _dr.kiem_loi_ra(cache_path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp, p)
    print("Xong: +{} moi, tong {} entry -> {}".format(n_new, len(cache), cache_path))


if __name__ == "__main__":
    main()
