'use client';

/**
 * PlannerMapColumn — bản đồ ở ĐẦU cột trái (chỉ ≥1280 pha planning). Chat nằm DƯỚI (do page render).
 * Chiều cao map: mặc định 40% chiều cao cột (min 180px), kéo tay được (drag handle),
 * nút "thu" → launcher 44px (map ẩn, chat chiếm gần trọn cột).
 * `shrink` (focus input / đang stream) → co tạm về 180px (KHÔNG về launcher), thả ra khôi phục.
 * Mount đúng 1 instance PlannerMap (nhánh isWide loại trừ với pane <1280) → props y hệt pane cũ.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import PlannerMap from '@/trip-planner/components/PlannerMap';
import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';

type Props = {
  dto?: PlannerDto; // optional: pha building center theo pendingSlug, chưa có pin
  pendingSlug?: string;
  activeDay: number;
  hoveredOrder: number | null;
  selected: { day: number; order: number } | null;
  onPinClick: (day: number, order: number) => void;
  onCloseSheet: () => void;
  shrink?: boolean; // focus input / stream dài → co tạm về SHRINK_H
};

const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN_MAP = 180;
const SHRINK_H = 180;

export default function PlannerMapColumn({ dto, pendingSlug, activeDay, hoveredOrder, selected, onPinClick, onCloseSheet, shrink }: Props) {
  const t = useTranslations('planner');
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(280); // px map; ResizeObserver ép về 40% cột
  const [mapOff, setMapOff] = useState(false); // user bấm launcher → map ẩn hẳn
  const userHRef = useRef<number | null>(null); // chiều cao user kéo chốt (null = auto 40%)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // 40% chiều cao cột trái (đo parentElement). Giữ ý user nếu đã kéo, ép vào biên.
  useEffect(() => {
    const el = rootRef.current;
    const col = el?.parentElement;
    if (!el || !col) return;
    const ro = new ResizeObserver(() => {
      const H = col.clientHeight;
      const maxH = Math.max(MIN_MAP, H - 240); // chừa chat ≥ ~240
      const target = userHRef.current != null ? userHRef.current : 0.4 * H;
      setHeight(clamp(MIN_MAP, target, maxH));
    });
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  function onHandleDown(e: React.PointerEvent) {
    dragRef.current = { startY: e.clientY, startH: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent) {
    const d = dragRef.current, col = rootRef.current?.parentElement;
    if (!d || !col) return;
    const maxH = Math.max(MIN_MAP, col.clientHeight - 240);
    const h = clamp(MIN_MAP, d.startH + (e.clientY - d.startY), maxH);
    userHRef.current = h;
    setHeight(h);
  }
  function onHandleUp(e: React.PointerEvent) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const displayH = shrink ? Math.min(height, SHRINK_H) : height;

  if (mapOff) {
    return (
      <div ref={rootRef} className="shrink-0">
        <button
          type="button"
          onClick={() => setMapOff(false)}
          className="flex h-11 w-full shrink-0 items-center gap-2 rounded-xl border border-border bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          🗺 <span className="flex-1 text-left">{t('pane.openMapFullscreen')}</span> ›
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="shrink-0">
      <div className="relative overflow-hidden border border-border transition-[height] duration-200" style={{ height: displayH }}>
        <PlannerMap
          dto={dto}
          pendingSlug={pendingSlug}
          activeDay={activeDay}
          hoveredOrder={hoveredOrder}
          selected={selected}
          onPinClick={onPinClick}
          onCloseSheet={onCloseSheet}
        />
        <button
          type="button"
          onClick={() => setMapOff(true)}
          aria-label={t('pane.resizeMapAria')}
          className="absolute right-2 top-2 z-raised grid h-7 w-7 place-items-center rounded-full border border-border bg-white/90 text-xs font-bold shadow-sm hover:bg-white"
        >
          ▾
        </button>
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('pane.resizeMapAria')}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onLostPointerCapture={onHandleUp}
        className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-primary" />
      </div>
    </div>
  );
}
