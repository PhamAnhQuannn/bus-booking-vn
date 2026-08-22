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
  placeholder?: string;
};

export function PlannerComposer({ value, onChange, onSubmit, disabled, placeholder }: Props) {
  const t = useTranslations('planner');
  return (
    <form
      className="flex items-center gap-2.5 rounded-2xl border border-[#F0E9E1] bg-white py-2 pl-4 pr-2 shadow-[0_4px_16px_rgba(30,36,51,0.06)] transition-shadow focus-within:border-primary focus-within:shadow-[0_4px_20px_rgba(240,86,29,0.14)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('composer.placeholder')}
        className="h-12 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label={t('composer.send')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" fill="currentColor" />
        </svg>
      </button>
    </form>
  );
}
