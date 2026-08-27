'use client';

/**
 * SlotSummaryCard — card "Mình hiểu yêu cầu của bạn" (state Understood). Thay progress-tracker
 * chấm-đường cũ + PlannerStepper. Hiện các ràng buộc hệ thống đã bóc: điểm đến / số ngày / nhóm /
 * ngân sách / sở thích. Mỗi chip là <button> mở popover SỬA đúng loại; slot chưa có → chip mờ "—".
 *
 * Sửa xong → onEdit(nextSlots): page setSlots + (nếu đủ slot) dựng lại (abort request cũ).
 * Giá trị lưu = CODE/SỐ/SLUG (không phải nhãn VI) → i18n sạch, không phụ thuộc ngôn ngữ hiển thị.
 *
 * INVARIANT doctrine: ngân sách là HẠNG (tiết kiệm/vừa/thoải mái), KHÔNG số tiền — không có data giá.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Popover } from '@base-ui/react/popover';
import { CITIES } from '@/trip-planner/lib/planner/cities';
import type { Slots, Nhom, Budget } from '@/trip-planner/lib/planner/slots';

const GROUP_CODES: Nhom[] = ['cap-doi', 'gia-dinh', 'ban-be', 'cong-tac'];
const BUDGET_CODES: Budget[] = ['tiet-kiem', 'vua', 'thoai-mai'];
const INTEREST_CODES = ['ngam-canh', 'tam-linh', 'lich-su-van-hoa', 'lang-man', 'song-ao-chup-hinh', 'thu-gian-yen-tinh'];
const DAY_OPTIONS = [2, 3, 4, 5, 7];

const cityName = (slug?: string) => CITIES.find((c) => c.slug === slug)?.ten ?? '';
const persons = (s: Slots) => (s.adults ?? 0) + (s.children ?? 0) + (s.elders ?? 0);

// nhom → preset party + bias (giữ đồng bộ applyChip trong slots.ts; set code trực tiếp, không qua nhãn VI).
function withGroup(s: Slots, code: Nhom): Slots {
  const n: Slots = { ...s, nhom: code };
  if (persons(n) === 0) {
    if (code === 'cap-doi') n.adults = 2;
    else if (code === 'gia-dinh') { n.adults = 2; n.children = 2; }
    else if (code === 'ban-be') n.adults = 4;
    else n.adults = 1;
  }
  if (code === 'cap-doi' && !(n.interests ?? []).includes('lang-man')) n.interests = [...(n.interests ?? []), 'lang-man'];
  if (code === 'gia-dinh') n.avoidSteep = n.avoidSteep ?? true;
  return n;
}

type Props = { slots: Slots; disabled?: boolean; onEdit: (next: Slots) => void };

export function SlotSummaryCard({ slots, disabled, onEdit }: Props) {
  const t = useTranslations('planner');
  const groupLabel = slots.nhom ? t(`slotCard.group.${slots.nhom}`) : persons(slots) > 0 ? t('slotCard.persons', { n: persons(slots) }) : '';
  const interestsLabel = (slots.interests ?? [])
    .map((c) => (INTEREST_CODES.includes(c) ? t(`slotCard.interest.${c}`) : c))
    .join(', ');

  return (
    <div className="mb-2 rounded-2xl border border-[#F0EAE2] bg-white p-3 shadow-e1">
      <p className="mb-2 px-0.5 text-[13px] font-semibold text-foreground">{t('slotCard.title')}</p>
      <div className="flex flex-wrap gap-2">
        {/* 📍 Điểm đến */}
        <Chip icon="📍" placeholder={t('slotCard.destination')} value={cityName(slots.dia_diem)} disabled={disabled}
          aria={t('slotCard.editDestination', { value: cityName(slots.dia_diem) || t('slotCard.destination') })}>
          {(close) => (
            <DestinationEditor current={slots.dia_diem} onPick={(slug) => { onEdit({ ...slots, dia_diem: slug }); close(); }} t={t} />
          )}
        </Chip>

        {/* 🗓 Số ngày */}
        <Chip icon="🗓" placeholder={t('slotCard.days')} value={slots.days ? t('slotCard.dayUnit', { n: slots.days }) : ''} disabled={disabled}
          aria={t('slotCard.editDays', { value: slots.days ? t('slotCard.dayUnit', { n: slots.days }) : t('slotCard.days') })}>
          {(close) => (
            <OptionList options={DAY_OPTIONS.map((n) => ({ code: String(n), label: t('slotCard.dayUnit', { n }), active: slots.days === n }))}
              onPick={(code) => { onEdit({ ...slots, days: Number(code) }); close(); }} />
          )}
        </Chip>

        {/* 👥 Nhóm */}
        <Chip icon="👥" placeholder={t('slotCard.groupPlaceholder')} value={groupLabel} disabled={disabled}
          aria={t('slotCard.editGroup', { value: groupLabel || t('slotCard.groupPlaceholder') })}>
          {(close) => (
            <OptionList options={GROUP_CODES.map((c) => ({ code: c, label: t(`slotCard.group.${c}`), active: slots.nhom === c }))}
              onPick={(code) => { onEdit(withGroup(slots, code as Nhom)); close(); }} />
          )}
        </Chip>

        {/* 💰 Ngân sách */}
        <Chip icon="💰" placeholder={t('slotCard.budget')} value={slots.budget ? t(`slotCard.budgetLabel.${slots.budget}`) : ''} disabled={disabled}
          aria={t('slotCard.editBudget', { value: slots.budget ? t(`slotCard.budgetLabel.${slots.budget}`) : t('slotCard.budget') })}>
          {(close) => (
            <OptionList options={BUDGET_CODES.map((c) => ({ code: c, label: t(`slotCard.budgetLabel.${c}`), active: slots.budget === c }))}
              onPick={(code) => { onEdit({ ...slots, budget: code as Budget }); close(); }} />
          )}
        </Chip>

        {/* ❤️ Sở thích (multi — commit khi đóng) */}
        <Chip icon="❤️" placeholder={t('slotCard.interests')} value={interestsLabel} disabled={disabled}
          aria={t('slotCard.editInterests', { value: interestsLabel || t('slotCard.interests') })}>
          {(close) => (
            <InterestsEditor current={slots.interests ?? []} t={t}
              onCommit={(next) => { onEdit({ ...slots, interests: next }); close(); }} />
          )}
        </Chip>
      </div>
    </div>
  );
}

// ── Chip trigger + popover shell ─────────────────────────────────────────────
function Chip({
  icon, placeholder, value, aria, disabled, children,
}: {
  icon: string; placeholder: string; value: string; aria: string; disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const filled = !!value;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={aria}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50 ${
          filled ? 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10' : 'border-dashed border-[#D9CFC2] text-muted-foreground hover:border-primary'
        }`}
      >
        <span aria-hidden>{icon}</span>
        <span>{filled ? value : `${placeholder}: —`}</span>
      </Popover.Trigger>
      <Popover.Portal>
        {/* z-popover trên Positioner (DD-1), không trên Popup */}
        <Popover.Positioner sideOffset={6} className="z-popover outline-none">
          <Popover.Popup className="max-h-[280px] w-[240px] overflow-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-e3 outline-none">
            {children(() => setOpen(false))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Danh sách chọn 1 (day/group/budget)
function OptionList({ options, onPick }: { options: { code: string; label: string; active: boolean }[]; onPick: (code: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((o) => (
        <button key={o.code} type="button" onClick={() => onPick(o.code)}
          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${o.active ? 'font-semibold text-primary' : 'text-foreground'}`}>
          {o.label}
          {o.active ? <span aria-hidden>✓</span> : null}
        </button>
      ))}
    </div>
  );
}

// Điểm đến — ô tìm + danh sách slug
function DestinationEditor({ current, onPick, t }: { current?: string; onPick: (slug: string) => void; t: ReturnType<typeof useTranslations> }) {
  const [q, setQ] = useState('');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = CITIES.filter((c) => norm(c.ten).includes(norm(q)));
  return (
    <div className="flex flex-col gap-1">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('slotCard.searchCity')}
        className="mb-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus-visible:border-primary" />
      <div className="flex flex-col gap-0.5">
        {list.map((c) => (
          <button key={c.slug} type="button" onClick={() => onPick(c.slug)}
            className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${c.slug === current ? 'font-semibold text-primary' : 'text-foreground'}`}>
            {c.ten}
            {c.slug === current ? <span aria-hidden>✓</span> : null}
          </button>
        ))}
        {list.length === 0 ? <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{t('slotCard.noCity')}</p> : null}
      </div>
    </div>
  );
}

// Sở thích — multi toggle, commit khi bấm "Xong"
function InterestsEditor({ current, onCommit, t }: { current: string[]; onCommit: (next: string[]) => void; t: ReturnType<typeof useTranslations> }) {
  const [draft, setDraft] = useState<string[]>(current);
  const toggle = (c: string) => setDraft((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));
  return (
    <div className="flex flex-col gap-0.5">
      {INTEREST_CODES.map((c) => {
        const on = draft.includes(c);
        return (
          <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on}
            className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${on ? 'font-semibold text-primary' : 'text-foreground'}`}>
            {t(`slotCard.interest.${c}`)}
            {on ? <span aria-hidden>✓</span> : null}
          </button>
        );
      })}
      <button type="button" onClick={() => onCommit(draft)}
        className="mt-1 rounded-lg bg-primary px-2.5 py-2 text-center text-[13px] font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60">
        {t('slotCard.done')}
      </button>
    </div>
  );
}

export default SlotSummaryCard;
