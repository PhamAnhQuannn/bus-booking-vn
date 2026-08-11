'use client';

/**
 * DayTabBar (V5) — segmented control = navigation CHÍNH của itinerary, lái `activeDay` cho map+card.
 * Container pill #FFF3E8; tab active = solid primary + shadow; inactive hover = primary-tint.
 */

import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';

type Props = {
  dto: PlannerDto;
  activeDay: number;
  onSelect: (day: number) => void;
};

export function DayTabBar({ dto, activeDay, onSelect }: Props) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-[#F0EAE2] p-[3px] shadow-e1" style={{ background: '#FEFCF7' }}>
      {dto.days.map((d) => {
        const on = d.day === activeDay;
        return (
          <button
            key={d.day}
            type="button"
            onClick={() => onSelect(d.day)}
            aria-pressed={on}
            className={`flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-colors ${
              on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-primary/10'
            }`}
            style={on ? { boxShadow: '0 1px 4px rgba(240,86,29,.35)' } : undefined}
          >
            Ngày {d.day}
          </button>
        );
      })}
    </div>
  );
}
