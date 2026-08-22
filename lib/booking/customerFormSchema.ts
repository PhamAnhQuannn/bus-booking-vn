/**
 * Shared client-side buyer-info validation for the checkout form.
 *
 * Extracted from the former CustomerForm so the merged checkout page
 * (CheckoutClient) reuses the exact same Zod rules instead of copy-pasting them.
 * Client-safe (pure Zod, no I/O). The soft-gate email typo nudge lives in
 * lib/booking/emailSuggest (suggestEmail) and is applied by the caller.
 *
 * i18n (P2c): each issue message is a next-intl catalog KEY under the `booking`
 * namespace (`checkoutValidation.*`), NOT literal text. The caller resolves it
 * with `t(iss.message)` at render (CheckoutClient) so the same schema serves both
 * locales. Consumers that only read `.success` (never the message) are unaffected.
 */

import { z } from 'zod';

export const customerFormSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(1, 'checkoutValidation.reqName')
    .min(4, 'checkoutValidation.minName')
    .max(100, 'checkoutValidation.maxName')
    .regex(/^[\p{L}\p{M}\s'.-]+$/u, 'checkoutValidation.regexName'),
  buyerPhone: z
    .string()
    .trim()
    .min(1, 'checkoutValidation.reqPhone')
    .regex(/^(0|\+84)[35789][0-9]{8}$/, 'checkoutValidation.regexPhone'),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'checkoutValidation.reqEmail')
    .max(254, 'checkoutValidation.maxEmail')
    .email('checkoutValidation.invalidEmail'),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;
