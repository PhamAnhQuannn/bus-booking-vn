'use client';

/**
 * PlannerPane — pane phải right-split (SPEC v4): [DayTabBar] + [Map] + [ItineraryCard scroll],
 * với MAP ASPECT-LOCK 3 tier để hết 2 defect (slab dọc màn cao · card bẹp màn thấp).
 *
 * Đo chiều cao pane bằng ResizeObserver → tính tier + mapH:
 *  - TALL   H_i≥620: mapH = min(clamp(260, k·mapW, 440), H_i−320); H_i≥1400 → k=0.75 (else 0.68). Plan ≥280.
 *  - COMPACT 480≤H_i<620: mapH = clamp(200, 0.40·H_i, 260) (panorama). Plan ≥214.
 *  - SHORT  H_i<480: bỏ map inline → launcher-bar 44 mở overlay fullscreen (variant inline);
 *           overlay thì rơi về COMPACT (map panorama, không bẹp).
 *
 * Gộp Leaflet (PlannerMap) → page phải dynamic-import PlannerPane với { ssr:false }.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import PlannerMap from '@/trip-planner/components/PlannerMap';
import { DayTabBar } from '@/trip-planner/components/DayTabBar';
import { ItineraryCard } from '@/trip-planner/components/ItineraryCard';
import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';

type Props = {
  dto: PlannerDto;
  activeDay: number;
  hoveredOrder: number | null;
  selected: { day: number; order: number } | null;
  onPinClick: (day: number, order: number) => void;
  onCloseSheet: () => void;
  onSelectDay: (day: number) => void;
  onHoverItem: (order: number | null) => void;
  variant: 'inline' | 'overlay';
  onOpenFull: () => void;
  pulseKey?: number; // đổi giá trị → nháy ring (receipt click → "đây là artifact")
  hrefPdf?: string; // link Xuất PDF / Chia sẻ (mock header actions itinerary)
};

const PANE_CSS = `
@keyframes v5panePulse{0%{box-shadow:0 0 0 0 rgba(240,86,29,.55)}100%{box-shadow:0 0 0 4px rgba(240,86,29,0)}}
.v5-pane-pulse{animation:v5panePulse .6s ease-out}
`;

const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Biên kéo tay lề dưới bản đồ (px). Trần map = chiều cao container trừ pad/tabs/gap để plan luôn ≥ MIN_PLAN.
const MIN_MAP = 180;
const MIN_PLAN = 240;
const maxMapH = (el: HTMLElement) => Math.max(MIN_MAP, el.clientHeight - 24 /*pad*/ - 42 /*tabs*/ - 36 /*3 gap*/ - MIN_PLAN);

// mapH = 0 nghĩa SHORT-inline (dùng launcher thay map).
function computeMapH(H_i: number, mapW: number, variant: Props['variant']): number {
  if (H_i < 480) {
    if (variant === 'inline') return 0; // launcher
    return clamp(160, 0.42 * H_i, 240); // overlay short: panorama nhỏ, plan vẫn còn
  }
  if (H_i < 620) return clamp(200, 0.4 * H_i, 260); // COMPACT
  const k = H_i >= 1400 ? 0.75 : 0.68; // TALL
  let mapH = Math.min(clamp(260, k * mapW, 440), H_i - 320);
  const plan = H_i - 42 - 36 - mapH; // tabs ~42 + 3 gap 12 (thêm handle resize)
  if (plan < 280) mapH = Math.max(200, H_i - 42 - 36 - 280);
  return mapH;
}

export default function PlannerPane({ dto, activeDay, hoveredOrder, selected, onPinClick, onCloseSheet, onSelectDay, onHoverItem, variant, onOpenFull, pulseKey, hrefPdf }: Props) {
  const t = useTranslations('planner');
  const rootRef = useRef<HTMLDivElement>(null);
  const [mapH, setMapH] = useState(320);
  const userHRef = useRef<number | null>(null); // chiều cao map do user kéo chốt (null = auto computeMapH)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Nháy ring qua classList (KHÔNG setState-in-effect → né cascading-render lint).
  useEffect(() => {
    if (!pulseKey) return;
    const el = rootRef.current;
    if (!el) return;
    el.classList.add('v5-pane-pulse');
    const t = setTimeout(() => el.classList.remove('v5-pane-pulse'), 620);
    return () => clearTimeout(t);
  }, [pulseKey]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const H_i = el.clientHeight - 24; // trừ pad p-3 trên+dưới
      const mapW = el.clientWidth - 24; // trừ pad l/r
      const auto = computeMapH(H_i, mapW, variant);
      if (auto === 0) { setMapH(0); return; } // SHORT → launcher; GIỮ userHRef để khôi phục khi pane cao lại
      if (userHRef.current != null) { setMapH(clamp(MIN_MAP, userHRef.current, maxMapH(el))); return; } // giữ ý user, ép lại vào biên
      setMapH(Math.round(auto));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant]);

  const short = mapH === 0; // SHORT-inline → launcher

  // Kéo lề dưới bản đồ (pointer → chuột + cảm ứng): map cao lên → plan thu hẹp.
  function onHandleDown(e: React.PointerEvent) {
    dragRef.current = { startY: e.clientY, startH: mapH };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent) {
    const d = dragRef.current, el = rootRef.current;
    if (!d || !el) return;
    const h = clamp(MIN_MAP, d.startH + (e.clientY - d.startY), maxMapH(el));
    userHRef.current = h;
    setMapH(h);
  }
  function onHandleUp(e: React.PointerEvent) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden border border-border bg-white p-3 shadow-[0_2px_12px_rgba(30,36,51,0.06)]"
    >
      <style>{PANE_CSS}</style>
      <DayTabBar dto={dto} activeDay={activeDay} onSelect={onSelectDay} />

      {short ? (
        <button
          type="button"
          onClick={onOpenFull}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          🗺 <span className="flex-1 text-left">{t('pane.openMapFullscreen')}</span> ›
        </button>
      ) : (
        <div className="shrink-0 overflow-hidden border border-border" style={{ height: mapH }}>
          <PlannerMap
            dto={dto}
            activeDay={activeDay}
            hoveredOrder={hoveredOrder}
            selected={selected}
            onPinClick={onPinClick}
            onCloseSheet={onCloseSheet}
          />
        </div>
      )}

      {/* Thanh kéo lề dưới bản đồ → chỉnh chiều cao map (plan tự co). Chỉ khi có map inline (!short). */}
      {!short ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('pane.resizeMapAria')}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onLostPointerCapture={onHandleUp}
          className="group -my-1.5 flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ItineraryCard dto={dto} activeDay={activeDay} selected={selected} onHoverItem={onHoverItem} onToggleDay={onSelectDay} hrefPdf={hrefPdf} />
      </div>
    </div>
  );
}
