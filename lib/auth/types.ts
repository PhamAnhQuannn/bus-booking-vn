/**
 * Shared Zod schemas and TypeScript types for the auth endpoints.
 *
 * Issue 010 — extends the existing customer auth contract with an operator scope
 * discriminated union on the shared POST /api/auth/login endpoint.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const phoneSchema = z.string().trim().regex(/^(0|\+84)[35789][0-9]{8}$/);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

// ---------------------------------------------------------------------------
// POST /api/auth/login — discriminated union on scope
// ---------------------------------------------------------------------------

export const LoginCustomerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
  scope: z.literal('customer'),
});

export const LoginOperatorSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
  scope: z.literal('operator'),
});

export const LoginRequestSchema = z.discriminatedUnion('scope', [
  LoginCustomerSchema,
  LoginOperatorSchema,
]);

// No-scope variant for backward compat (defaults to 'customer')
export const LoginNoScopeSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
  scope: z.undefined().optional(),
});

export type LoginCustomerInput = z.infer<typeof LoginCustomerSchema>;
export type LoginOperatorInput = z.infer<typeof LoginOperatorSchema>;
export type LoginRequestInput = z.infer<typeof LoginRequestSchema>;

// ---------------------------------------------------------------------------
// Operator profile
// ---------------------------------------------------------------------------

export const OperatorProfileSchema = z.object({
  phone: z.string(),
  contactPhone: z.string(),
  notificationPhone: z.string(),
  displayName: z.string(),
  requiresPasswordChange: z.boolean(),
});

export type OperatorProfile = z.infer<typeof OperatorProfileSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/op/profile body
// ---------------------------------------------------------------------------

// Blank string from an untouched form field means "no change" — coerce '' →
// undefined BEFORE the phone-format check so leaving a phone empty doesn't 400
// the whole PATCH. Scoped here only; the shared phoneSchema (login) stays strict.
const optionalPhoneSchema = z.preprocess(
  (v) => (v === '' ? undefined : v),
  phoneSchema.optional()
);

export const PatchOperatorProfileSchema = z.object({
  contactPhone: optionalPhoneSchema,
  notificationPhone: optionalPhoneSchema,
  displayName: z.string().trim().min(2).max(100).optional(),
});

export type PatchOperatorProfileInput = z.infer<typeof PatchOperatorProfileSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/auth/password/change
// ---------------------------------------------------------------------------

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/auth/forgot-password
// ---------------------------------------------------------------------------

export const ForgotPasswordSchema = z.object({
  phone: phoneSchema,
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// ---------------------------------------------------------------------------
// POST /api/op/auth/forgot-password/verify (operator — phone-based)
// ---------------------------------------------------------------------------

export const ForgotPasswordVerifySchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .length(6, 'OTP code must be exactly 6 digits')
    .regex(/^[0-9]{6}$/, 'OTP code must be numeric'),
});

export type ForgotPasswordVerifyInput = z.infer<typeof ForgotPasswordVerifySchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password/verify (customer — email-based)
// ---------------------------------------------------------------------------

export const CustomerForgotPasswordVerifySchema = z.object({
  email: z.string().trim().email().max(254),
  code: z
    .string()
    .length(6, 'OTP code must be exactly 6 digits')
    .regex(/^[0-9]{6}$/, 'OTP code must be numeric'),
});

export type CustomerForgotPasswordVerifyInput = z.infer<typeof CustomerForgotPasswordVerifySchema>;

// ---------------------------------------------------------------------------
// POST /api/op/auth/forgot-password/reset
// ---------------------------------------------------------------------------

export const ForgotPasswordResetSchema = z.object({
  otpProof: z.string().min(1),
  newPassword: passwordSchema,
});

export type ForgotPasswordResetInput = z.infer<typeof ForgotPasswordResetSchema>;
