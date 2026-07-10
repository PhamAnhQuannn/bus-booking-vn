/**
 * /booking/customer — Customer information step.
 *
 * Two-column layout: form (left) + trip summary rail (right).
 * Trip data fetched server-side via getTripDetails.
 */

import { redirect } from 'next/navigation';
import { CustomerForm } from './CustomerForm';
import { BookingSteps } from '@/components/booking/BookingSteps';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { getTripDetails } from '@/lib/trips';

interface PageProps {
  searchParams: Promise<{ tripId?: string; ticketCount?: string }>;
}

export default async function CustomerPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tripId = sp.tripId;
  const ticketCount = Number(sp.ticketCount) || 1;

  if (!tripId) redirect('/');

  const trip = await getTripDetails(tripId);
  if (!trip) redirect('/');

  const unitPrice = trip.price;
  const total = unitPrice * ticketCount;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-6 px-4 py-8 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <div className="flex flex-col gap-6">
        <BookingSteps current={1} />
        <h1 className="text-2xl font-bold">Thông tin hành khách</h1>
        <CustomerForm />
      </div>

      <BookingSummaryRail
        showHoldTimer={false}
        summary={{
          routeOrigin: trip.routeOrigin,
          routeDestination: trip.routeDestination,
          departureAt: trip.departureAt,
          operatorLegalName: trip.operatorLegalName,
          ticketCount,
          unitPriceVND: unitPrice,
          totalVND: total,
        }}
      />
    </main>
  );
}
