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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Chưa có vé nào.</p>
      )}

      <ul className="flex list-none flex-col gap-3 p-0">
        {rows.map((b) => (
          <li key={b.id}>
            <Link href={`/account/bookings/${b.id}`} className="block">
              <Card className="gap-2 py-4 transition-colors hover:bg-muted/50">
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

      {loading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
      {nextCursor && !loading && (
        <Button variant="outline" className="self-start" onClick={() => void load(tab, nextCursor)}>
          Tải thêm
        </Button>
      )}
    </main>
  );
}
