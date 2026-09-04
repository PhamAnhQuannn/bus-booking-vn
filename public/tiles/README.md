# Map tiles (PMTiles, self-hosted)

Per-city vector basemap extracts cho trip-planner (`PlannerMap.tsx`, protomaps-leaflet Canvas 2D).
Cả 35 tỉnh live (`trip-planner/lib/planner/cities.ts` → `CITIES`) đều có basemap (#528).

**Two serving paths, both same-origin `/tiles/<slug>.pmtiles`:**
- **3 flagship** (`da-lat`, `nha-trang`, `da-nang`) = file static commit ngay trong thư mục này →
  Vercel static serve (HTTP range mặc định). Static precedence bắt các path này trước route động.
- **32 còn lại** = object trong **R2** (`bbvn-prod`, key `tiles/<slug>.pmtiles`), serve qua proxy
  `app/tiles/[slug]/route.ts` (forward header `Range` → `GetObjectCommand({Range})` → 206 +
  `Content-Range`). Giữ CSP `connect-src 'self'` + PDPL (IP khách không chạm R2). Không phình git.

**Why self-host:** CSP `connect-src 'self'` (range same-origin), no API key, no vendor lock, no
user IP leaving origin (PDPL). Data © OpenStreetMap (ODbL), basemap © Protomaps.

**maxDataZoom per slug:** trần data thật của tile (protomaps overzoom từ mức này → maxZoom 16). Mặc
định 14; tỉnh mega-merge trải rộng cắt z12-13 để chặn size. Khai trong `PlannerMap.tsx`
`TILE_MAXDATAZOOM` (chỉ slug !=14) — PHẢI khớp cột maxzoom dưới, else request tile không tồn tại → blank.

**bbox = grid-max coverage:** cắt để bao TRỌN mọi điểm-đến engine phục vụ qua GRID
(days 1-7 × pace relaxed/moderate/packed × interests) — không chỉ 1 config. Bảo đảm không pin nào
rơi ngoài map. Audit: `it.days[].items[]` mọi combo, union theo tên (xem history 2026-08-30).
Ngoại lệ: điểm spillover tỉnh-sáp-nhập cực xa (vd chùa Sóc Trăng dưới can-tho >40km) — nếu engine
serve ở day-count cao thì bbox đã nới bao (can-tho z13, thai-nguyen z12).

## Files

### Flagship (static, trong repo)
| slug | bbox (minLon,minLat,maxLon,maxLat) | maxzoom | ~size |
|------|-----------------------------------|---------|-------|
| da-lat    | 108.3911,11.859,108.5806,12.0001 | 14 | 1.3 MB |
| nha-trang | 109.10,12.15,109.25,12.35 | 14 | 1.4 MB |
| da-nang   | 107.95,15.85,108.35,16.15 | 14 | 3.7 MB |

### R2 (bbvn-prod, key `tiles/<slug>.pmtiles`)
bbox = grid-max footprint (xem trên). Tổng ~55 MB / 32 file (0.7–5.4 MB mỗi file).

| slug | bbox (minLon,minLat,maxLon,maxLat) | maxzoom |
|------|-----------------------------------|---------|
| ha-noi | 105.7717,20.9675,105.9134,21.0701 | 14 |
| ho-chi-minh | 107.0324,10.3353,107.2402,10.6555 | 14 |
| hue | 107.4589,16.4178,107.6432,16.5942 | 14 |
| hai-phong | 106.667,20.7947,106.8403,20.91 | 14 |
| ninh-binh | 105.8944,20.2196,105.9907,20.2865 | 14 |
| can-tho | 105.6063,9.5181,106.0462,10.087 | 13 |
| bac-ninh | 105.9964,20.9824,106.7847,21.2948 | 12 |
| phu-tho | 104.9159,20.5433,105.7327,21.5489 | 12 |
| thai-nguyen | 105.4898,21.4835,106.14,22.4776 | 12 |
| tuyen-quang | 105.1296,21.75,105.5034,23.3215 | 12 |
| lao-cai | 103.7648,21.7291,104.1795,22.3752 | 13 |
| dong-thap | 105.5242,10.2581,106.342,10.7392 | 12 |
| vinh-long | 105.9272,9.6243,106.6376,10.3554 | 12 |
| phu-quoc | 103.7884,10.0907,104.0792,10.4493 | 13 |
| quy-nhon | 109.1161,13.7044,109.3154,13.9512 | 14 |
| ha-long | 106.9117,20.8785,107.1096,21.0234 | 14 |
| vung-tau | 107.0841,10.859,107.2389,11.0088 | 14 |
| dong-hoi | 106.206,17.5072,106.3755,17.6721 | 14 |
| tuy-hoa | 109.1983,13.1925,109.3471,13.3362 | 14 |
| chau-doc | 104.9661,10.4711,105.2363,10.7446 | 14 |
| dong-ha | 107.0717,16.7832,107.1847,16.8576 | 14 |
| mong-cai | 107.9087,21.4568,108.0892,21.5697 | 14 |
| van-don | 107.3329,20.8807,107.6191,21.239 | 13 |
| mui-ca-mau | 104.7087,8.4051,104.8737,8.7097 | 14 |
| tay-ninh-tp | 106.089,11.2711,106.1461,11.3365 | 14 |
| sa-pa | 103.7648,22.2367,103.9348,22.3752 | 14 |
| ba-be | 105.5566,22.3802,105.6871,22.4745 | 14 |
| dien-bien-phu | 102.9208,21.3463,103.052,21.4413 | 14 |
| dong-van | 105.1279,23.1019,105.2869,23.2729 | 14 |
| vinh | 105.5346,18.6362,105.7153,18.7282 | 14 |
| cao-bang-tp | 106.1378,22.6456,106.2731,22.7628 | 14 |
| thanh-hoa-tp | 105.6609,19.7717,105.8614,19.9043 | 14 |

## Re-cut (khi tile stale — roads/POIs drift; vài lần/năm là đủ)
Cần CLI `pmtiles` (go-pmtiles). Source = Protomaps daily planet build.

```bash
# 1. CLI (Windows x86_64)
curl -sL -o pmt.zip https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_<ver>_Windows_x86_64.zip
unzip pmt.zip pmtiles.exe

# 2. build date còn sống (HTTP 206): https://build.protomaps.com/<YYYYMMDD>.pmtiles
SRC=https://build.protomaps.com/<YYYYMMDD>.pmtiles

# 3. extract theo bbox + maxzoom từ bảng trên, ví dụ:
./pmtiles extract $SRC da-lat.pmtiles --bbox=108.3911,11.859,108.5806,12.0001 --maxzoom=14  # flagship → public/tiles/
./pmtiles extract $SRC sa-pa.pmtiles  --bbox=103.7648,22.2367,103.9348,22.3752 --maxzoom=14  # R2 slug

# 4. R2 slug: upload key tiles/<slug>.pmtiles vào bbvn-prod (STORAGE_* trong .env.r2.local).
#    Flagship: commit thẳng vào public/tiles/.
```

Host phải serve HTTP range (`Accept-Ranges: bytes`) — Vercel static + R2 proxy route đều đảm bảo.
