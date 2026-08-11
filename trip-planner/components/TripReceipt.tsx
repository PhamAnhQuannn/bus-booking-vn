'use client';

/**
 * TripReceipt (V5) — artifact card THẬT (không còn cursor:auto). Trong stream chat, link tới lịch
 * trình tương tác ở pane phải. Click → focus artifact (desktop: nháy ring + cuộn card; mobile: overlay).
 * Day-chips bấm được → đổi ngày bên phải. Cao ~96 (thêm mass cho chat, cân bằng density).
 */

import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';
import { cityName } from '@/trip-planner/lib/planner/cities';

type Props = {
  dto: PlannerDto;
  onActivate: () => void;
  onSelectDay: (day: number) => void;
};

export function TripReceipt({ dto, onActivate, onSelectDay }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
      className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-primary/5 px-3.5 py-3 transition-all hover:-translate-y-px hover:border-primary/50"
    >
      <span className="text-xl" aria-hidden="true">🗺️</span>
      <div className="min-w-0 flex-1">
        <b className="text-[15px] font-semibold">Lịch trình {cityName(dto.slug)} · {dto.tripDays} ngày {dto.tripDays - 1} đêm</b>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {dto.days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelectDay(d.day); onActivate(); }}
              className="rounded-full border border-primary/40 bg-background px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/10"
            >
              N{d.day}
            </button>
          ))}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="hidden lg:inline">Xem chi tiết + bản đồ ở bên phải</span>
          <span className="lg:hidden">Nhấn để xem lịch trình + bản đồ</span>
        </div>
      </div>
      <span className="shrink-0 text-lg text-primary" aria-hidden="true">→</span>
    </div>
  );
}
