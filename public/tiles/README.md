# Map tiles (PMTiles, self-hosted)

Per-city vector basemap extracts served **same-origin** from `/tiles/<slug>.pmtiles`.
Rendered by `protomaps-leaflet` (Canvas 2D) in `trip-planner/components/PlannerMap.tsx`.

**Why self-host:** keeps CSP at `connect-src 'self'` (range requests are same-origin), no API key,
no vendor lock, no user IP leaving origin (PDPL). Data © OpenStreetMap (ODbL), basemap © Protomaps.

## Files
| slug | bbox (minLon,minLat,maxLon,maxLat) | ~size |
|------|-----------------------------------|-------|
| da-lat    | 108.36,11.85,108.52,12.02 | 1.3 MB |
| nha-trang | 109.10,12.15,109.25,12.35 | 1.4 MB |
| da-nang   | 107.95,15.85,108.35,16.15 | 3.7 MB |

## Re-cut (when tiles go stale — roads/POIs drift; a few times a year is plenty)
Needs the `pmtiles` CLI (go-pmtiles). Source = Protomaps daily planet build.

```bash
# 1. get CLI once (Windows x86_64 example)
curl -sL -o pmt.zip https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_<ver>_Windows_x86_64.zip
unzip pmt.zip pmtiles.exe

# 2. pick a build date that exists (HTTP 200)
#    https://build.protomaps.com/<YYYYMMDD>.pmtiles

# 3. extract each city (maxzoom 14 = street level, enough for pins)
SRC=https://build.protomaps.com/<YYYYMMDD>.pmtiles
./pmtiles extract $SRC public/tiles/da-lat.pmtiles    --bbox=108.36,11.85,108.52,12.02 --maxzoom=14
./pmtiles extract $SRC public/tiles/nha-trang.pmtiles --bbox=109.10,12.15,109.25,12.35 --maxzoom=14
./pmtiles extract $SRC public/tiles/da-nang.pmtiles   --bbox=107.95,15.85,108.35,16.15 --maxzoom=14
```

The host must serve HTTP range requests (`Accept-Ranges: bytes`) — Vercel static assets do by default.
