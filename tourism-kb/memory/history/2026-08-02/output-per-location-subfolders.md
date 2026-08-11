---
name: output-per-location-subfolders
description: output/ tách theo địa điểm — output/<slug>/ (da-lat/) qua hằng DIA_DIEM trong build_huong_dan_docx.py; giữ hậu tố -Da-Lat để G8 rule 3 vẫn bắt; write-guard prefix-match nên subfolder tự hợp lệ
type: history
date: 2026-08-02
---

# output/ chia theo địa điểm

**Vấn đề.** `tourism-kb/output/` phẳng, chỉ có 3 `.docx` Đà Lạt. Tương lai nhiều tỉnh
→ mỗi địa điểm cần thư mục riêng, tên file không đụng nhau.

**Đã làm.**
- Thêm hằng `DIA_DIEM = "da-lat"` + `_OUT_DD` ở đầu `code/build_huong_dan_docx.py`;
  `_CAU_HINH` giờ ghi ra `output/<DIA_DIEM>/…`. Đổi MỘT dòng khi làm địa điểm khác.
- Chuyển trên đĩa: 3 bản giao → `output/da-lat/`; `output/archive/*` → `output/da-lat/archive/`.
- Cập nhật test `code/test_duong_dan_ra.py` (đường dẫn mới + case địa điểm tương lai
  `output/nha-trang/…`), doc `code/duong_dan_ra.py`, `README.md`, `CLAUDE.md`.

**Quyết định load-bearing.** GIỮ hậu tố `-Da-Lat` trong tên file (không rút thành
`Diem-Den.docx`): G8 rule 3 bắt bản giao bị chép ra ngoài theo mẫu `*Diem-Den-*`
(có gạch nối đuôi) — bỏ hậu tố sẽ lọt lớp guard đó. Write-guard `duoc_phep()` khớp
tiền tố `tourism-kb/output/` nên mọi subfolder tự hợp lệ, KHÔNG cần sửa guard.

**Đã kiểm.** compile OK · `test_duong_dan_ra.py` exit 0 (đường da-lat/ và nha-trang/
tương lai đều pass, docs/ phẳng vẫn bị chặn) · file subfolder mới bị ignore qua luật
`output/` · G8 PASS exit 0.

**Còn treo (ngoài phạm vi).** `raw/` vẫn phẳng + gắn cứng Đà Lạt (`overture_dalat.json`…);
mọi `sweep_*`/`enrich_*` ghi phẳng vào `RAW=argv`. Muốn raw/ theo địa điểm là việc lớn hơn.

Liên quan: [[kb-relocation-pr408]]
