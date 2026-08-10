# OSRM — định tuyến (khoảng cách/thời gian)

status: **draft** · nguồn: `tourism-kb/code/sweep_osrm.py` + grill

- **Máy chủ demo `router.project-osrm.org`**: CHỈ dùng cho sweep offline (batch, có `User-Agent`
  lịch sự). **KHÔNG gọi trực tiếp từ request người dùng** — không SLA, rate-limit thấp, ToS cấm
  production.
- **V1 khuyến nghị**: **precompute + cache** ma trận Tier-A (~40–80 điểm/thành phố ⇒ ≤6.400 ô)
  chạy off-hours, lưu vào store, planner tra bảng. Không gọi live.
- **Khi cần định tuyến điểm tuỳ ý** (khách chọn điểm ngoài Tier-A): **tự host OSRM** bằng Docker
  `osrm-backend` trên extract `.osm.pbf` Việt Nam (~$10–20/tháng VM). Làm theo trigger đo được.
- Không cần API key.

Việc cần: [ ] quyết định V1 có cần định tuyến điểm-tuỳ-ý không (nếu không → chỉ precompute+cache).
