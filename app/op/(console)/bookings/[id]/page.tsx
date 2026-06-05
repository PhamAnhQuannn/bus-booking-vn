/**
 * /op/dashboard/[id] — Operator Booking Detail (Issue 014, stories 46/47/49).
 *
 * Server component: loads booking + active pickup points in-process via
 * getBookingDetailPage (never self-fetch own API — Issue 002/003 hardened rule).
 *
 * - Not authenticated → redirect /op/login
 * - requiresPasswordChange → redirect /op/first-login
 * - Booking not found (cross-op or missing) → 404
 */

import { redirect, notFound } from 'next/navigation';
import { getOperatorSession } from '@/lib/op';
import { getBookingDetailPage } from '@/lib/booking';
import { PageHeader } from '@/components/op/PageHeader';
import BookingDetailClient from './BookingDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function OpBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const data = await getBookingDetailPage(session.operatorId, id);
  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[
          { label: 'Đặt vé', href: '/op/bookings' },
          { label: data.booking.bookingRef },
        ]}
        title="Chi tiết đặt vé"
        backHref="/op/bookings"
      />
      <BookingDetailClient booking={data.booking} pickupPoints={data.pickupPoints} />
    </div>
  );
}
