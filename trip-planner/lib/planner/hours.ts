/**
 * hours — giờ mở chi tiết theo ngày (client-safe, pure). Chỉ trả cấu trúc khi lịch KHÁC nhau
 * giữa các khung (vd T2–T6 khác T7,CN); đồng nhất cả tuần → null (1 dòng gio_mo là đủ).
 * Ngày = số ISO 1=T2 … 7=CN; format nhãn để render (i18n) ở component.
 */
import type { KbOpeningSlot } from './types';

export type SchedSlot = { d: number[]; open: string; close: string };

const DAY_NUM: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};

export function buildScheduleDetail(sched: KbOpeningSlot[] | undefined | null): SchedSlot[] | null {
  if (!sched || sched.length < 2) return null;
  const slots = sched.filter((s) => s.open && s.close);
  if (slots.length < 2) return null;
  const distinct = new Set(slots.map((s) => `${s.open}-${s.close}`));
  if (distinct.size < 2) return null; // đồng nhất → không cần chi tiết
  return slots.map((s) => ({
    d: (s.days ?? []).map((x) => DAY_NUM[String(x).toLowerCase()]).filter((n): n is number => !!n).sort((a, b) => a - b),
    open: s.open as string,
    close: s.close as string,
  }));
}

// Gom ngày liên tiếp thành khoảng: [1,2,3,4,5] → [[1,5]]; [1,2,6] → [[1,2],[6,6]].
export function compressDays(days: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else out.push([d, d]);
  }
  return out;
}
