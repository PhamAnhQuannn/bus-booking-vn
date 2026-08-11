/**
 * Shared client-side buyer-info validation for the checkout form.
 *
 * Extracted from the former CustomerForm so the merged checkout page
 * (CheckoutClient) reuses the exact same Zod rules instead of copy-pasting them.
 * Client-safe (pure Zod, no I/O). The soft-gate email typo nudge lives in
 * lib/booking/emailSuggest (suggestEmail) and is applied by the caller.
 */

import { z } from 'zod';

export const customerFormSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập họ tên')
    .min(4, 'Họ tên phải có ít nhất 4 ký tự')
    .max(100, 'Họ tên không được vượt quá 100 ký tự')
    .regex(/^[\p{L}\p{M}\s'.-]+$/u, 'Họ tên chỉ được chứa chữ cái, dấu cách và các ký tự hợp lệ'),
  buyerPhone: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập số điện thoại')
    .regex(
      /^(0|\+84)[35789][0-9]{8}$/,
      'Số điện thoại không hợp lệ. Nhập số di động Việt Nam 10 chữ số bắt đầu bằng 0 hoặc +84, VD: 0912345678.',
    ),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Vui lòng nhập email để nhận vé')
    .max(254, 'Email không được vượt quá 254 ký tự')
    .email('Email không hợp lệ'),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;
