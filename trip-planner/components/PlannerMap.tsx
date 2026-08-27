'use client';

/**
 * PlannerMap — bản đồ Leaflet + protomaps-leaflet (PMTiles tự-host, Canvas 2D, KHÔNG worker).
 * Nhận itinerary qua PROPS (không import engine) → né bẫy 092b. Tile same-origin
 * `/tiles/<slug>.pmtiles` → CSP giữ `connect-src 'self'`, không cần sửa CSP.
 *
 * Doctrine: pin đánh SỐ theo thứ tự (tín hiệu VQS), KHÔNG ★/điểm. Giá không hiển thị.
 * Trang nạp component này qua `dynamic(() => import(...), { ssr:false })` (Leaflet đụng window).
 *
 * Import default (leaflet) + named (leafletLayer) là client-safe; deep-import KIỂU DTO (type-only).
 */

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import L from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';
import { displayCategory, itemBadge, isAllDay } from '@/trip-planner/lib/planner/labels';
import { RouteBus } from '@/trip-planner/components/RouteBus';

type Props = {
  dto?: PlannerDto; // optional: chưa có → map center theo pendingSlug (pha building), chưa vẽ pin
  pendingSlug?: string; // điểm đến biết SỚM (trước dto) → center map + tile
  activeDay: number;
  hoveredOrder: number | null;
  selected: { day: number; order: number } | null;
  onPinClick: (day: number, order: number) => void;
  onCloseSheet: () => void;
};

// Slug có PMTiles thật trong public/tiles/. cities.ts quảng cáo 28 slug nhưng chỉ 3 tile ship →
// slug ngoài set này KHÔNG add tile layer (tránh request tile 404 → bản đồ xám); hiện nền kem + note.
// Sinh thêm tile cho 25 tỉnh còn lại là việc DATA riêng. (#528)
export const TILED_SLUGS = new Set(['da-lat', 'da-nang', 'nha-trang']);

// Tâm + zoom mặc định cho slug có tile (center map pha building TRƯỚC khi có dto item coords).
const CITY_CENTER: Record<string, [number, number, number]> = {
  'da-lat': [11.94, 108.44, 13],
  'da-nang': [16.06, 108.22, 13],
  'nha-trang': [12.24, 109.19, 13],
};

// Nền QUỐC GIA zoom-thấp fallback: 1 file /tiles/vietnam.pmtiles phủ CẢ nước cho slug không có tile
// street-zoom riêng → hết "bản đồ trắng" trên mọi tỉnh cùng lúc. Same-origin nên CSP connect-src 'self'
// đã cho (không đổi CSP). BẬT khi binary đã commit vào public/tiles/ (sinh: go-pmtiles extract
// --bbox=<VN> --maxzoom=9, xem public/tiles/README.md). enabled=false = hành vi cũ (nền kem + note) để
// KHÔNG request tile 404 → xám khi chưa có binary. (#528)
const COUNTRY_BASEMAP = { enabled: false, url: '/tiles/vietnam.pmtiles', maxDataZoom: 9 };

// Giờ hiện tại (phút từ 0h) theo Asia/Ho_Chi_Minh — KHÔNG theo đồng hồ máy khách (khách ở múi giờ
// khác sẽ đọc sai "đang mở"). (#528)
function vnNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mi = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + mi;
}

// Đang mở? parse "HH:MM-HH:MM" so với giờ VN. Xử lý khoảng qua đêm (18:00-02:00). null = thiếu dữ liệu.
function openNow(gio: string | null): boolean | null {
  if (!gio) return null;
  const m = gio.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const cur = vnNowMinutes();
  const s = +m[1] * 60 + +m[2];
  let e = +m[3] * 60 + +m[4];
  if (e >= 1440) e = 1439; // "24:00"
  // Khoảng qua đêm (s > e, vd 20:00-02:00): mở nếu cur >= s HOẶC cur <= e. (#528)
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
}

const PIN_CSS = `
.pm-pin{position:relative;width:30px;height:38px;transform-origin:50% 100%;transition:transform .15s;cursor:pointer}
.pm-pin svg{position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(30,36,51,.25))}
.pm-pin .pm-no{position:absolute;top:2px;left:0;width:30px;height:22px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:inherit}
.pm-pin path{fill:var(--primary,#F0561D)}
.pm-pin.pm-big{transform:scale(1.26)}
.pm-pin.pm-big path{fill:#C63D0B}
.pm-pin.pm-big svg{filter:drop-shadow(0 3px 6px rgba(30,36,51,.45))}
.pm-pin.pm-pulse::after{content:"";position:absolute;left:50%;top:12px;width:28px;height:28px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid var(--primary,#F0561D);pointer-events:none;animation:pmPulse .6s ease-out}
@keyframes pmPulse{0%{opacity:.55;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.9)}}
@media (prefers-reduced-motion: reduce){.pm-pin.pm-pulse::after{animation:none;opacity:0}}
.pm-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted-foreground,#6B7280);pointer-events:none}
`;

// Tuyến CONG (bézier bậc 2) giữa các điểm liên tiếp — tránh chồng chéo thị giác của polyline thẳng.
// Điểm điều khiển = trung điểm lệch vuông góc ~14% chiều dài đoạn (không mạng, CSP sạch).
function curvedLatLngs(pts: [number, number][]): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [pts[0]];
  const N = 14;
  for (let i = 0; i < pts.length - 1; i++) {
    const [aLat, aLon] = pts[i], [bLat, bLon] = pts[i + 1];
    const mLat = (aLat + bLat) / 2, mLon = (aLon + bLon) / 2;
    const dLat = bLat - aLat, dLon = bLon - aLon;
    const cLat = mLat - dLon * 0.14, cLon = mLon + dLat * 0.14; // lệch vuông góc
    for (let t = 1; t <= N; t++) {
      const u = t / N, k = 1 - u;
      out.push([k * k * aLat + 2 * k * u * cLat + u * u * bLat, k * k * aLon + 2 * k * u * cLon + u * u * bLon]);
    }
  }
  return out;
}

// Pin ngày active = primary (số = tín hiệu thứ tự). Nhấn mạnh pin hover/selected qua class .pm-big
// (đậm hơn + scale + shadow + z-index) — KHÔNG làm mờ pin khác kẻo loãng tuyến.
function pinHtml(order: number): string {
  return `<div class="pm-pin" data-order="${order}">
    <svg viewBox="0 0 30 38"><path d="M15 37 C4 22 1 15 1 12 A14 14 0 0 1 29 12 C29 15 26 22 15 37 Z" stroke="#fff" stroke-width="2"/></svg>
    <span class="pm-no">${order}</span></div>`;
}

export default function PlannerMap({ dto, pendingSlug, activeDay, hoveredOrder, selected, onPinClick, onCloseSheet }: Props) {
  const t = useTranslations('planner');
  const slug = dto?.slug ?? pendingSlug; // slug hiệu lực: dto (reveal) hoặc pendingSlug (building)
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<{ layer: L.Layer; slug: string } | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  // Keep the latest onPinClick in a ref so the pin/route effect doesn't depend on it — the parent
  // recreates the callback each render, and having it in the deps made the effect clear+rebuild the
  // markers and refit bounds on every hover, re-panning the map. Synced in an effect (not during
  // render); marker click handlers read .current at click time, always the latest. (#529)
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  // init map một lần
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    // maxZoom 16: cho overzoom ~2 nấc trên trần tile (z14) vẫn đọc được; minZoom 10: tile chỉ phủ
    // bbox 1 thành phố, zoom xa hơn ra ngoài vùng dữ liệu cũng xám → chặn scroll-zoom trong vùng có tile.
    const c = (slug && CITY_CENTER[slug]) || [11.94, 108.44, 13]; // center theo điểm đến (building) hoặc mặc định
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true, maxZoom: 16, minZoom: 10 }).setView([c[0], c[1]], c[2]);
    map.attributionControl.setPrefix('');
    L.control.zoom({ position: 'topright' }).addTo(map); // P0-6: né day-tabs (top-left)
    mapRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);
    // Reset TẤT CẢ ref khi unmount — StrictMode (dev) mount 2 lần; nếu baseRef còn giữ layer của
    // map cũ, effect base-layer sẽ early-return và map mới thiếu basemap.
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      baseRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // box đổi kích thước (kéo lề dưới resize map) → Leaflet chỉ tự invalidate khi window resize,
  // nên quan sát box và invalidateSize thủ công. Dùng pan mặc định (_rawPanBy) để neo lại tile
  // theo kích thước mới — pan:false sẽ để tile ở pixel-origin cũ → rơi ra ngoài box đã co → xám.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        // invalidateSize (_rawPanBy) ghi đè transform _mapPane, core Leaflet KHÔNG guard _animatingZoom;
        // nếu box resize trùng cửa sổ zoom-anim ~250ms → desync tile pane → xám. Hoãn tới zoomend.
        if ((map as { _animatingZoom?: boolean })._animatingZoom) { map.once('zoomend', () => map.invalidateSize()); return; }
        map.invalidateSize();
      });
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // đổi tile theo slug
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !slug) return;
    if (baseRef.current?.slug === slug) return;
    if (baseRef.current) { map.removeLayer(baseRef.current.layer); baseRef.current = null; }
    // Tile riêng (street-zoom) cho slug curated; else nền quốc gia zoom-thấp (nếu bật); else bỏ layer
    // (nền kem + note) — KHÔNG request tile 404 → xám. (#528)
    const tiled = TILED_SLUGS.has(slug);
    if (!tiled && !COUNTRY_BASEMAP.enabled) return;
    const layer = leafletLayer({
      url: tiled ? `/tiles/${slug}.pmtiles` : COUNTRY_BASEMAP.url,
      flavor: 'light',
      maxDataZoom: tiled ? 14 : COUNTRY_BASEMAP.maxDataZoom, // trần thật PMTiles; overzoom từ mức này lên
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> · © <a href="https://protomaps.com">Protomaps</a>',
    }) as unknown as L.Layer;
    layer.addTo(map);
    baseRef.current = { layer, slug };
  }, [slug]);

  // vẽ pin + route cho ngày active; fit-bounds
  useEffect(() => {
    const map = mapRef.current, overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();
    markersRef.current.clear();
    if (!dto) return; // pha building: chưa có kế hoạch → không vẽ pin/route

    const day = dto.days.find((d) => d.day === activeDay) ?? dto.days[0];
    if (!day) return;
    const pts: [number, number][] = [];

    day.items.forEach((it) => {
      if (it.lat == null || it.lon == null) return;
      const ll: [number, number] = [it.lat, it.lon];
      pts.push(ll);
      const icon = L.divIcon({ html: pinHtml(it.order), className: '', iconSize: [30, 38], iconAnchor: [15, 38] });
      const mk = L.marker(ll, { icon, title: it.name }).addTo(overlay);
      mk.on('click', () => onPinClickRef.current(day.day, it.order));
      markersRef.current.set(it.order, mk);
    });

    if (pts.length >= 2) {
      L.polyline(curvedLatLngs(pts), { color: '#F0561D', weight: 3.5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(overlay);
    }
    if (pts.length) {
      // đổi ngày (scrollspy/chip/pin) → fit về bound ngày active, animate 300ms (AC P6)
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { padding: [30, 30], maxZoom: 14, animate: true, duration: 0.3 });
    }
  }, [dto, activeDay]);

  // nhấn mạnh pin khi hover row bên card / được chọn: pm-big + z-index; pin đang focus nháy ring 0.6s.
  useEffect(() => {
    const focus = hoveredOrder ?? selected?.order ?? null;
    markersRef.current.forEach((mk, order) => {
      const big = order === hoveredOrder || order === (selected?.order ?? -1);
      const el = mk.getElement()?.querySelector('.pm-pin') as HTMLElement | null | undefined;
      if (el) {
        el.classList.toggle('pm-big', big);
        if (order === focus) {
          el.classList.remove('pm-pulse');
          el.getBoundingClientRect(); // ép reflow → animation chạy lại mỗi lần focus đổi
          el.classList.add('pm-pulse');
        } else {
          el.classList.remove('pm-pulse');
        }
      }
      mk.setZIndexOffset(big ? 1000 : 0);
    });
  }, [hoveredOrder, selected]);

  // P0-6: bottom-sheet phủ attribution → đẩy attribution lên trên sheet khi mở (OSM yêu cầu luôn thấy).
  useEffect(() => {
    const c = mapRef.current?.attributionControl?.getContainer();
    if (c) c.style.marginBottom = selected ? '216px' : '';
  }, [selected]);

  const sel = dto && selected ? dto.days.find((d) => d.day === selected.day)?.items.find((i) => i.order === selected.order) ?? null : null;
  const on = sel ? openNow(sel.gio_mo) : null;

  return (
    <div className="relative h-full w-full">
      <style>{PIN_CSS}</style>
      <div ref={boxRef} className="h-full w-full" style={{ background: 'var(--bg-cream, #FBF2E7)' }} />

      {/* Pha BUILDING (chưa dto): overlay kem bán trong suốt + bus signature; reveal → fade opacity→0,
          GIỮ NGUYÊN map instance (pin/route thêm vào khi dto về). */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${dto ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: 'rgba(251,242,231,0.5)' }} aria-hidden>
        {!dto ? <RouteBus /> : null}
      </div>

      {/* Không có tile riêng LẪN nền quốc gia → note thay vì để nền xám; pin vẫn hiện. (#528) */}
      {!TILED_SLUGS.has(slug ?? '') && !COUNTRY_BASEMAP.enabled ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[400] rounded-lg bg-white/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm">
          {t('map.noBasemap')}
        </div>
      ) : null}

      {/* Day-tabs ĐÃ chuyển sang <DayTabBar> chung (bắc cầu map↔card, right-split) */}

      {/* Bottom sheet chi tiết địa điểm (mock: card nổi; KHÔNG giá, KHÔNG ★; ẩn nút Đổi/Xóa) */}
      {sel ? (
        <div className="absolute inset-x-3 bottom-3 z-[500] overflow-hidden rounded-2xl border border-[#F0EAE2] bg-white shadow-lg">
          <button
            type="button"
            onClick={onCloseSheet}
            aria-label={t('map.close')}
            className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-white/90 text-foreground shadow-sm"
          >×</button>
          <div className="flex gap-3 p-3">
            {/* Thumbnail placeholder (chưa có ảnh KB) — gradient + emoji, tỉ lệ ~6:5 như mock */}
            <div className="hidden aspect-[6/5] w-32 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-2xl opacity-50 sm:grid" aria-hidden>🏞️</div>
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{sel.order}</span>
                <h4 className="truncate text-[15px] font-semibold text-foreground">{sel.name}</h4>
                {on === true ? (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(46,158,107,.14)', color: '#1F7A45' }}>{t('map.open')}</span>
                ) : on === false ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{t('map.closed')}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{t(`map.buoi.${sel.buoi}`)} · {displayCategory(sel)}</span>
                {!sel.goi_truoc && sel.gio_mo ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: '#1F7A45' }}>{t('map.verified')}</span>
                ) : (
                  <span className="text-muted-foreground">{itemBadge(sel).label}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                {sel.gio_mo ? <span className="tabular-nums">🕐 {isAllDay(sel.gio_mo) ? t('itinerary.allDay') : sel.gio_mo}</span> : null}
                {sel.leg_from_prev ? <span className="tabular-nums">🚗 {t('map.legFromPrev', { km: sel.leg_from_prev.km, minutes: sel.leg_from_prev.minutes })}</span> : null}
                <span className="tabular-nums">{t('map.source', { source: sel.nguon })}</span>
              </div>
              {sel.map_url ? (
                <a href={sel.map_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[13px] font-semibold text-primary hover:underline">
                  {t('map.viewOnGoogleMaps')}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
