'use client';

/**
 * PaneTabs — thanh tab CHÍNH của artifact: Lịch trình · Khách sạn · Ăn uống.
 * (Điểm đến ĐÃ gộp vào Lịch trình — điểm đến nằm trong timeline kèm mô tả ngắn.)
 * Underline-active (khác DayTabBar pill) để đọc ra 2 tầng điều hướng: section ở đây,
 * chọn NGÀY vẫn qua DayTabBar/day-header trong tab Lịch trình.
 * Doctrine: KHÔNG tab "Plan B" — chưa có dữ liệu (0 dòng bịa).
 */

export type PaneTab = 'lich-trinh' | 'khach-san' | 'an-uong';

const TABS: { key: PaneTab; label: string }[] = [
  { key: 'lich-trinh', label: 'Lịch trình' },
  { key: 'khach-san', label: 'Khách sạn' },
  { key: 'an-uong', label: 'Ăn uống' },
];

type Props = {
  active: PaneTab;
  onSelect: (t: PaneTab) => void;
};

export function PaneTabs({ active, onSelect }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-5 border-b border-border px-1">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            aria-pressed={on}
            className={`-mb-px border-b-2 py-2.5 text-[13.5px] font-semibold transition-colors ${
              on
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
