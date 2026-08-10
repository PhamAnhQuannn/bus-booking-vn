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
import L from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlannerDto, DtoItem } from '@/trip-planner/lib/planner/itineraryDto';
import { displayCategory, itemBadge } from '@/trip-planner/lib/planner/labels';

type Props = {
  dto: PlannerDto;
  activeDay: number;
  hoveredOrder: number | null;
  selected: { day: number; order: number } | null;
  onPinClick: (day: number, order: number) => void;
  onCloseSheet: () => void;
};

const BUOI: Record<DtoItem['buoi'], string> = { sang: 'Sáng', trua: 'Trưa', chieu: 'Chiều', toi: 'Tối' };

// Đang mở? parse "HH:MM-HH:MM" so với giờ máy. null = không đủ dữ liệu.
function openNow(gio: string | null): boolean | null {
  if (!gio) return null;
  const m = gio.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = +m[1] * 60 + +m[2];
  let e = +m[3] * 60 + +m[4];
  if (e >= 1440) e = 1439; // "24:00"
  return cur >= s && cur <= e;
}

const PIN_CSS = `
.pm-pin{position:relative;width:30px;height:38px;transform-origin:50% 100%;transition:transform .15s;cursor:pointer}
.pm-pin svg{position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(30,36,51,.25))}
.pm-pin .pm-no{position:absolute;top:2px;left:0;width:30px;height:22px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:inherit}
.pm-pin path{fill:var(--primary,#F0561D)}
.pm-pin.pm-big{transform:scale(1.26)}
.pm-pin.pm-big path{fill:#C63D0B}
.pm-pin.pm-big svg{filter:drop-shadow(0 3px 6px rgba(30,36,51,.45))}
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

export default function PlannerMap({ dto, activeDay, hoveredOrder, selected, onPinClick, onCloseSheet }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<{ layer: L.Layer; slug: string } | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // init map một lần
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true }).setView([11.94, 108.44], 13);
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

  // đổi tile theo slug
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseRef.current?.slug === dto.slug) return;
    if (baseRef.current) map.removeLayer(baseRef.current.layer);
    const layer = leafletLayer({
      url: `/tiles/${dto.slug}.pmtiles`,
      flavor: 'light',
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> · © <a href="https://protomaps.com">Protomaps</a>',
    }) as unknown as L.Layer;
    layer.addTo(map);
    baseRef.current = { layer, slug: dto.slug };
  }, [dto.slug]);

  // vẽ pin + route cho ngày active; fit-bounds
  useEffect(() => {
    const map = mapRef.current, overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();
    markersRef.current.clear();

    const day = dto.days.find((d) => d.day === activeDay) ?? dto.days[0];
    if (!day) return;
    const pts: [number, number][] = [];

    day.items.forEach((it) => {
      if (it.lat == null || it.lon == null) return;
      const ll: [number, number] = [it.lat, it.lon];
      pts.push(ll);
      const icon = L.divIcon({ html: pinHtml(it.order), className: '', iconSize: [30, 38], iconAnchor: [15, 38] });
      const mk = L.marker(ll, { icon, title: it.name }).addTo(overlay);
      mk.on('click', () => onPinClick(day.day, it.order));
      markersRef.current.set(it.order, mk);
    });

    if (pts.length >= 2) {
      L.polyline(curvedLatLngs(pts), { color: '#F0561D', weight: 3.5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(overlay);
    }
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { padding: [30, 30], maxZoom: 15, animate: true });
    }
  }, [dto, activeDay, onPinClick]);

  // nhấn mạnh pin khi hover row bên card / được chọn: đổi class + đẩy z-index lên trên
  useEffect(() => {
    markersRef.current.forEach((mk, order) => {
      const big = order === hoveredOrder || order === (selected?.order ?? -1);
      const el = mk.getElement()?.querySelector('.pm-pin');
      if (el) el.classList.toggle('pm-big', big);
      mk.setZIndexOffset(big ? 1000 : 0);
    });
  }, [hoveredOrder, selected]);

  // P0-6: bottom-sheet phủ attribution → đẩy attribution lên trên sheet khi mở (OSM yêu cầu luôn thấy).
  useEffect(() => {
    const c = mapRef.current?.attributionControl?.getContainer();
    if (c) c.style.marginBottom = selected ? '216px' : '';
  }, [selected]);

  const sel = selected ? dto.days.find((d) => d.day === selected.day)?.items.find((i) => i.order === selected.order) ?? null : null;
  const on = sel ? openNow(sel.gio_mo) : null;

  return (
    <div className="relative h-full w-full">
      <style>{PIN_CSS}</style>
      <div ref={boxRef} className="h-full w-full" style={{ background: 'var(--bg-cream, #FBF2E7)' }} />

      {/* Day-tabs ĐÃ chuyển sang <DayTabBar> chung (bắc cầu map↔card, right-split) */}

      {/* Bottom sheet chi tiết địa điểm (KHÔNG giá, KHÔNG ★) */}
      {sel ? (
        <div className="absolute inset-x-3 bottom-3 z-[500] overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          <button
            type="button"
            onClick={onCloseSheet}
            aria-label="Đóng"
            className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-background/90 text-foreground"
          >×</button>
          <div className="flex h-14 items-center justify-center bg-primary/10 text-sm font-semibold text-primary-strong">
            {BUOI[sel.buoi]} · {displayCategory(sel)}
          </div>
          <div className="p-3.5">
            <h4 className="text-base font-semibold">{sel.name}</h4>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Giờ mở</div>
                {sel.gio_mo ? (
                  <span className="tabular-nums">
                    {sel.gio_mo}
                    {on === true ? <span className="ml-1 font-semibold" style={{ color: '#157347' }}>· Đang mở</span> : null}
                    {on === false ? <span className="ml-1 text-muted-foreground">· Đã đóng</span> : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{itemBadge(sel).label}</span>
                )}
              </div>
              {sel.leg_from_prev ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Từ điểm trước</div>
                  <span className="tabular-nums">{sel.leg_from_prev.km}km · {sel.leg_from_prev.minutes} phút</span>
                </div>
              ) : null}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nguồn</div>
                <span className="tabular-nums">{sel.nguon}</span>
              </div>
            </div>
            {sel.map_url ? (
              <a href={sel.map_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[13px] font-semibold text-primary hover:underline">
                Xem trên Google Maps →
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
