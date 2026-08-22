'use client';

/**
 * HotelsList — tab "Khách sạn" (Polish V3). Grid 2 cột khi pane rộng (@container ≥1100px),
 * badge lên header, hạng qua HOTEL_TIER_LABELS, khoảng cách tới điểm đầu Ngày 1 (haversine),
 * lý do gợi ý (editorial per-rule) chỉ card Gợi ý chính. Doctrine: KHÔNG ★/điểm/giá; 0 chữ không dấu.
 * min font 12px. Không fabricate — thiếu field → ẩn.
 */

import type { DtoHotel } from '@/trip-planner/lib/planner/itineraryDto';
import { hotelTierLabel, stripCitySuffix } from '@/trip-planner/lib/planner/labels';
import { fmtKm, fmtPhone } from '@/trip-planner/lib/planner/fmt';

const INK = '#1E2433', SOFT = '#6B7280', FAINT = '#9AA0AC';

// Lý do "Gợi ý chính" — rule chọn primary = gần trọng tâm tuyến (proximity to centroid).
const HOTEL_REASON_GAN_TRONG_TAM = 'Gần các điểm tham quan chính của lịch trình này.';

type FirstStop = { name: string; lat: number | null; lon: number | null } | null;

function havKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, tr = (d: number) => (d * Math.PI) / 180;
  const dLat = tr(bLat - aLat), dLon = tr(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(tr(aLat)) * Math.cos(tr(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function HotelCard({ h, primary, firstStop }: { h: DtoHotel; primary?: boolean; firstStop?: FirstStop }) {
  const tier = hotelTierLabel(h.phan_khuc);
  const phone = fmtPhone(h.phone);
  const dist =
    primary && firstStop && firstStop.lat != null && firstStop.lon != null && h.lat != null && h.lon != null
      ? fmtKm(havKm(h.lat, h.lon, firstStop.lat, firstStop.lon))
      : null;
  return (
    <div className="max-w-[720px] rounded-[10px] border border-border bg-cream px-3.5 py-3 text-[13px] @[1100px]:max-w-none">
      {/* header: tên + badge cùng hàng */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold" style={{ color: INK }}>🏨 {stripCitySuffix(h.name)}</span>
        {primary ? (
          <span className="shrink-0 text-[12px] font-semibold text-primary">Gợi ý chính</span>
        ) : (
          <span className="shrink-0 text-[12px]" style={{ color: FAINT }} title={`${h.nguon} nguồn dữ liệu`}>{h.nguon} nguồn</span>
        )}
      </div>
      {tier || h.so_phong ? (
        <div className="mt-0.5" style={{ color: SOFT }}>
          {tier}{tier && h.so_phong ? ' · ' : ''}{h.so_phong ? `${h.so_phong} phòng` : ''}
        </div>
      ) : null}
      {dist ? <div className="mt-0.5" style={{ color: SOFT }}>📍 cách {stripCitySuffix(firstStop!.name)} {dist}</div> : null}
      {h.address ? <div className="mt-0.5" style={{ color: SOFT }}>{h.address}</div> : null}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: SOFT }}>
        {phone ? (
          <a href={`tel:${h.phone}`} className="font-semibold text-primary hover:underline">📞 {phone}</a>
        ) : (
          <span>SĐT chưa xác minh — gọi trước</span>
        )}
        {h.map_url ? <a href={h.map_url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Bản đồ →</a> : null}
      </div>
      {primary ? (
        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
          <div className="text-[12px] font-bold uppercase tracking-wide text-primary">✨ Gợi ý biên tập</div>
          <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: SOFT }}>{HOTEL_REASON_GAN_TRONG_TAM}</p>
        </div>
      ) : null}
    </div>
  );
}

export function HotelsList({
  hotel, hotelAlts, firstStop, onAskAssistant,
}: {
  hotel: DtoHotel | null;
  hotelAlts: DtoHotel[];
  firstStop?: FirstStop;
  onAskAssistant?: (prompt: string) => void;
}) {
  if (!hotel && !hotelAlts.length) {
    return <p className="px-4 py-6 text-center text-[14px]" style={{ color: SOFT }}>Chưa có gợi ý khách sạn cho lịch trình này.</p>;
  }
  return (
    <div className="@container flex flex-col gap-3 p-3">
      <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SOFT }}>Khách sạn gợi ý</div>
      <div className="grid grid-cols-1 gap-3 @[1100px]:grid-cols-2">
        {hotel ? <HotelCard h={hotel} primary firstStop={firstStop} /> : null}
        {hotelAlts.map((h, i) => <HotelCard key={`alt-${i}`} h={h} />)}
      </div>
      {/* pháp lý phân hạng — 1 lần cho cả tab (không lặp mỗi card) */}
      <p className="text-[12px] italic" style={{ color: FAINT }}>
        Phân hạng theo quy ước dữ liệu, không phải xếp hạng sao chính thức.
      </p>
      {/* khối kết danh sách */}
      <div className="mt-1 border-t border-border pt-3">
        <p className="text-[13px]" style={{ color: SOFT }}>Đã hết gợi ý khách sạn cho khu vực này.</p>
        {onAskAssistant ? (
          <button type="button" onClick={() => onAskAssistant('Gợi ý thêm khách sạn ở khu vực này')}
            className="mt-1.5 rounded-full border border-primary/30 px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary/5">
            Hỏi trợ lý thêm khách sạn
          </button>
        ) : null}
      </div>
    </div>
  );
}
