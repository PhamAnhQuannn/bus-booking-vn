/**
 * renderTicketPdf — server-side PDF ticket generation for a customer booking
 * (Issue 009, PRD story 17; QR added in Issue 074).
 *
 * Renders booking ref, passenger name, ticket count, route, departure, operator
 * contact phone, total, and a boarding QR. NO seat numbers (AC) — seat assignment
 * is handled at the operator counter, not printed on the customer ticket.
 *
 * The QR encodes the Issue-071 tamper-evident lookup token (mintTicketToken =
 * { ref, ct } only, no PII). It is rendered NATIVELY via react-pdf's <Svg>/<Rect>
 * primitives — one <Rect> per black module — so no raster image is embedded.
 *
 * Issue 074: this is now called by the generate-once JOB (not the request). It
 * returns a Buffer (renderToBuffer) the job uploads via putObject.
 *
 * Node-only: @react-pdf/renderer's renderToBuffer pulls in Node streams, so any
 * caller importing this must run on the nodejs runtime.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { ticketQrMatrix } from '@/lib/ticketing/qr';
import { mintTicketToken } from '@/lib/ticketing/ticketToken';
import type { CustomerBookingDetail } from './getCustomerBookingDetail';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  ref: { fontSize: 13, color: '#444', marginBottom: 24 },
  section: { marginBottom: 16 },
  label: { fontSize: 9, color: '#888', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 13, marginBottom: 10 },
  route: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginVertical: 16 },
  total: { fontSize: 18, fontWeight: 'bold' },
  footer: { marginTop: 32, fontSize: 9, color: '#aaa' },
  qrSection: { marginTop: 20, alignItems: 'center' },
  qrCaption: { fontSize: 8, color: '#888', marginTop: 6 },
});

/** Fixed QR render size (pt) inside the A5 ticket. */
const QR_SIZE = 120;

/**
 * Boarding QR rendered natively via react-pdf <Svg>/<Rect> — one <Rect> per black
 * module on a white background, no raster image. Module size = QR_SIZE / matrix
 * length so the matrix always fills exactly QR_SIZE points.
 */
function TicketQr({ token }: { token: string }) {
  const matrix = ticketQrMatrix(token);
  const n = matrix.length;
  const moduleSize = QR_SIZE / n;
  const rects: ReactElement[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      rects.push(
        <Rect
          key={`${r}-${c}`}
          x={c * moduleSize}
          y={r * moduleSize}
          width={moduleSize}
          height={moduleSize}
          fill="#000000"
        />
      );
    }
  }
  return (
    <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}>
      <Rect x={0} y={0} width={QR_SIZE} height={QR_SIZE} fill="#ffffff" />
      {rects}
    </Svg>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

function TicketDocument({
  booking,
  token,
}: {
  booking: CustomerBookingDetail;
  token: string;
}) {
  const departure = dateFmt.format(new Date(booking.departureAt));
  return (
    <Document title={`Ticket ${booking.bookingRef}`}>
      <Page size="A5" style={styles.page}>
        <Text style={styles.header}>{booking.operator.legalName}</Text>
        <Text style={styles.ref}>Booking ref: {booking.bookingRef}</Text>

        <View style={styles.section}>
          <Text style={styles.route}>
            {booking.route.origin} {'→'} {booking.route.destination}
          </Text>
          <Text style={styles.label}>Departure</Text>
          <Text style={styles.value}>{departure}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Passenger</Text>
          <Text style={styles.value}>{booking.buyerName}</Text>

          <Text style={styles.label}>Tickets</Text>
          <Text style={styles.value}>{booking.ticketCount}</Text>

          <Text style={styles.label}>Bus</Text>
          <Text style={styles.value}>{booking.busLicensePlate}</Text>

          <Text style={styles.label}>Operator contact</Text>
          <Text style={styles.value}>{booking.operator.contactPhone}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Total paid</Text>
        <Text style={styles.total}>{formatVnd(booking.totalVnd)}</Text>

        <View style={styles.qrSection}>
          <TicketQr token={token} />
          <Text style={styles.qrCaption}>Scan at boarding</Text>
        </View>

        <Text style={styles.footer}>
          Present this ticket and a matching ID at boarding. Seat assigned at the operator counter.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Render a booking to a ticket-PDF Buffer with an embedded boarding QR.
 *
 * `confirmationToken` is required to mint the Issue-071 lookup token (the QR
 * payload = { ref, ct } only, no PII). It is NOT on CustomerBookingDetail (that
 * DTO deliberately omits the secret), so callers pass it explicitly — the
 * generate-once job reads it alongside the booking; the legacy request path
 * (kept for the 202/redirect fallback) passes it from its own read.
 */
export async function renderTicketPdf(
  booking: CustomerBookingDetail,
  confirmationToken: string
): Promise<Buffer> {
  const token = await mintTicketToken({
    bookingRef: booking.bookingRef,
    confirmationToken,
  });
  return renderToBuffer(<TicketDocument booking={booking} token={token} />);
}
