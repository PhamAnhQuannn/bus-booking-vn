'use client';

/**
 * /account/bookings — authenticated customer's booking history (Issue 009,
 * PRD story 15). Upcoming / Past tabs, status badges, cursor "load more".
 *
 * Access token lives in client memory (module store in the register page); a
 * page reload loses it, so a missing token redirects to login with returnTo.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/app/auth/register/page';
import { STATUS_LABEL, STATUS_VARIANT } from './bookingStatus';
import type { CustomerBookingRow } from '@/lib/booking/listCustomerBookings';
import { Ticket, ArrowRight } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Tab = 'upcoming' | 'past';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Skeleton row matching the booking card shape (route line + meta lines). */
function BookingCardSkeleton() {
  return (
    <Card className="gap-2 py-4">
      <div className="flex items-center justify-between gap-2 px-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="px-4">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="px-4">
        <Skeleton className="h-4 w-56" />
      </div>
    </Card>
  );
}

/** Composed empty state — icon, message, and a CTA back into the search flow. */
function EmptyBookings({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center shadow-e1">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Ticket className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {tab === 'upcoming' ? 'Chưa có chuyến nào sắp tới' : 'Chưa có vé đã qua'}
        </p>
        <p className="text-sm text-muted-foreground">
          {tab === 'upcoming'
            ? 'Đặt vé xe khách liên tỉnh chỉ trong 30 giây.'
            : 'Vé đã hoàn thành sẽ hiển thị ở đây.'}
        </p>
      </div>
      {tab === 'upcoming' && (
        <Link href="/" className={cn(buttonVariants({ size: 'lg' }), 'gap-1')}>
          Tìm chuyến xe
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function BookingsHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rows, setRows] = useState<CustomerBookingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (activeTab: Tab, cursor: string | null) => {
      const token = getAccessToken();
      if (!token) {
        router.push('/auth/login?returnTo=/account/bookings');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ tab: activeTab });
        if (cursor) qs.set('cursor', cursor);
        const res = await fetch(`/api/bookings?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.push('/auth/login?returnTo=/account/bookings');
          return;
        }
        if (!res.ok) {
          setError('Không thể tải lịch sử đặt vé.');
          return;
        }
        const json = (await res.json()) as { rows: CustomerBookingRow[]; nextCursor: string | null };
        setRows((prev) => (cursor ? [...prev, ...json.rows] : json.rows));
        setNextCursor(json.nextCursor);
      } catch {
        setError('Lỗi kết nối. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab, null);
  }, [tab, load]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">Trang chủ</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">Lịch sử đặt vé</li>
        </ol>
      </nav>
      <h1 className="text-2xl font-bold">Lịch sử đặt vé</h1>

      <div className="flex gap-2 border-b border-border" role="tablist">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'upcoming' ? 'Sắp tới' : 'Đã qua'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {/* First-load skeletons match the card shape so the layout doesn't jump. */}
      {loading && rows.length === 0 && (
        <ul className="flex list-none flex-col gap-3 p-0" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <BookingCardSkeleton />
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length === 0 && !error && <EmptyBookings tab={tab} />}

      {rows.length > 0 && (
        <ul className="flex list-none flex-col gap-3 p-0">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/account/bookings/${b.id}`} className="block">
                <Card className="gap-2 py-4 shadow-e1 transition-all hover:shadow-e2 motion-safe:hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2 px-4">
                    <strong className="text-base">
                      {b.route.origin} → {b.route.destination}
                    </strong>
                    <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <div className="px-4 text-sm text-muted-foreground">
                    {dateFmt.format(new Date(b.departureAt))}
                  </div>
                  <div className="px-4 text-sm text-muted-foreground">
                    {b.ticketCount} vé · {vnd(b.totalVnd)} · <span className="font-mono">{b.bookingRef}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Load-more: skeleton while appending, button otherwise. */}
      {loading && rows.length > 0 && <BookingCardSkeleton />}
      {nextCursor && !loading && (
        <Button variant="outline" className="self-start" onClick={() => void load(tab, nextCursor)}>
          Tải thêm
        </Button>
      )}
    </main>
  );
}
