/**
 * Zod request body schemas for operator booking mutation routes (Issue 014).
 */

import { z } from 'zod';

export const CallOutcomeSchema = z.object({
  outcome: z.enum(['reached', 'no_answer', 'callback']),
  pickupPointId: z.string().optional(),
  pickupNote: z.string().max(500).optional(),
});

export type CallOutcomeInput = z.infer<typeof CallOutcomeSchema>;

export const EscalationSchema = z.object({
  note: z.string().min(1).max(1000),
});

export type EscalationInput = z.infer<typeof EscalationSchema>;

// cash-collected has no body: amount is server-derived from Booking.totalVnd (I7).
export const CashCollectedSchema = z.object({}).strict();
