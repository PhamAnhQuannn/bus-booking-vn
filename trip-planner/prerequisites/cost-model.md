# Cost model — AI Trip-Planner

status: **draft** · ngày tra: 2026-08-09

> KHÔNG phải cam kết tài chính. Ước lượng từ đơn giá công khai + đo token thật trong repo. Đơn giá
> API/hạ tầng đổi theo thời gian — coi mọi số là "đúng tại ngày tra", **kiểm lại tại nguồn trước khi
> hành động**. Nguồn cuối trang.

## Kết luận 1 dòng

Hệ thống **rẻ**: chi phí chi phối bởi **Gemini chat (~$0.005–0.03/lịch)**; Google/R2 ≈ **$0 ongoing**;
free tier lo ~vài nghìn lịch/tháng đầu. Không có khối tiền lớn — blocker "money" là **mô hình kinh doanh
(bán/gói)**, không phải phí vận hành.

## Per-service

| Dịch vụ | Dùng cho | Phí | Ghi chú |
|---|---|---|---|
| **Google Places** | place_id điểm đến | **$0** | Resolve 1 lần (IDs-Only Essentials, free 10k/tháng) — ĐÃ xong 1,086 điểm. Lưu **vĩnh viễn** (chỉ place_id, hợp ToS). |
| **Google — giờ mở** | hiển thị giờ LIVE | **$0** | Dùng **LINK** `maps/place/?q=place_id:` — KHÔNG gọi Places API, KHÔNG cache → 0 phí/lượt + hợp ToS. |
| **Gemini Flash** | chat trích ràng buộc | **~$0.005–0.03/lịch** | Biến phí chính. Chi tiết dưới. Free ~1000 req/ngày. |
| **Vercel Functions** | engine + chat stream | Pro tier | Build lịch ~ms; chat giữ stream vài giây/turn (Fluid Compute). |
| **R2 (private)** | data KB JSON prod | **~$0** | ~27MB storage (free ≤10GB); đọc cache RAM → ít read. |
| **OSRM/OSM/Wikidata/Overture** | routing + data | **$0** | Free/self-host; phí = licensing attribution (xem go-live-gate). |

## Gemini — biến phí chính

Đơn giá (gemini-flash-latest ≈ 3.x Flash, 2026-08): **~$1.50/M input · ~$7.50/M output**. Free tier: Flash
giữ free, **~1000 request/ngày**, 5–15 RPM.

Ước token/turn (đo SYSTEM prompt thật + history 8-turn):
- SYSTEM prompt (30 city + rule + chống-dụ, tiếng Việt) ≈ **2,000–2,500 input**.
- History (≤8 turn × ~200) ≈ **1,600 input**.
- Output/turn (prose + function call) ≈ **150–300**.
- ⇒ ~**3,800 in + 250 out / turn**. 1 lịch = ~3–5 turn ⇒ ~**15k in + 1k out**.

Phí/lịch:
- Flash: 15k×$1.5/M + 1k×$7.5/M ≈ **$0.030**.
- Flash-Lite ($0.10/$0.40, rẻ ~6×): ≈ **$0.005**.

## Projection theo tải (Flash, ngoài free tier)

| Lịch/tháng | Gemini | Ghi chú |
|---|---|---|
| 1,000 | ~$30 (free tier phủ phần lớn) | ~33 lịch/ngày < 1000 req/ngày ⇒ **$0** thực |
| 6,000 | ~$180 (nhiều phần free) | ~200 lịch/ngày; ~1000 turn/ngày ≈ ngưỡng free RPD |
| 20,000 | ~$600 Flash / **~$100 Flash-Lite** | Vượt free rõ; chuyển Flash-Lite + rate-limit |

*(mỗi lịch ~3-5 turn; free tier tính theo REQUEST/ngày nên "lịch free" ≈ 1000/số-turn ≈ 200-300 lịch/ngày.)*

## Trigger trả tiền + đòn giảm phí

- **Rời free Gemini** khi > ~1000 turn/ngày → bật billing. Giảm: **Flash-Lite** (6× rẻ) · **cache RAM store**
  (đã có) · **rate-limit/user** · rút gọn SYSTEM prompt (30 city → "danh sách" thay vì liệt kê nếu token căng).
- **Vercel**: vượt Pro khi traffic cao → theo dõi Active-CPU; chat-stream giữ connection = CPU nhàn (I/O-bound).
- **Google**: chỉ tốn nếu ĐỔI sang gọi Places API server-side (hiện KHÔNG — dùng link). Giữ link = $0.
- **AI Gateway** (Vercel) tùy chọn: fallback model + observability + theo dõi chi phí thật (khuyến nghị khi lên tải).

## Nguồn (kiểm lại trước khi hành động)
- Gemini pricing 2026: cloudzero.com/blog/gemini-pricing · tokenmix.ai/blog/gemini-api-pricing (tra 2026-08-09)
- Gemini free tier RPD: aipromptshub.co/blog/gemini-api-free-tier-rate-limits (2026-08-09)
- Google Places billing (IDs-Only/Pro/free-tier): developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Token/turn: đo `trip-planner/lib/planner/parseIntent.ts` SYSTEM + history (repo, 2026-08-09)
