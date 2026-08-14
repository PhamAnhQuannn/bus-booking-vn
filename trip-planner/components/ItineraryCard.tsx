'use client';

/**
 * ItineraryCard (V5 macro-composition) — timeline ledger, không phải spreadsheet.
 * Doctrine bất biến: KHÔNG ★/điểm, KHÔNG số giá (trừ "Miễn phí"); order-circle 24 = số pin.
 * V5: 3 tầng màu (ink/soft/faint), divider diet (6→2 hairline), timeline spine qua order-circle,
 * day-header band + accent ngày active. Font: name 15/22, day-header 13.5 uppercase.
 */

import type { PlannerDto, DtoItem } from '@/trip-planner/lib/planner/itineraryDto';
import { cityName } from '@/trip-planner/lib/planner/cities';
import { displayCategory, itemBadge, areaLabel, nights } from '@/trip-planner/lib/planner/labels';

type Props = {
  dto: PlannerDto;
  activeDay: number;
  selected: { day: number; order: number } | null;
  onHoverItem: (order: number | null) => void;
  onToggleDay: (day: number) => void;
  hrefPdf?: string; // link /lich-trinh?… để "Xuất PDF" + "Chia sẻ" (mock header actions)
};

const BUOI: Record<DtoItem['buoi'], string> = { sang: 'Sáng', trua: 'Trưa', chieu: 'Chiều', toi: 'Tối' };
const PACE: Record<string, string> = { relaxed: 'thư giãn', moderate: 'vừa phải', packed: 'dày' };
const INK = '#1E2433', SOFT = '#6B7280', FAINT = '#9AA0AC';

// spine + day-band CSS (scoped v5-*). Spine chạy qua tâm order-circle (left 24 = px-3 + nửa circle).
const CARD_CSS = `
.v5-daybody{position:relative}
.v5-daybody::before{content:"";position:absolute;left:24px;top:16px;bottom:16px;width:2px;background:var(--primary-tint,#FDE4D6);border-radius:2px}
.v5-band{background:#FFF9F2}
.v5-band.v5-active{box-shadow:inset 3px 0 0 var(--primary,#F0561D)}
`;

function Badge({ it }: { it: DtoItem }) {
  const b = itemBadge(it);
  if (b.tone === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: 'rgba(46,158,107,.14)', color: '#157347' }}>
        ✓ Mở <span className="tabular-nums">{b.hours}</span>
      </span>
    );
  }
  // Thiếu giờ xác minh nhưng có place_id -> link xem giờ LIVE trên Google (ToS: không lưu giờ, chỉ link)
  if (it.role === 'diem-den' && it.google_place_id) {
    return (
      <a
        href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(it.google_place_id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold hover:bg-primary/15"
        style={{ color: 'var(--primary,#F0561D)' }}
      >
        Giờ mở trên Google ↗
      </a>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold" style={{ color: SOFT }}
      title={b.label === 'Nên gọi trước' ? 'Chưa có giờ mở xác minh — vui lòng gọi trước' : undefined}>
      {b.label}
    </span>
  );
}

function Row({ it, day, active, onHoverItem, hotelKm }: { it: DtoItem; day: number; active: boolean; onHoverItem: Props['onHoverItem']; hotelKm?: number | null }) {
  return (
    <>
      {it.leg_from_prev ? (
        // travel-leg: tầng FAINT (nhạt hơn metadata), nằm trên spine
        <div className="py-1 pl-9 text-xs font-semibold" style={{ color: FAINT }}>
          🚗 {it.leg_from_prev.minutes} phút · <span className="tabular-nums">{it.leg_from_prev.km}km</span>
        </div>
      ) : null}
      <div
        id={`row-${day}-${it.order}`}
        onMouseEnter={() => onHoverItem(it.order)}
        onMouseLeave={() => onHoverItem(null)}
        className={`flex gap-3 rounded-xl py-1.5 transition-colors ${active ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
      >
        <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          style={{ position: 'relative', zIndex: 1, boxShadow: active ? '0 0 0 1px #fff, 0 0 0 3px var(--primary,#F0561D)' : undefined }}>
          {it.order}
        </span>
        <div className="min-w-0 flex-1">
          <div>
            <span className="mr-1.5 text-xs font-semibold" style={{ color: SOFT }}>{BUOI[it.buoi]}</span>
            {/* place name = tầng INK, 15/22 semibold (backbone) */}
            <span className="text-[15px] font-semibold leading-snug" style={{ color: INK }}>{it.name}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: SOFT }}>
            <span>{displayCategory(it)}</span>
            <Badge it={it} />
            {hotelKm != null ? <span className="whitespace-nowrap">📍 cách KS ~<span className="tabular-nums">{hotelKm}</span>km</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function havKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, tr = (d: number) => (d * Math.PI) / 180;
  const dLat = tr(bLat - aLat), dLon = tr(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(tr(aLat)) * Math.cos(tr(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Tạm ẩn Lưu chuyến đi / Xuất PDF / Chia sẻ — chưa hoàn thiện, phát triển sau. Bật lại: enabled → true.
// (Member-access thay vì literal `false` để không dính eslint no-constant-condition ở JSX.)
const HEADER_ACTIONS = { enabled: false };

export function ItineraryCard({ dto, activeDay, selected, onHoverItem, onToggleDay, hrefPdf }: Props) {
  // Lưu chuyến đi (localStorage) + Chia sẻ (navigator.share/clipboard) — mock header actions.
  function saveTrip() {
    try {
      const arr = JSON.parse(localStorage.getItem('bbvn_saved_trips') || '[]');
      const entry = { slug: dto.slug, tripDays: dto.tripDays, href: hrefPdf ?? '', savedAt: Date.now() };
      const next = [entry, ...(Array.isArray(arr) ? arr : []).filter((x: { slug?: string; tripDays?: number }) => !(x.slug === dto.slug && x.tripDays === dto.tripDays))].slice(0, 20);
      localStorage.setItem('bbvn_saved_trips', JSON.stringify(next));
      alert('Đã lưu chuyến đi vào thiết bị này.');
    } catch { /* quota */ }
  }
  async function shareTrip() {
    const url = hrefPdf ? new URL(hrefPdf, location.origin).href : location.href;
    const title = `Lịch trình ${cityName(dto.slug)} ${dto.tripDays} ngày`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); alert('Đã sao chép liên kết chia sẻ.'); }
    } catch { /* user huỷ / không hỗ trợ */ }
  }

  let verified = 0, total = 0;
  dto.days.forEach((d) => d.items.forEach((i) => { total++; if (!i.goi_truoc && i.gio_mo) verified++; }));

  const firstStop = dto.days[0]?.items.find((i) => i.role === 'diem-den');
  let hotelKm: number | null = null;
  if (dto.hotel?.lat != null && dto.hotel?.lon != null && firstStop?.lat != null && firstStop?.lon != null) {
    hotelKm = Math.round(havKm(dto.hotel.lat, dto.hotel.lon, firstStop.lat, firstStop.lon) * 10) / 10;
  }

  return (
    <div className="@container w-full overflow-hidden border border-border bg-white">
      <style>{CARD_CSS}</style>

      {/* TITLE block — hairline #1 dưới đây */}
      <div className="border-b border-border px-4 pb-3 pt-4">
        <h3 className="text-base font-semibold" style={{ color: INK }}>🏔 {cityName(dto.slug)} · {dto.tripDays} ngày {nights(dto.tripDays)} đêm</h3>
        <p className="mt-1 text-[13px]" style={{ color: SOFT }}>
          {dto.party.adults} người lớn
          {dto.party.children ? ` · ${dto.party.children} trẻ nhỏ` : ''}
          {dto.party.elders ? ` · ${dto.party.elders} người lớn tuổi` : ''}
          {' · '}Nhịp độ: {PACE[dto.pace] ?? dto.pace} · Dữ liệu cập nhật {dto.generated_from}
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold" style={{ color: SOFT }}>
          <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
          = thứ tự trợ lý đề xuất (không phải đánh giá sao)
        </div>
        {/* Header actions (mock): Lưu chuyến đi · Xuất PDF · Chia sẻ — ẨN TẠM (phát triển sau). */}
        {HEADER_ACTIONS.enabled ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={saveTrip}
              className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
              💾 Lưu chuyến đi
            </button>
            {hrefPdf ? (
              <a href={hrefPdf} className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
                📄 Xuất PDF
              </a>
            ) : null}
            <button type="button" onClick={shareTrip}
              className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
              🔗 Chia sẻ
            </button>
          </div>
        ) : null}
      </div>

      {/* DAYS — không divider giữa ngày; band + spine + whitespace 16 */}
      <div className="space-y-4 p-3">
        {dto.days.map((d) => {
          const open = d.day === activeDay;
          const stops = d.items.filter((i) => i.role === 'diem-den').length;
          const area = areaLabel(d.region_id);
          return (
            <div key={d.day}>
              <button
                type="button"
                onClick={() => onToggleDay(d.day)}
                className={`v5-band ${open ? 'v5-active' : ''} flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left`}
                style={{ letterSpacing: '0.4px' }}
              >
                <span className="text-[13.5px] font-[650] uppercase" style={{ color: INK, fontWeight: 650 }}>Ngày {d.day}</span>
                <span className="ml-auto text-xs font-semibold normal-case" style={{ color: SOFT, letterSpacing: 0 }}>
                  {area ? `khu ${area} · ` : ''}{stops} điểm
                </span>
              </button>
              {open ? (
                <div className="v5-daybody mt-2 px-3">
                  {d.items.map((it) => {
                    // item ĐẦU ngày (không có leg tới mục trước) → hiện khoảng cách từ khách sạn (mock: "cách KS ~Xkm")
                    const hk =
                      !it.leg_from_prev && dto.hotel?.lat != null && dto.hotel?.lon != null && it.lat != null && it.lon != null
                        ? Math.round(havKm(dto.hotel.lat, dto.hotel.lon, it.lat, it.lon) * 10) / 10
                        : null;
                    return (
                      <Row key={it.order} it={it} day={d.day} active={selected?.day === d.day && selected?.order === it.order} onHoverItem={onHoverItem} hotelKm={hk} />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* GỢI Ý QUÁN ĂN — list riêng, không slot vào timeline (doctrine: không ★/điểm/giá) */}
        {dto.restaurants.length ? (
          <div className="v5-band rounded-[10px] px-3.5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: SOFT }}>Gợi ý quán ăn</div>
            <div className="mt-1.5 flex flex-col gap-2">
              {dto.restaurants.map((r, i) => (
                <div key={`res-${i}`} className="text-xs">
                  <span className="text-sm font-semibold" style={{ color: INK }}>🍜 {r.name}</span>
                  {r.category ? <span style={{ color: SOFT }}> · {r.category}</span> : null}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: SOFT }}>
                    <span>giờ: {r.goi_truoc ? 'gọi trước' : r.gio_mo}</span>
                    {r.address ? <span>{r.address}</span> : null}
                    {r.phone ? <a href={`tel:${r.phone}`} className="font-semibold text-primary hover:underline">📞 {r.phone}</a> : null}
                    {r.map_url ? <a href={r.map_url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Bản đồ →</a> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* HOTEL + NOTES — gộp 1 block band, không line trong */}
        {(dto.hotel || dto.notes.length) ? (
          <div className="v5-band rounded-[10px] px-3.5 py-3">
            {dto.hotel ? (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: SOFT }}>Khách sạn gợi ý</div>
                <div className="text-sm font-semibold" style={{ color: INK }}>🏨 {dto.hotel.name}</div>
                {dto.hotel.note ? <div className="text-xs" style={{ color: SOFT }}>{dto.hotel.note}</div> : null}
                {hotelKm != null ? <div className="text-xs" style={{ color: SOFT }}>📍 cách điểm đầu khoảng {hotelKm} km</div> : null}
                {dto.hotel.address ? <div className="text-xs" style={{ color: SOFT }}>{dto.hotel.address}</div> : null}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {dto.hotel.phone ? (
                    <a href={`tel:${dto.hotel.phone}`} className="font-semibold text-primary hover:underline">📞 {dto.hotel.phone}</a>
                  ) : (
                    <span style={{ color: SOFT }}>SĐT chưa xác minh — gọi trước</span>
                  )}
                  {dto.hotel.map_url ? (
                    <a href={dto.hotel.map_url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Xem bản đồ →</a>
                  ) : null}
                </div>
              </>
            ) : null}
            {dto.hotelAlts?.length ? (
              <div className="mt-2.5">
                <div className="text-[11px] font-semibold" style={{ color: SOFT }}>Lựa chọn khác</div>
                <div className="mt-1 flex flex-col gap-1.5">
                  {dto.hotelAlts.map((h, i) => (
                    <div key={`hotalt-${i}`} className="text-xs">
                      <span className="text-sm font-semibold" style={{ color: INK }}>🏨 {h.name}</span>
                      {h.note ? <span style={{ color: SOFT }}> · {h.note}</span> : null}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: SOFT }}>
                        {h.address ? <span>{h.address}</span> : null}
                        {h.phone ? <a href={`tel:${h.phone}`} className="font-semibold text-primary hover:underline">📞 {h.phone}</a> : null}
                        {h.map_url ? <a href={h.map_url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Bản đồ →</a> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {dto.notes.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs" style={{ color: FAINT }}>
                {dto.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* FOOTER — hairline #2 trên đây */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-[13px]">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: 'rgba(46,158,107,.14)', color: '#157347' }}>
          ✓ {verified}/{total} điểm đã xác minh giờ
        </span>
        <span style={{ color: FAINT }}>Thứ tự = mức gợi ý; giá không hiển thị (chỉ thông tin, không đặt hộ).</span>
      </div>
    </div>
  );
}
