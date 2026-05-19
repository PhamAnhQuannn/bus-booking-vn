/**
 * Zod schemas for auth endpoints.
 *
 * phoneNumber: accepts VN local (0...) and international (+84...) formats for
 * 03x, 05x, 07x, 08x, 09x prefixes.
 * password: 8–128 chars, ≥1 letter, ≥1 digit.
 * otpCode: exactly 6 digits.
 */

import { z } from 'zod';

const phoneSchema = z.string().trim().regex(/^(0|\+84)[35789][0-9]{8}$/);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const registerInput = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(100).optional(),
});

export const loginInput = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Password is required'),
});

export const otpSendInput = z.object({
  phone: phoneSchema,
});

export const otpVerifyInput = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .length(6, 'OTP code must be exactly 6 digits')
    .regex(/^[0-9]{6}$/, 'OTP code must be numeric'),
});

export type RegisterInput = z.infer<typeof registerInput>;
export type LoginInput = z.infer<typeof loginInput>;
export type OtpSendInput = z.infer<typeof otpSendInput>;
export type OtpVerifyInput = z.infer<typeof otpVerifyInput>;
