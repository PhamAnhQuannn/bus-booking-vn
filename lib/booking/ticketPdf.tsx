/**
 * renderTicketPdf — server-side PDF ticket generation for a customer booking
 * (Issue 009, PRD story 17).
 *
 * Renders booking ref, passenger name, ticket count, route, departure, operator
 * contact phone, and total. NO seat numbers (AC) — seat assignment is handled at
 * the operator counter, not printed on the customer ticket.
 *
 * Node-only: @react-pdf/renderer's renderToBuffer pulls in Node streams, so any
 * route importing this must run on the nodejs runtime.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
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
});

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

function TicketDocument({ booking }: { booking: CustomerBookingDetail }) {
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

        <Text style={styles.footer}>
          Present this ticket and a matching ID at boarding. Seat assigned at the operator counter.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderTicketPdf(booking: CustomerBookingDetail): Promise<Buffer> {
  return renderToBuffer(<TicketDocument booking={booking} />);
}
