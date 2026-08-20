'use client';

/**
 * PlannerEntry — màn mở đầu trợ lý (redesign v4, mock "Bạn muốn đi đâu hôm nay?").
 * Mascot hero + heading + 4 chip vibe + 3 card điểm đến. Bấm chip/card → onPick(prompt) → page.send().
 * Composer KHÔNG ở đây — page render ở bottom-zone (dùng chung entry + active). Ảnh = placeholder.
 *
 * Tỉ lệ đo từ mock (canvas 1326×999) → dùng %/aspect để BỀN theo size màn:
 *  mascot ~38.7%W (ratio ~3:1) · nội dung căn giữa rộng ~780px · chip co nội dung + gap đều ·
 *  3 card chia đều, ảnh ratio ~2.4:1. Màu: heading gần đen #0A0806 · muted #5C5A5A · border mờ #F0E9E1.
 */

import { useTranslations } from 'next-intl';
import { PlannerImage } from '@/trip-planner/components/PlannerImage';
import { VIBE_STARTERS, SAMPLE_CARDS } from '@/trip-planner/lib/planner/starters';

type Props = { onPick: (prompt: string) => void; disabled?: boolean };

export function PlannerEntry({ onPick, disabled }: Props) {
  const t = useTranslations('planner');
  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col px-4 pb-4 pt-6 lg:pt-9">
      {/* Mascot hero — scene ngang ~3:1, ~60% bề rộng nội dung */}
      <div className="flex justify-center">
        <PlannerImage
          src="/planner/mascot.svg"
          alt={t('entry.mascotAlt')}
          fallbackEmoji="🤖"
          className="aspect-[512/173] w-full max-w-[480px] rounded-3xl bg-transparent from-transparent to-transparent"
        />
      </div>

      <h1 className="mt-7 text-center text-[30px] font-extrabold tracking-tight text-[#0A0806] sm:text-[38px]">
        {t('entry.heading')}
      </h1>
      <p className="mx-auto mt-4 max-w-[440px] text-center text-[15px] leading-relaxed text-[#5C5A5A]">
        {t('entry.subheading')}
      </p>

      {/* Gợi ý bắt đầu — 4 chip vibe (co theo nội dung, gap đều, căn giữa) */}
      <p className="mt-12 text-sm font-medium text-[#33322F]">{t('entry.startersLabel')}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VIBE_STARTERS.map((v) => (
          <button
            key={v.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(v.query)}
            className="flex items-center gap-1.5 rounded-xl border border-[#F0E9E1] bg-white px-3 py-3 text-left text-[12.5px] font-medium shadow-e1 transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="shrink-0 text-base leading-none" aria-hidden>{v.icon}</span>
            <span className="leading-snug">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Bạn có thể thử — 3 card điểm đến (chia đều, ảnh ratio ~2.4:1) */}
      <p className="mt-9 text-sm font-medium text-[#33322F]">{t('entry.samplesLabel')}</p>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {SAMPLE_CARDS.map((c) => (
          <button
            key={c.title}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.prompt)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[#F0E9E1] bg-white text-left shadow-e1 transition-shadow hover:shadow-e2 disabled:opacity-50"
          >
            <PlannerImage src={c.image} alt={c.title} fallbackEmoji="🏞️" className="aspect-[12/5] w-full" />
            <div className="flex flex-1 flex-col p-3.5">
              <p className="text-sm font-semibold leading-snug text-[#1B1A18]">{c.title}</p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#6B6763]">{c.desc}</p>
              <span className="mt-3 grid h-8 w-8 place-items-center self-end rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
