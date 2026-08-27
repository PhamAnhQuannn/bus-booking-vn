'use client';

/**
 * Composer dùng chung cho entry-hero LẪN active-chat. Tách khỏi page (redesign v4).
 * Bỏ paperclip/file-attachment (mock có nhưng chưa hỗ trợ). Enter = gửi.
 */

import { useTranslations } from 'next-intl';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean; // đang chờ trợ lý (state B) → khoá input, đổi placeholder, nút thành spinner
  placeholder?: string;
};

export function PlannerComposer({ value, onChange, onSubmit, disabled, busy, placeholder }: Props) {
  const t = useTranslations('planner');
  const locked = disabled || busy;
  return (
    <form
      className="flex items-center gap-2.5 rounded-2xl border border-[#F0E9E1] bg-white py-2 pl-4 pr-2 shadow-[0_4px_16px_rgba(30,36,51,0.06)] transition-shadow focus-within:border-primary focus-within:shadow-[0_4px_20px_rgba(240,86,29,0.14)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (locked) return; // chặn double-submit tuyệt đối (cả click lẫn Enter)
        onSubmit();
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder={busy ? t('composer.planningPlaceholder') : placeholder ?? t('composer.placeholder')}
        className="h-12 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={locked || !value.trim()}
        aria-label={busy ? t('composer.sending') : t('composer.send')}
        aria-busy={busy || undefined}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/40"
      >
        {busy ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="motion-safe:animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </form>
  );
}
