/**
 * Zod schemas for operator staff management (Issue 017).
 *
 * Wire fields: name (displayName) + phone (E.164-normalizable VN mobile).
 * Phone is validated for normalizability here; createStaff re-normalizes
 * to the canonical +84 form before persistence.
 *
 * PATCH is name-only in V1 — role is immutable (admins cannot be demoted /
 * staff cannot be promoted through this endpoint).
 */

import { z } from 'zod';
import { normalizePhone } from '@/lib/auth/phoneNormalize';

const DISPLAY_NAME = z.string().trim().min(1).max(120);

const PHONE = z.string().trim().min(1).refine(
  (raw) => {
    try {
      normalizePhone(raw);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'invalid VN phone number' }
);

// ---------------------------------------------------------------------------
// POST /api/op/staff
// ---------------------------------------------------------------------------

export const CreateStaffSchema = z.object({
  name: DISPLAY_NAME,
  phone: PHONE,
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/op/staff/[id]
// ---------------------------------------------------------------------------

export const UpdateStaffSchema = z.object({
  name: DISPLAY_NAME,
});

export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/staff/[id]/assign-service
// ---------------------------------------------------------------------------

export const AssignServiceSchema = z.object({
  tripId: z.string().trim().min(1),
});

export type AssignServiceInput = z.infer<typeof AssignServiceSchema>;
