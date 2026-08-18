/**
 * NotificationLog repository — append-only audit of SMS dispatch attempts.
 *
 * Writes are best-effort: if recording the log fails we surface the error
 * but never roll back the booking the log was attached to. The booking row
 * is the source of truth; NotificationLog is for ops debugging.
 */

import { prisma } from '@/lib/core/db/client';
import type { NotificationStatus, NotificationChannel, Prisma } from '@prisma/client';

/** Prisma client or an interactive-transaction handle (`$transaction` callback arg). */
type Db = typeof prisma | Prisma.TransactionClient;

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

/**
 * Create a NotificationLog row. Pass `db` = the interactive `tx` handle to enqueue
 * INSIDE a transaction (the row then commits atomically with it — used by the payment
 * webhook so a rolled-back booking never leaves an orphan "paid" notification). Omit
 * for the default best-effort ambient-client write.
 */
export async function createNotificationLog(input: CreateNotificationLogInput, db: Db = prisma) {
  return db.notificationLog.create({
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
