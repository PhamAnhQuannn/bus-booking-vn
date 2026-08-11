# những thứ cần có — Prerequisites (AI Trip-Planner)

Mỗi thứ cần có (giấy phép, API/dịch vụ, quyền truy cập dữ liệu) = **1 file riêng**, điền
thông tin thật, để sẵn trước khi cần. Đây là kho tham chiếu, **không phải tư vấn pháp lý**;
mục giấy phép phải được luật sư xác nhận trước khi ra mắt có khách.

Nguyên tắc: mỗi tuyên bố (số tiền, quy trình, hạn mức) phải kèm **nguồn + ngày tra**. Số
liệu API/pháp lý đổi theo thời gian — coi mọi con số dưới đây là "đúng tại ngày tra", phải
kiểm lại tại nguồn chính thức trước khi hành động.

## Trạng thái

| File | Chủ đề | status |
|---|---|---|
| [go-live-gate.md](go-live-gate.md) | **Go/no-go tổng hợp** (gate + 4 rủi ro cần chốt) | **draft** |
| [cost-model.md](cost-model.md) | **Chi phí vận hành** (Gemini/Google/R2/Vercel + projection) | **draft** |
| [giay-phep-lu-hanh.md](giay-phep-lu-hanh.md) | Giấy phép KD dịch vụ lữ hành nội địa | **cần luật sư xác nhận** |
| [ban-do-tiles.md](ban-do-tiles.md) | Bản đồ: thư viện + nguồn tile (Leaflet/MapLibre, OSM, Mapbox) | done (chọn nhà cung cấp) |
| [google-places.md](google-places.md) | Điều khoản lưu trữ Google Places (chỉ `place_id`) | **done** (impl 2026-08-09) |
| [osrm.md](osrm.md) | OSRM: demo vs self-host cho định tuyến | todo |
| [wikidata.md](wikidata.md) | Wikidata (SPARQL, sitelink làm proxy "nổi tiếng") | todo |
| [analytics-consent.md](analytics-consent.md) | Plausible/PostHog + Iubenda (đồng thuận) | todo |
| [hotelbeds-content-api.md](hotelbeds-content-api.md) | Nguồn hạng/giá khách sạn (đối tác) | todo |
| [data-access-cuc-du-lich.md](data-access-cuc-du-lich.md) | Xin quyền truy cập đăng ký nhà nước (csdl 403) | todo |

`status`: todo (chưa điền) · draft (điền sơ) · done (đủ dùng) · cần luật sư/đối tác (chờ ngoài).

## Ranh giới
- Giai đoạn này **chưa bán gì** — chưa cần giấy phép lữ hành để CHẠY chức năng tư vấn miễn phí;
  nhưng để sẵn hồ sơ vì mô hình marketplace/gói bán về sau là nhánh pháp lý CHƯA chốt.
- Không dán PII (số điện thoại thật) vào bất kỳ file nào ở đây.
