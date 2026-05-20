/**
 * Customer-facing status labels + badge colours for the 8-value booking payment
 * status enum (Issue 009, PRD story 15). Shared by the list and detail pages.
 */

import type { BookingPaymentStatus } from '@/lib/booking/bookingDto';

export const STATUS_LABEL: Record<BookingPaymentStatus, string> = {
  awaiting_payment: 'Chờ thanh toán',
  pending_cash_payment: 'Chờ thu tiền mặt',
  paid_operator_notified: 'Đã thanh toán',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  trip_cancelled: 'Chuyến bị huỷ',
  no_show: 'Không có mặt',
  payment_failed_expired: 'Thanh toán thất bại',
};

export const STATUS_COLOR: Record<BookingPaymentStatus, string> = {
  awaiting_payment: '#b8860b',
  pending_cash_payment: '#b8860b',
  paid_operator_notified: '#2e7d32',
  completed: '#2e7d32',
  cancelled: '#999',
  trip_cancelled: '#c62828',
  no_show: '#c62828',
  payment_failed_expired: '#c62828',
};
