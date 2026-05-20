/**
 * /op/upcoming — Upcoming trips list (Issue 014).
 *
 * Server component: reads listUpcomingForOperator in-process.
 * MUST NOT self-fetch own API (Issue 002/003 hardened rule).
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listUpcomingForOperator } from '@/lib/trips/listUpcomingForOperator';
import type { TripDto } from '@/lib/trips/tripDto';

export default async function OpUpcomingPage() {
  const session = await getOperatorSession();

  if (!session) {
    redirect('/op/login');
  }

  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const { trips } = await listUpcomingForOperator(session.operatorId, {});

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <h1>Chuyến xe sắp khởi hành</h1>
      {trips.length === 0 ? (
        <p>Không có chuyến nào trong thời gian tới.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse' }}
          data-testid="upcoming-trips-table"
        >
          <thead>
            <tr style={{ background: '#f4f4f4' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>Khởi hành</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Giá</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Trạng thái</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Ghế còn</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Manifest</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip: TripDto) => (
              <tr
                key={trip.id}
                data-testid={`upcoming-trip-${trip.id}`}
                style={{ borderBottom: '1px solid #eee' }}
              >
                <td style={{ padding: 8 }}>
                  {new Date(trip.departureAt).toLocaleString('vi-VN')}
                </td>
                <td style={{ padding: 8 }}>{trip.price?.toLocaleString('vi-VN')}đ</td>
                <td style={{ padding: 8 }}>{trip.status}</td>
                <td style={{ padding: 8 }}>{trip.availableSeats}</td>
                <td style={{ padding: 8 }}>
                  <a
                    href={`/op/manifest/${trip.id}`}
                    data-testid={`manifest-link-${trip.id}`}
                  >
                    Xem manifest
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
