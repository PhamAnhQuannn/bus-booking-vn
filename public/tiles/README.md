# Map tiles (PMTiles) — 1 file Việt Nam cho MỌI city

Nền vector do `protomaps-leaflet` (Canvas 2D) render trong `trip-planner/components/PlannerMap.tsx`.

**Thay đổi 2026-08-10:** bỏ per-city `/tiles/<slug>.pmtiles` (chỉ 3 city) → **1 file PMTiles phủ cả Việt Nam**
(`vietnam.pmtiles`, maxzoom 14, ~457MB), **đã upload R2 private** key `tiles/vietnam.pmtiles`. Serve **same-origin**
qua `/api/planner/tiles` (proxy Range từ R2, giữ bucket private, CSP `'self'`). 1 file phục vụ mọi city; browser
range-fetch chỉ tile cần. Env `NEXT_PUBLIC_TILES_URL` chỉ để override sang host ngoài. Lỗi tile → map vẫn vẽ pin.

**Data** © OpenStreetMap (ODbL), basemap © Protomaps.

## Re-cut khi tile cũ (vài lần/năm)
Build lại + upload lại R2 cùng key `tiles/vietnam.pmtiles`, rồi recycle instance (cache-control immutable):

## Tạo file VN + host (1 lần)
Cần `pmtiles` CLI (go-pmtiles). Nguồn = Protomaps daily build.

```bash
# 1. lấy CLI (Windows x86_64 ví dụ)
curl -sL -o pmt.zip https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_<ver>_Windows_x86_64.zip
unzip pmt.zip pmtiles.exe

# 2. chọn ngày build tồn tại (HTTP 200): https://build.protomaps.com/<YYYYMMDD>.pmtiles

# 3. cắt bbox Việt Nam (maxzoom 14 = street level, đủ cho pin)
SRC=https://build.protomaps.com/<YYYYMMDD>.pmtiles
./pmtiles extract $SRC vietnam.pmtiles --bbox=102.1,8.2,109.5,23.4 --maxzoom=14
```

## Host + cấu hình
1. Upload `vietnam.pmtiles` lên nơi **public + hỗ trợ range** (vd R2 public bucket / r2.dev, hoặc CDN).
2. Set `NEXT_PUBLIC_TILES_URL=https://<host>/vietnam.pmtiles` (Vercel Production + local).
3. `next.config.ts` tự thêm origin của URL vào CSP `connect-src` — không cần sửa CSP tay.

Host phải trả `Accept-Ranges: bytes`. Kích thước file VN maxzoom 14 ~100–300MB (range-fetch nên tải rất ít/lần xem).
