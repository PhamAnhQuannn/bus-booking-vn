'use client';

/**
 * PlannerStepper — "Thông tin chuyến đi" (mock active). 3 bước: Điểm đến · Ngày đi · Nhóm.
 * Đọc trạng thái slot → chấm filled (cam) khi đã điền, else vòng viền xám. Đường nối cam khi bước xong.
 * Tỉ lệ đo mock: 4 chấm ~đều 21.7%W_chat, chấm ~12px. Màu: fill primary, text đen #000, muted.
 */

import type { Slots } from '@/trip-planner/lib/planner/slots';

type Props = { slots: Slots };

export function PlannerStepper({ slots }: Props) {
  const persons = (slots.adults ?? 0) + (slots.children ?? 0) + (slots.elders ?? 0);
  const steps = [
    { label: 'Điểm đến', done: !!slots.dia_diem },
    { label: 'Ngày đi', done: !!slots.days },
    { label: 'Nhóm', done: !!slots.nhom || persons > 0 },
  ];

  return (
    <div className="px-1 pb-1">
      <p className="mb-2.5 text-xs font-semibold text-[#615E5D]">Thông tin chuyến đi</p>
      <div className="flex items-center">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              {/* chấm */}
              <span
                className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
                  s.done ? 'bg-primary' : 'border-2 border-[#E7E0D7] bg-background'
                }`}
              >
                {s.done ? <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" /> : null}
              </span>
              {/* đường nối (trừ bước cuối) */}
              {i < steps.length - 1 ? (
                <span className={`h-[2px] flex-1 ${steps[i + 1].done || s.done ? 'bg-primary/60' : 'bg-[#F0EAE2]'}`} />
              ) : null}
            </div>
            <span className={`mt-1.5 whitespace-nowrap text-[11px] ${s.done ? 'font-semibold text-foreground' : 'text-[#615E5D]'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
