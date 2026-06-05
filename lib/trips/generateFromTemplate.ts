/**
 * generateFromTemplate — cron worker that generates Trip rows from RecurringTripTemplates.
 *
 * Issue 013 AC5:
 *   - 14-day horizon from today
 *   - Idempotent via partial unique (recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL
 *   - Skip reasons logged to RecurringGenerationLog
 *   - PATCH on one Trip does NOT affect siblings (each Trip is independent)
 *
 * dayOfWeek mapping: ISO 8601 → daysOfMask bit:
 *   Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { fromZonedTime } from 'date-fns-tz';
import { addDays, parseISO, format } from 'date-fns';
import { randomUUID } from 'crypto';

const TZ = 'Asia/Ho_Chi_Minh';
const HORIZON_DAYS = 14;

// ISO weekday (1=Mon .. 7=Sun) → daysOfMask bit
const WEEKDAY_BIT: Record<number, number> = {
  1: 1,   // Mon
  2: 2,   // Tue
  3: 4,   // Wed
  4: 8,   // Thu
  5: 16,  // Fri
  6: 32,  // Sat
  7: 64,  // Sun
};

export interface GenerateResult {
  generated: number;
  skipped: number;
  failed: number;
}

export async function generateTripsFromTemplates(
  referenceDate?: Date
): Promise<GenerateResult> {
  const today = referenceDate ?? new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const horizonStr = format(addDays(today, HORIZON_DAYS - 1), 'yyyy-MM-dd');

  // Fetch all active templates (not deactivated, validFrom ≤ today+14, validUntil ≥ today)
  const templates = await prisma.recurringTripTemplate.findMany({
    where: {
      deactivatedAt: null,
      validFrom: { lte: new Date(horizonStr) },
      validUntil: { gte: new Date(todayStr) },
    },
    include: {
      bus: {
        select: {
          id: true,
          deactivatedAt: true,
          maintenanceStart: true,
          maintenanceEnd: true,
        },
      },
    },
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const template of templates) {
    // Iterate each day in the horizon
    for (let dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset++) {
      const targetDate = addDays(today, dayOffset);
      const dateStr = format(targetDate, 'yyyy-MM-dd');

      // Check validFrom / validUntil bounds
      if (dateStr < format(template.validFrom, 'yyyy-MM-dd') ||
          dateStr > format(template.validUntil, 'yyyy-MM-dd')) {
        continue;
      }

      // Check daysOfMask (ISO weekday 1=Mon..7=Sun)
      const isoWeekday = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      const bit = WEEKDAY_BIT[isoWeekday] ?? 0;
      if ((template.daysOfMask & bit) === 0) {
        continue;
      }

      // Compute departure UTC from local HH:MM
      const [hh, mm] = template.departureLocalTime.split(':').map(Number);
      const localDatetimeStr = `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
      const departureAt = fromZonedTime(parseISO(localDatetimeStr), TZ);

      // Check bus availability
      const bus = template.bus;
      let skipReason: string | null = null;

      if (bus.deactivatedAt !== null) {
        skipReason = 'bus_deactivated';
      } else if (
        bus.maintenanceStart !== null &&
        bus.maintenanceEnd !== null &&
        bus.maintenanceStart <= departureAt &&
        departureAt < bus.maintenanceEnd
      ) {
        skipReason = 'bus_in_maintenance';
      }

      if (skipReason) {
        await prisma.recurringGenerationLog.create({
          data: {
            id: randomUUID().replace(/-/g, '').slice(0, 25),
            templateId: template.id,
            date: new Date(dateStr),
            status: 'skipped',
            skipReason,
          },
        });
        skipped++;
        continue;
      }

      // Idempotent upsert via partial unique index
      // Use createMany with skipDuplicates for idempotency
      try {
        const tripId = randomUUID().replace(/-/g, '').slice(0, 25);
        await prisma.$transaction(async (tx) => {
          // Attempt to create the trip; if duplicate (partial unique) → skip
          const existing = await tx.trip.findFirst({
            where: {
              recurringTemplateId: template.id,
              departureAt,
            },
            select: { id: true },
          });

          if (existing) {
            // Already generated — log as skipped/idempotent
            await tx.recurringGenerationLog.create({
              data: {
                id: randomUUID().replace(/-/g, '').slice(0, 25),
                templateId: template.id,
                tripId: existing.id,
                date: new Date(dateStr),
                status: 'skipped',
                skipReason: 'already_exists',
              },
            });
            return 'skipped';
          }

          const trip = await tx.trip.create({
            data: {
              id: tripId,
              routeId: template.routeId,
              busId: template.busId,
              operatorId: template.operatorId,
              departureAt,
              price: template.price,
              status: 'scheduled',
              salesClosed: false,
              blockedSeats: 0,
              recurringTemplateId: template.id,
            },
          });

          await tx.recurringGenerationLog.create({
            data: {
              id: randomUUID().replace(/-/g, '').slice(0, 25),
              templateId: template.id,
              tripId: trip.id,
              date: new Date(dateStr),
              status: 'generated',
            },
          });

          return 'generated';
        }).then((outcome) => {
          if (outcome === 'generated') generated++;
          else skipped++;
        });
      } catch {
        await prisma.recurringGenerationLog.create({
          data: {
            id: randomUUID().replace(/-/g, '').slice(0, 25),
            templateId: template.id,
            date: new Date(dateStr),
            status: 'failed',
            skipReason: 'transaction_error',
          },
        });
        failed++;
      }
    }
  }

  return { generated, skipped, failed };
}

// ---------------------------------------------------------------------------
// Recurring template CRUD helpers
// ---------------------------------------------------------------------------

import type { TemplateDto } from './tripDto';

export function toTemplateDto(t: {
  id: string;
  operatorId: string;
  routeId: string;
  busId: string;
  departureLocalTime: string;
  daysOfMask: number;
  price: number;
  validFrom: Date;
  validUntil: Date;
  deactivatedAt: Date | null;
}): TemplateDto {
  return {
    id: t.id,
    operatorId: t.operatorId,
    routeId: t.routeId,
    busId: t.busId,
    departureLocalTime: t.departureLocalTime,
    daysOfMask: t.daysOfMask,
    price: t.price,
    validFrom: format(t.validFrom, 'yyyy-MM-dd'),
    validUntil: format(t.validUntil, 'yyyy-MM-dd'),
    deactivatedAt: t.deactivatedAt ? t.deactivatedAt.toISOString() : null,
  };
}

export async function createTemplate(
  operatorId: string,
  input: {
    routeId: string;
    busId: string;
    price: number;
    departureLocalTime: string;
    daysOfMask: number;
    validFrom: string;
    validUntil: string;
  }
): Promise<TemplateDto> {
  const template = await prisma.recurringTripTemplate.create({
    data: {
      operatorId,
      routeId: input.routeId,
      busId: input.busId,
      price: input.price,
      departureLocalTime: input.departureLocalTime,
      daysOfMask: input.daysOfMask,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
    },
  });
  return toTemplateDto(template);
}

export async function getTemplate(
  operatorId: string,
  templateId: string
): Promise<TemplateDto | null> {
  const t = await prisma.recurringTripTemplate.findFirst({
    where: withOperatorScope(operatorId, { where: { id: templateId } }).where,
  });
  if (!t) return null;
  return toTemplateDto(t);
}

export async function listTemplates(operatorId: string): Promise<TemplateDto[]> {
  const templates = await prisma.recurringTripTemplate.findMany({
    where: withOperatorScope(operatorId).where,
    orderBy: { createdAt: 'asc' },
  });
  return templates.map(toTemplateDto);
}

export async function patchTemplate(
  operatorId: string,
  templateId: string,
  patch: {
    price?: number;
    departureLocalTime?: string;
    daysOfMask?: number;
    validFrom?: string;
    validUntil?: string;
    busId?: string;
    deactivatedAt?: Date | null;
  }
): Promise<TemplateDto | null> {
  const existing = await prisma.recurringTripTemplate.findFirst({
    where: withOperatorScope(operatorId, { where: { id: templateId } }).where,
    select: { id: true },
  });
  if (!existing) return null;

  // Scope the mutating UPDATE to { id, operatorId } too (not just id) so the
  // write is tenant-bound atomically — closes the TOCTOU between the ownership
  // check above and this update (issue 092b, rule-5 tenant scope).
  const updated = await prisma.recurringTripTemplate.update({
    where: { id: templateId, operatorId },
    data: {
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.departureLocalTime !== undefined ? { departureLocalTime: patch.departureLocalTime } : {}),
      ...(patch.daysOfMask !== undefined ? { daysOfMask: patch.daysOfMask } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: new Date(patch.validFrom) } : {}),
      ...(patch.validUntil !== undefined ? { validUntil: new Date(patch.validUntil) } : {}),
      ...(patch.busId !== undefined ? { busId: patch.busId } : {}),
      ...(patch.deactivatedAt !== undefined ? { deactivatedAt: patch.deactivatedAt } : {}),
    },
  });
  return toTemplateDto(updated);
}
