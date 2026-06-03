/**
 * Customer-facing status labels + badge colours for the 8-value booking payment
 * status enum (Issue 009, PRD story 15). Shared by the list and detail pages.
 */

import type { BookingPaymentStatus } from '@/lib/booking/bookingDto';
import type { badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export const STATUS_LABEL: Record<BookingPaymentStatus, string> = {
  awaiting_payment: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  trip_cancelled: 'Chuyến bị huỷ',
  no_show: 'Không có mặt',
  payment_failed_expired: 'Thanh toán thất bại',
  // Issue 100: oversold-race refund — booking was paid but seat was gone
  refunded: 'Đã hoàn tiền (hết chỗ)',
};

/** Maps each payment status to a semantic Badge variant (design-system tokens). */
export const STATUS_VARIANT: Record<BookingPaymentStatus, BadgeVariant> = {
  awaiting_payment: 'pending',
  paid: 'success',
  completed: 'success',
  cancelled: 'neutral',
  trip_cancelled: 'danger',
  no_show: 'danger',
  payment_failed_expired: 'danger',
  refunded: 'danger', // Issue 100: oversold-race refund
};
