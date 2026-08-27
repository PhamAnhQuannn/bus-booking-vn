'use client';

/**
 * RestaurantsList — tab "Ăn uống" (Polish V3). Grid 2 cột khi pane rộng, badge header, chip giờ
 * 3-trạng-thái, khối kết + chip hỏi trợ lý. Doctrine: KHÔNG ★/điểm/giá; 0 chữ không dấu; min 12px.
 * Data hiện chỉ category enum "eat_and_drink" (1 nhóm) và KHÔNG có field `suggestion` → dòng món ẩn.
 */

import type { DtoRestaurant } from '@/trip-planner/lib/planner/itineraryDto';
import { displayCategory, stripCitySuffix, isAllDay } from '@/trip-planner/lib/planner/labels';

const INK = '#1E2433', SOFT = '#6B7280', FAINT = '#9AA0AC';

function GioChip({ r }: { r: DtoRestaurant }) {
  if (!r.goi_truoc && r.gio_mo) {
    return <span className="rounded-full bg-success px-2 py-0.5 text-[12px] font-bold text-success-foreground">✓ Mở {isAllDay(r.gio_mo) ? 'cả ngày' : r.gio_mo}</span>;
  }
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold" style={{ color: SOFT }}>Giờ: gọi trước để hỏi</span>;
}

function RestaurantCard({ r }: { r: DtoRestaurant }) {
  return (
    <div className="max-w-[720px] rounded-[10px] border border-border bg-cream px-3.5 py-3 text-[13px] @[1100px]:max-w-none">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[15px] font-semibold" style={{ color: INK }}>
          🍜 {stripCitySuffix(r.name)}
          <span className="text-[13px] font-normal" style={{ color: SOFT }}> · {displayCategory({ category: r.category, name: r.name, role: 'an-trua', gio_mo: r.gio_mo, goi_truoc: r.goi_truoc })}</span>
        </span>
        <span className="shrink-0 text-[12px]" style={{ color: FAINT }} title={`${r.nguon} nguồn dữ liệu`}>{r.nguon} nguồn</span>
      </div>
      <div className="mt-1"><GioChip r={r} /></div>
      {r.address ? <div className="mt-1" style={{ color: SOFT }}>{r.address}</div> : null}
      {r.map_url ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: SOFT }}>
          <a href={r.map_url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Bản đồ →</a>
        </div>
      ) : null}
    </div>
  );
}

export function RestaurantsList({
  restaurants, onAskAssistant,
}: {
  restaurants: DtoRestaurant[];
  onAskAssistant?: (prompt: string) => void;
}) {
  if (!restaurants.length) {
    return <p className="px-4 py-6 text-center text-[14px]" style={{ color: SOFT }}>Chưa có gợi ý quán ăn cho lịch trình này.</p>;
  }
  return (
    <div className="@container flex flex-col gap-3 p-3">
      <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SOFT }}>
        Gợi ý quán ăn · {restaurants.length} nơi
      </div>
      <div className="grid grid-cols-1 gap-3 @[1100px]:grid-cols-2">
        {restaurants.map((r, i) => <RestaurantCard key={`res-${i}`} r={r} />)}
      </div>
      <div className="mt-1 border-t border-border pt-3">
        <p className="text-[13px]" style={{ color: SOFT }}>Đã hết gợi ý quán ăn cho khu vực này.</p>
        {onAskAssistant ? (
          <button type="button" onClick={() => onAskAssistant('Gợi ý thêm quán ăn ở khu vực này')}
            className="mt-1.5 rounded-full border border-primary/30 px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary/5">
            Hỏi trợ lý thêm quán
          </button>
        ) : null}
      </div>
    </div>
  );
}
