/**
 * Zod schemas for auth endpoints.
 *
 * email: trimmed, valid format, max 254 chars.
 * phoneNumber: VN local (0...) and international (+84...) formats.
 * password: 8–128 chars, ≥1 letter, ≥1 digit.
 * otpCode: exactly 6 digits.
 */

import { z } from 'zod';

const emailSchema = z.string().trim().email().max(254);

const phoneSchema = z.string().trim().regex(/^(0|\+84)[35789][0-9]{8}$/);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const registerInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(100).optional(),
});

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// 2026-06-06: operators log in by generated username (BRAND_ACRONYM-last4phone), not phone.
export const operatorLoginInput = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required'),
});

export const otpSendInput = z.object({
  email: emailSchema,
});

export const otpVerifyInput = z.object({
  email: emailSchema,
  code: z
    .string()
    .length(6, 'OTP code must be exactly 6 digits')
    .regex(/^[0-9]{6}$/, 'OTP code must be numeric'),
});

export { phoneSchema };
export type RegisterInput = z.infer<typeof registerInput>;
export type LoginInput = z.infer<typeof loginInput>;
export type OperatorLoginInput = z.infer<typeof operatorLoginInput>;
export type OtpSendInput = z.infer<typeof otpSendInput>;
export type OtpVerifyInput = z.infer<typeof otpVerifyInput>;
