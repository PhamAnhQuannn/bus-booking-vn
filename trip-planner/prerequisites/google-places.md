# Google Places — điều khoản lưu trữ

status: **done** · nguồn: `sweep_placeid_diem_den.py` + `store.ts`/`ItineraryCard.tsx` (impl 2026-08-09)

## Impl thật (2026-08-09) — hợp ToS + $0

- **place_id điểm đến**: resolve **1,086/2,134** (IDs-Only Essentials, free) → lưu `external_ids.google_place_id`
  **vĩnh viễn** (hợp lệ). Resolver `sweep_placeid_diem_den.py` chỉ ghi `{ten, place_id}` — **discard**
  `displayName`/`formattedAddress`/rating/giờ (chỉ dùng trong bộ nhớ để đối chiếu → đúng "Google Maps Content
  không ghi đĩa").
- **Giờ mở = deep-link** `https://www.google.com/maps/place/?q=place_id:<id>` trong card (chỉ khi thiếu giờ lưu).
  KHÔNG gọi Places API, KHÔNG cache nội dung → **$0/lượt** + §5.3 (link Google Maps, không đặt cạnh bản đồ
  Leaflet/OSM).
- **Toạ độ ta lưu = nguồn OSM/Overture**, KHÔNG phải Google Places → **không dính giới hạn 30 ngày** của Google
  (giới hạn đó chỉ áp toạ độ LẤY TỪ Places API — ta không lưu toạ độ Google).

## Điều khoản (tham chiếu)

Chỉ được lưu **`place_id`** (được phép lưu **vĩnh viễn**). Ràng buộc:
- **Toạ độ**: chỉ giữ tối đa **30 ngày**.
- **`displayName` / `formattedAddress`** ("Google Maps Content"): chỉ so khớp trong bộ nhớ,
  **KHÔNG ghi ra đĩa**.
- **§5.1**: được dùng nội dung Places **không cần** kèm bản đồ Google (không có điều khoản "no
  use independent of a Google map").
- **§5.2**: phải **ghi công** khi hiển thị nội dung Places.
- **§5.3**: **CẤM** để nội dung Places cạnh bản đồ KHÔNG-phải-Google → dùng `place_id` chỉ để
  tạo **deep-link Google Maps**, không hiển thị cạnh bản đồ Leaflet/OSM (xem [ban-do-tiles.md](ban-do-tiles.md)).
- Không dùng Google Places làm **backing store** (đã loại trong `data-sources.md` "Explicitly out").

Cần key: `GOOGLE_MAPS_API_KEY`. Việc cần: [ ] xác minh điều khoản hiện hành tại Places API
Service Specific Terms trước khi mở rộng lưu trữ.
