---
name: reexport-reverts-pass16-names
domain: build-pipeline
date: 2026-08-29
keywords: export_planner, ten_google, pass16, place_id, re-export, regression, canonical-name
---

# Re-export lặng lẽ REVERT tên Google + place_id nếu export_planner không consume `ten_google`

## Triệu chứng
Chạy `sweep_placeid_diem_den.py` (Pha 1) → re-export 37 slug → LIVE place_id **RỚT 77%→37%**, tên điểm
đảo về bản OSM gốc ('Thủy Đình' Google → 'Thủy đình làng Trường Lâm'). Prod R2 vẫn tốt (chưa redeploy).

## Nguyên nhân gốc
Tên Google (pass16, `enrich_google_name.py`) + place_id ghi vào enrichment dưới field **`ten_google`**
(row có CẢ `value` tên lẫn `place_id`, `method:pass16-google-name`). Bản export TỐT trước đó consume
`ten_google`. NHƯNG `export_planner.py:351` hiện tại chỉ dùng `_name = CURATE_RENAME.get(...)` (dict 3
entry) — **KHÔNG đọc ten_google**. Script apply cũ (`apply_name_review.py`, `enrich_google_name.py`) chỉ
còn `.pyc` (source đã xoá). → Bất kỳ re-export nào cũng revert tên + place_id, dù data còn trong enrichment.

## Bài học
- **Một field đã enrich (ten_google) mà renderer không đọc = data chết + regression rình rập.** Trước khi
  re-export/chạy lại 1 stage, xác minh renderer (export_planner) CÓ consume mọi field enrichment quan trọng
  (tên canonical, place_id), không chỉ field mặc định.
- Giá trị "đã apply" phải durable trong enrichment + được renderer đọc — KHÔNG dựa vào post-export patch
  script (dễ mất source, dễ bị re-export ghi đè).
- Prod baked per-deploy: local degrade KHÔNG chạm prod tới khi upload+redeploy → luôn đo local trước deploy.

## Fix (đã áp)
`export_planner.py`: thêm `_tg = e(pid,"ten_google")`; `_name = _tg.value or CURATE_RENAME...`; place_id
= `_tg.place_id or place_id_of(...)`; giữ tên gốc làm alt. → re-export nay durable, place_id 37%→78% (khôi phục).
Liên quan build-pipeline [[shared-rule]] (field xoá ở N renderer phải thêm lại cùchỗ).
