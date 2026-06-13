/**
 * NotificationLog repository — append-only audit of SMS dispatch attempts.
 *
 * Writes are best-effort: if recording the log fails we surface the error
 * but never roll back the booking the log was attached to. The booking row
 * is the source of truth; NotificationLog is for ops debugging.
 */

import { prisma } from '@/lib/core/db/client';
import type { NotificationStatus, NotificationChannel } from '@prisma/client';

export interface CreateNotificationLogInput {
  bookingId?: string | null;
  channel?: NotificationChannel;
  template: string;
  recipient: string;
  payload: string;
  status: NotificationStatus;
  externalRef?: string | null;
  sentAt?: Date | null;
  attemptCount?: number;
}

export async function createNotificationLog(input: CreateNotificationLogInput) {
  return prisma.notificationLog.create({
    data: {
      bookingId: input.bookingId ?? null,
      channel: input.channel ?? 'sms',
      template: input.template,
      recipient: input.recipient,
      payload: input.payload,
      status: input.status,
      externalRef: input.externalRef ?? null,
      sentAt: input.sentAt ?? null,
      ...(input.attemptCount !== undefined && { attemptCount: input.attemptCount }),
    },
  });
}
