'use client';

/**
 * /account/bookings — authenticated customer's booking history (Issue 009,
 * PRD story 15). Upcoming / Past tabs, status badges, cursor "load more".
 *
 * Access token lives in the shared client session store; a page reload loses
 * it unless a refresh cookie is still valid (ensureAuthenticated handles the
 * silent-refresh attempt before redirecting to login with returnTo).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { authFetch, ensureAuthenticated } from '@/lib/auth/clientSession';
import { bookingStatusDisplay } from '@/lib/op/statusLabels';
import type { CustomerBookingRow } from '@/lib/booking';
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
  const t = useTranslations('account');
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center shadow-e1">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Ticket className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {tab === 'upcoming' ? t('bookings.emptyUpcomingTitle') : t('bookings.emptyPastTitle')}
        </p>
        <p className="text-sm text-muted-foreground">
          {tab === 'upcoming'
            ? t('bookings.emptyUpcomingDesc')
            : t('bookings.emptyPastDesc')}
        </p>
      </div>
      {tab === 'upcoming' && (
        <Link href="/" className={cn(buttonVariants({ size: 'lg' }), 'gap-1')}>
          {t('bookings.findTrips')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function BookingsHistoryPage() {
  const t = useTranslations('account');
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rows, setRows] = useState<CustomerBookingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (activeTab: Tab, cursor: string | null) => {
      const ok = await ensureAuthenticated();
      if (!ok) {
        router.push('/auth/login?returnTo=/account/bookings');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ tab: activeTab });
        if (cursor) qs.set('cursor', cursor);
        const res = await authFetch(`/api/bookings?${qs}`);
        if (res.status === 401) {
          router.push('/auth/login?returnTo=/account/bookings');
          return;
        }
        if (!res.ok) {
          setError(t('bookings.loadError'));
          return;
        }
        const json = (await res.json()) as { rows: CustomerBookingRow[]; nextCursor: string | null };
        setRows((prev) => (cursor ? [...prev, ...json.rows] : json.rows));
        setNextCursor(json.nextCursor);
      } catch {
        setError(t('common.connErrorRetry'));
      } finally {
        setLoading(false);
      }
    },
    [router, t]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab, null);
  }, [tab, load]);

  // AX-8: ArrowLeft/Right roving between the two tabs (WAI-ARIA tabs pattern).
  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const order = ['upcoming', 'past'] as const;
    const idx = order.indexOf(tab);
    const next = order[(idx + (e.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length];
    setTab(next);
    document.getElementById(`bookings-tab-${next}`)?.focus();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">{t('page.breadcrumbHome')}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">{t('page.breadcrumbBookings')}</li>
        </ol>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold">{t('page.breadcrumbBookings')}</h1>
        <Link
          href="/account/settings"
          className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('page.title')}
        </Link>
      </div>

      <div className="flex gap-2 border-b border-border" role="tablist" aria-label={t('bookings.filterAria')}>
        {(['upcoming', 'past'] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            id={`bookings-tab-${tabKey}`}
            role="tab"
            aria-selected={tab === tabKey}
            aria-controls="bookings-tabpanel"
            // AX-8: roving tabindex — only the active tab is in the tab order;
            // ArrowLeft/Right move selection + focus between tabs.
            tabIndex={tab === tabKey ? 0 : -1}
            onClick={() => setTab(tabKey)}
            onKeyDown={onTabKeyDown}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === tabKey
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tabKey === 'upcoming' ? t('bookings.tabUpcoming') : t('bookings.tabPast')}
          </button>
        ))}
      </div>

      <div
        id="bookings-tabpanel"
        role="tabpanel"
        aria-labelledby={`bookings-tab-${tab}`}
        tabIndex={0}
        className="flex flex-col gap-4 outline-none"
      >
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
                      <Badge variant={bookingStatusDisplay(b.status).variant}>{bookingStatusDisplay(b.status).label}</Badge>
                    </div>
                    <div className="px-4 text-sm text-muted-foreground">
                      {dateFmt.format(new Date(b.departureAt))}
                    </div>
                    <div className="px-4 text-sm text-muted-foreground">
                      {t('bookings.ticketsCount', { count: b.ticketCount })} · {vnd(b.totalVnd)} · <span className="font-mono">{b.bookingRef}</span>
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
            {t('bookings.loadMore')}
          </Button>
        )}
      </div>
    </main>
  );
}
