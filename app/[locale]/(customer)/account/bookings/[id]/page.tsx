'use client';

/**
 * /account/bookings/:id — authenticated customer's booking detail (Issue 009,
 * PRD story 16). Shows route, departure, ticket count, buyer info, total,
 * status, operator contact phone, and a PDF-ticket download button.
 *
 * Access token lives in the shared client session store; a missing/expired
 * token triggers a silent refresh attempt (ensureAuthenticated) before
 * redirecting to login with returnTo. The download button must fetch the
 * ticket route with the Bearer header and stream the blob — a plain
 * <a href> can't carry the Authorization header.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { authFetch, ensureAuthenticated } from '@/lib/auth/clientSession';
import { bookingStatusVariant } from '@/lib/op/statusLabels';
import type { CustomerBookingDetail } from '@/lib/booking';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone } from 'lucide-react';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TICKETABLE = new Set(['paid', 'completed', 'no_show']);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export default function BookingDetailPage() {
  const t = useTranslations('account');
  const tStatus = useTranslations('booking');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [booking, setBooking] = useState<CustomerBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loginRedirect = useCallback(() => {
    router.push(`/auth/login?returnTo=/account/bookings/${id}`);
  }, [router, id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await ensureAuthenticated();
      if (!ok) {
        loginRedirect();
        return;
      }
      try {
        const res = await authFetch(`/api/bookings/${id}`);
        if (!active) return;
        if (res.status === 401) {
          loginRedirect();
          return;
        }
        if (res.status === 404) {
          setError(t('detail.notFound'));
          return;
        }
        if (!res.ok) {
          setError(t('detail.loadError'));
          return;
        }
        const json = (await res.json()) as { booking: CustomerBookingDetail };
        setBooking(json.booking);
      } catch {
        if (active) setError(t('common.connErrorRetry'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, loginRedirect, t]);

  const downloadTicket = useCallback(async () => {
    const ok = await ensureAuthenticated();
    if (!ok) {
      loginRedirect();
      return;
    }
    setDownloading(true);
    setError('');
    try {
      const res = await authFetch(`/api/bookings/${id}/ticket`);
      if (res.status === 401) {
        loginRedirect();
        return;
      }
      if (!res.ok) {
        setError(t('detail.pdfError'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${booking?.bookingRef ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('common.connErrorRetry'));
    } finally {
      setDownloading(false);
    }
  }, [id, booking, loginRedirect, t]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li className="shrink-0">
            <Link href="/account/bookings" className="underline-offset-4 hover:text-foreground hover:underline">
              {t('page.breadcrumbBookings')}
            </Link>
          </li>
          <li aria-hidden="true" className="shrink-0">/</li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">
            {booking?.bookingRef ?? t('detail.fallbackRef')}
          </li>
        </ol>
      </nav>

      {loading && (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-28" />
          <Card>
            <CardContent className="flex flex-col gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </CardContent>
          </Card>
          {/* AC-3: the real action row has up to two buttons ("Tải vé PDF" +
              "Gọi nhà xe") — match both so the layout doesn't reflow when loading flips. */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-36 rounded-full" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {booking && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">
              {booking.route.origin} → {booking.route.destination}
            </h1>
            <Badge variant={bookingStatusVariant(booking.status)}>{tStatus(`status.${booking.status}`)}</Badge>
          </div>
          <div className="font-mono text-sm text-muted-foreground">{booking.bookingRef}</div>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <Field label={t('detail.depart')}>{dateFmt.format(new Date(booking.departureAt))}</Field>
              {booking.boardingPoint && (
                <Field label={t('detail.boardingPoint')}>
                  {booking.boardingPoint}
                  {booking.boardingTime ? ` · ${booking.boardingTime}` : ''}
                </Field>
              )}
              <Field label={t('detail.ticketCount')}>{booking.ticketCount}</Field>
              <Field label={t('detail.total')}>{vnd(booking.totalVnd)}</Field>
              <Field label={t('detail.licensePlate')}>{booking.busLicensePlate}</Field>

              <div className="border-t border-border" />

              <Field label={t('detail.buyer')}>{booking.buyerName}</Field>
              <Field label={t('detail.phone')}>{booking.buyerPhone}</Field>

              <div className="border-t border-border" />

              <Field label={t('detail.operator')}>{booking.operator.legalName}</Field>
              <Field label={t('detail.operatorContact')}>{booking.operator.contactPhone}</Field>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {TICKETABLE.has(booking.status) && (
              <Button size="lg" onClick={() => void downloadTicket()} disabled={downloading}>
                {downloading ? t('detail.downloading') : t('detail.downloadPdf')}
              </Button>
            )}
            <a
              href={`tel:${booking.operator.contactPhone}`}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <Phone className="size-4" aria-hidden="true" />
              {t('detail.callOperator')}
            </a>
          </div>
        </>
      )}
    </main>
  );
}
