'use client';

/**
 * ItineraryCard (V5 macro-composition) — timeline ledger, không phải spreadsheet.
 * Doctrine bất biến: KHÔNG ★/điểm, KHÔNG số giá (trừ "Miễn phí"); order-circle 24 = số pin.
 * V5: 3 tầng màu (ink/soft/faint), divider diet (6→2 hairline), timeline spine qua order-circle,
 * day-header band + accent ngày active. Font: name 15/22, day-header 13.5 uppercase.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlannerDto, DtoItem } from '@/trip-planner/lib/planner/itineraryDto';
import { cityName } from '@/trip-planner/lib/planner/cities';
import { displayCategory, itemBadge, areaLabel, vibeChip, stripCitySuffix, FACILITY_LABELS } from '@/trip-planner/lib/planner/labels';
import { cardProfile, type SectionKey } from '@/trip-planner/lib/planner/cardProfile';
import { fmtKm } from '@/trip-planner/lib/planner/fmt';

type Props = {
  dto: PlannerDto;
  activeDay: number;
  selected: { day: number; order: number } | null;
  onHoverItem: (order: number | null) => void;
  onToggleDay: (day: number) => void;
  hrefPdf?: string; // link /lich-trinh?… để "Xuất PDF" + "Chia sẻ" (mock header actions)
};

const INK = '#1E2433', SOFT = '#6B7280', FAINT = '#9AA0AC';

// spine + day-band CSS (scoped v5-*). Spine chạy qua tâm order-circle (left 24 = px-3 + nửa circle).
const CARD_CSS = `
.v5-daybody{position:relative}
.v5-daybody::before{content:"";position:absolute;left:24px;top:16px;bottom:16px;width:2px;background:var(--primary-tint,#FDE4D6);border-radius:2px}
.v5-band{background:#FFF9F2}
.v5-band.v5-active{box-shadow:inset 3px 0 0 var(--primary,#F0561D)}
`;

function Badge({ it }: { it: DtoItem }) {
  const t = useTranslations('planner');
  const b = itemBadge(it);
  if (b.tone === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">
        ✓ {t('itinerary.badgeOpen')} <span className="tabular-nums">{b.hours}</span>
        {/* provenance THẬT (source_ids.length) — KHÔNG phải citation [S] bịa */}
        {it.nguon ? <span className="font-semibold opacity-70">· {t('itinerary.sources', { count: it.nguon })}</span> : null}
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
        {t('itinerary.hoursOnGoogle')}
      </a>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold" style={{ color: SOFT }}
      title={b.label === 'Nên gọi trước' ? t('itinerary.callAheadTitle') : undefined}>
      {b.label}
    </span>
  );
}

function Row({ it, day, active, onHoverItem, hotelKm }: { it: DtoItem; day: number; active: boolean; onHoverItem: Props['onHoverItem']; hotelKm?: number | null }) {
  const [open, setOpen] = useState(false);
  const isDest = it.role === 'diem-den';
  const longMoTa = !!it.mo_ta && it.mo_ta.length > 150; // proxy: đủ dài để clamp 3 dòng → hiện "Xem thêm"
  const t = useTranslations('planner');
  return (
    <>
      {it.leg_from_prev ? (
        // travel-leg: tầng FAINT (nhạt hơn metadata), nằm trên spine — nối 2 card
        <div className="py-1 pl-9 text-xs font-semibold" style={{ color: FAINT }}>
          🚗 {t('itinerary.legMinutes', { minutes: Math.round(it.leg_from_prev.minutes) })} · <span className="tabular-nums">{fmtKm(it.leg_from_prev.km)?.replace('~', '')}</span>
        </div>
      ) : null}
      <div
        id={`row-${day}-${it.order}`}
        onMouseEnter={() => onHoverItem(it.order)}
        onMouseLeave={() => onHoverItem(null)}
        className="mb-3 flex gap-3"
      >
        <span className="mt-1 grid size-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          style={{ position: 'relative', zIndex: 1, boxShadow: active ? '0 0 0 1px #fff, 0 0 0 3px var(--primary,#F0561D)' : undefined }}>
          {it.order}
        </span>
        {/* Card dossier (Image#4). CHỈ field CÓ NGUỒN. Cố ý OMIT (không nguồn trong KB):
            thời lượng ghé ("60-90 phút"), citation [S6] (ta chỉ có SỐ nguồn), khung giờ đồng hồ,
            "CHUẨN BỊ"/"TIP TUYẾN" (thay bằng "Có gì ở đây"/"Thực tế" từ data thật). = bịa nếu thêm. */}
        <article className={`min-w-0 flex-1 rounded-xl border p-3 transition-colors ${active ? 'border-primary/50 bg-primary/5' : 'border-border bg-white hover:border-primary/30'}`}>
          {/* HEADER: buổi + tên + badge xác minh (✓ Mở {giờ} · N nguồn = "Đã xác minh · S6" trung thực) */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs font-semibold" style={{ color: SOFT }}>{t(`itinerary.buoi.${it.buoi}`)}</span>
            <span className="text-[15px] font-semibold leading-snug" style={{ color: INK }}>{stripCitySuffix(it.name)}</span>
            <Badge it={it} />
          </div>
          {/* META: category · trải nghiệm · cách KS (KHÔNG duration) */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]" style={{ color: SOFT }}>
            <span>{displayCategory(it)}</span>
            {isDest && it.trai_nghiem && it.trai_nghiem !== displayCategory(it) ? <span>· {it.trai_nghiem}</span> : null}
            {hotelKm != null ? <span>· {t('itinerary.fromHotel', { dist: fmtKm(hotelKm) ?? '' })}</span> : null}
          </div>

          {isDest ? (() => {
            // Render section theo PROFILE của loại điểm (thứ tự + gate). landmark bỏ "Có gì ở đây";
            // paid_activity/environment là slot forward-compat (chưa có field trên DtoItem → no-op).
            const { sections } = cardProfile(it.category, it.name);
            // "Giới thiệu nhanh" câu 1 (intro.fact) — baked build-time, đứng tự nhiên (bỏ prefix label)
            const gt = it.gioi_thieu;
            const renderSection = (s: SectionKey) => {
              switch (s) {
                case 'mo_ta':
                  return it.mo_ta ? (
                    <div key="mo_ta">
                      {/* MÔ TẢ: mo_ta full, clamp 3 dòng + "Xem thêm" khi dài */}
                      <p className={`mt-2 text-[14px] leading-[1.6] ${open ? '' : 'line-clamp-3'}`} style={{ color: INK }}>{it.mo_ta}</p>
                      {longMoTa ? (
                        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                          className="mt-0.5 text-[12px] font-semibold text-primary hover:underline">
                          {open ? t('itinerary.showLess') : t('itinerary.seeMore')}
                        </button>
                      ) : null}
                      {/* CC-BY-SA: mô tả trích Wikipedia → bắt buộc dẫn nguồn (B2) */}
                      {it.mo_ta_nguon_url ? (
                        <a href={it.mo_ta_nguon_url} target="_blank" rel="noreferrer"
                          className="mt-0.5 block text-[12px] hover:underline" style={{ color: FAINT }}>{t('itinerary.fromWikipedia')}</a>
                      ) : null}
                    </div>
                  ) : null;
                case 'hoat_dong': {
                  // A3: MỘT nhãn "Có gì ở đây" + MỘT chip-wrap gộp — hoat_dong (chip muted), trò trả phí
                  // có tên (chip primary đặc), vibes (chip viền primary). Không sub-heading caps liền kề.
                  const tham = (it.hoat_dong ?? []).map((h) => h.label);
                  const paid = (it.paid_activities ?? []).map((a) => a.ten);
                  const vibes = it.vibes ?? [];
                  if (!tham.length && !paid.length && !vibes.length) return null;
                  return (
                    <div key="hoat_dong" className="mt-2.5">
                      <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: FAINT }}>{t('itinerary.whatsHere')}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {tham.map((label, i) => (
                          <span key={`t-${i}`} className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-semibold" style={{ color: SOFT }}>{label}</span>
                        ))}
                        {paid.map((label, i) => (
                          <span key={`p-${i}`} className="rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-semibold text-primary">{label}</span>
                        ))}
                        {vibes.map((v) => {
                          const c = vibeChip(v);
                          return (
                            <span key={`v-${v}`} className="rounded-full border border-primary/30 px-2 py-0.5 text-[12px] font-semibold text-primary">
                              {c.emoji ? `${c.emoji} ` : ''}{c.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                case 'cach_trung_tam': {
                  // B5.1: nhãn tiện ích ĐẦY ĐỦ qua FACILITY_LABELS (cấm viết tắt tự chế); key lạ → ẩn
                  const fac = it.facilities ? Object.entries(it.facilities).filter(([k, v]) => v && FACILITY_LABELS[k]).map(([k, v]) => FACILITY_LABELS[k] + (v === 'limited' ? t('itinerary.facilityLimited') : '')) : [];
                  const hasThucTe = it.gio_mo || it.cach_trung_tam_km != null || it.gia_ve || fac.length;
                  return hasThucTe ? (
                    <div key="thuc_te" className="mt-2 border-t border-border pt-2 text-[12px]" style={{ color: SOFT }}>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {/* badge "✓ Mở {giờ}" đã hiện giờ khi !goi_truoc → bỏ dòng này tránh trùng */}
                        {it.gio_mo && it.goi_truoc ? <span>🕐 {t('itinerary.badgeOpen')} <span className="tabular-nums">{it.gio_mo}</span></span> : null}
                        {it.gia_ve ? <span>{t('itinerary.ticketsLabel', { value: /^\s*(yes|có|co)\s*$/i.test(it.gia_ve) ? t('itinerary.ticketsPaidUnconfirmed') : it.gia_ve })}</span> : null}
                        {it.cach_trung_tam_km != null ? <span>{t('itinerary.fromCentre', { dist: fmtKm(it.cach_trung_tam_km) ?? '' })}</span> : null}
                      </div>
                      {fac.length ? <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: FAINT }}>{fac.map((f, i) => <span key={i}>{f}</span>)}</div> : null}
                    </div>
                  ) : null;
                }
                case 'vibes':
                  return null; // A3: vibes ĐÃ gộp vào "Có gì ở đây" (case hoat_dong) — không render riêng
                default:
                  return null; // paid_activity / environment: chưa có field trên DtoItem
              }
            };
            return (
              <>
                {gt ? (
                  <p className="mt-2 text-[14px] leading-[1.6]" style={{ color: INK }}>{gt}</p>
                ) : null}
                {sections.map(renderSection)}
                {/* EDITORIAL tier (002): tách hẳn khỏi badge verified + mô tả — nhãn + disclaimer,
                    KHÔNG trộn với fact. Chỉ hiện khi flag EDITORIAL_TIER bật + có câu (per-loại). */}
                {it.phu_hop_voi ? (
                  <div key="phu_hop_voi" className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                    <div className="text-[12px] font-bold uppercase tracking-wide text-primary">{t('itinerary.editorialTitle')}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: SOFT }}>{it.phu_hop_voi}</p>
                    <p className="mt-0.5 text-[12px] italic" style={{ color: FAINT }}>{t('itinerary.editorialDisclaimer')}</p>
                  </div>
                ) : null}
              </>
            );
          })() : null}
        </article>
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
  const t = useTranslations('planner');
  // Lưu chuyến đi (localStorage) + Chia sẻ (navigator.share/clipboard) — mock header actions.
  function saveTrip() {
    try {
      const arr = JSON.parse(localStorage.getItem('bbvn_saved_trips') || '[]');
      const entry = { slug: dto.slug, tripDays: dto.tripDays, href: hrefPdf ?? '', savedAt: Date.now() };
      const next = [entry, ...(Array.isArray(arr) ? arr : []).filter((x: { slug?: string; tripDays?: number }) => !(x.slug === dto.slug && x.tripDays === dto.tripDays))].slice(0, 20);
      localStorage.setItem('bbvn_saved_trips', JSON.stringify(next));
      alert(t('itinerary.savedAlert'));
    } catch { /* quota */ }
  }
  async function shareTrip() {
    const url = hrefPdf ? new URL(hrefPdf, location.origin).href : location.href;
    const title = t('itinerary.shareTitle', { city: cityName(dto.slug), days: dto.tripDays });
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); alert(t('itinerary.sharedAlert')); }
    } catch { /* user huỷ / không hỗ trợ */ }
  }

  return (
    <div className="@container w-full overflow-hidden border border-border bg-white">
      <style>{CARD_CSS}</style>

      {/* Tiêu đề chính ở PlannerPane header. Chú thích order-circle + "Nhịp độ" đã BỎ (gọn timeline). */}
      {/* Header actions (mock): Lưu chuyến đi · Xuất PDF · Chia sẻ — ẨN TẠM (phát triển sau). */}
      {HEADER_ACTIONS.enabled ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={saveTrip}
            className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
            {t('itinerary.saveTrip')}
          </button>
          {hrefPdf ? (
            <a href={hrefPdf} className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
              {t('itinerary.exportPdf')}
            </a>
          ) : null}
          <button type="button" onClick={shareTrip}
            className="inline-flex items-center gap-1 rounded-lg border border-[#F0EAE2] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
            {t('itinerary.share')}
          </button>
        </div>
      ) : null}

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
                <span className="text-[13.5px] font-[650] uppercase" style={{ color: INK, fontWeight: 650 }}>{t('dayTabBar.day', { day: d.day })}</span>
                <span className="ml-auto text-xs font-semibold normal-case" style={{ color: SOFT, letterSpacing: 0 }}>
                  {area ? t('itinerary.area', { area }) : ''}{t('itinerary.stops', { stops })}
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


      </div>
    </div>
  );
}
