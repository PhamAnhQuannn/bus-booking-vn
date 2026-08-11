'use client';

/**
 * SuggestionCards — mode vibe-discovery: hiện điểm-đến CÓ TÊN (từ KB, không LLM bịa) khi khách hỏi
 * theo không khí ("chỗ nào lãng mạn?"). Mỗi card "Thêm vào lịch" → tích anchor; footer → lên lịch.
 * Tên/địa chỉ đến từ dữ liệu đã xác minh (server pickByVibe). Style theo TripReceipt.
 */

import type { DestinationSuggestion } from '@/trip-planner/lib/planner/types';

// Nhãn hiển thị cho mã vibe (VIBE_VOCAB). Chỉ để header đọc thân thiện.
const VIBE_LABEL: Record<string, string> = {
  'ngam-canh': 'ngắm cảnh',
  'tam-linh': 'tâm linh',
  'lich-su-van-hoa': 'lịch sử - văn hoá',
  'thien-nhien-mao-hiem': 'thiên nhiên - mạo hiểm',
  'mua-sam': 'mua sắm',
  'nong-nghiep-sinh-thai': 'nông nghiệp sinh thái',
  'bien-dao': 'biển đảo',
  'suoi-nuoc-nong': 'suối nước nóng',
  'song-ao-chup-hinh': 'sống ảo - chụp hình',
  'thu-gian-yen-tinh': 'thư giãn - yên tĩnh',
  'lang-man': 'lãng mạn',
};

type Props = {
  items: DestinationSuggestion[];
  vibe: string;
  onAdd: (id: string, name: string) => void;
  onPlan: () => void;
};

export function SuggestionCards({ items, vibe, onAdd, onPlan }: Props) {
  const label = VIBE_LABEL[vibe] ?? vibe;
  return (
    <div className="mt-2 rounded-2xl border border-border bg-primary/5 p-3">
      <b className="text-[13px] font-semibold">Gợi ý điểm {label}</b>
      {items.length ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{d.name}</div>
                {d.address ? <div className="truncate text-xs text-muted-foreground">{d.address}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => onAdd(d.id, d.name)}
                className="shrink-0 rounded-full border border-primary/40 bg-background px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10"
              >
                + Thêm vào lịch
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">Chưa có gợi ý riêng cho vibe này — để mình lên lịch chung nhé.</p>
      )}
      <button
        type="button"
        onClick={onPlan}
        className="mt-2.5 w-full rounded-xl bg-primary px-3 py-2 text-[13px] font-bold text-primary-foreground hover:opacity-90"
      >
        Lên lịch trình
      </button>
    </div>
  );
}
