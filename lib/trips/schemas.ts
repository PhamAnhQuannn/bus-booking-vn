/**
 * Zod request body schemas for operator trip mutation routes (Issue 014).
 */

import { z } from 'zod';

// depart and complete have no body — actions are implicit
export const DepartTripSchema = z.object({}).strict();
export const CompleteTripSchema = z.object({}).strict();
