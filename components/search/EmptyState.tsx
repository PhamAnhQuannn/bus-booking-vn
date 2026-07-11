import Link from 'next/link';
import { formatVnDate, shiftDate } from './search-utils';

export function EmptyState({
  origin,
  destination,
  date,
  ticketCount,
  showPrev,
}: {
  origin: string;
  destination: string;
  date: string;
  ticketCount: string;
  showPrev: boolean;
}) {
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);

  function buildUrl(newDate: string) {
    const p = new URLSearchParams({ origin, destination, date: newDate, ticketCount });
    return `/?${p.toString()}`;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <p className="text-lg text-muted-foreground">
        Không tìm thấy chuyến xe cho ngày này.
      </p>
      <p className="text-sm text-muted-foreground">Thử ngày khác:</p>
      <div className="flex gap-3">
        {showPrev ? (
          <Link
            href={buildUrl(prevDate)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            aria-label={`Tìm ngày trước: ${formatVnDate(prevDate)}`}
          >
            ← {formatVnDate(prevDate)}
          </Link>
        ) : (
          <span
            className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-muted-foreground/40"
            aria-disabled="true"
            aria-label="Không thể chọn ngày trong quá khứ"
          >
            ← {formatVnDate(prevDate)}
          </span>
        )}
        <Link
          href={buildUrl(nextDate)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          aria-label={`Tìm ngày sau: ${formatVnDate(nextDate)}`}
        >
          {formatVnDate(nextDate)} →
        </Link>
      </div>
      <Link
        href="/routes"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
      >
        Xem tất cả tuyến
      </Link>
    </div>
  );
}
