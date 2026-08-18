/**
 * #620: a Resend `{error}` response must map 5xx / 429 / transient shapes to the
 * AMBIGUOUS 'unknown' outcome (hold the idempotency-key salt → the retry reuses the
 * key and Resend dedupes), and reserve 'rejected' for a DEFINITE 4xx validation
 * refusal (safe to re-key). This matters most on the inline hot path, where a single
 * Resend 5xx would otherwise re-key and duplicate-email every booking.
 */

import { describe, it, expect } from 'vitest';
import { classifyResendError } from '../email';

describe('classifyResendError (#620)', () => {
  it('5xx statusCode → unknown', () => {
    expect(classifyResendError({ statusCode: 500, name: 'application_error', message: 'x' })).toBe('unknown');
    expect(classifyResendError({ statusCode: 503, name: 'x', message: 'x' })).toBe('unknown');
  });

  it('429 statusCode → unknown', () => {
    expect(classifyResendError({ statusCode: 429, name: 'rate_limit_exceeded', message: 'x' })).toBe('unknown');
  });

  it('4xx validation statusCode → rejected', () => {
    expect(classifyResendError({ statusCode: 422, name: 'validation_error', message: 'x' })).toBe('rejected');
    expect(classifyResendError({ statusCode: 400, name: 'invalid_to', message: 'x' })).toBe('rejected');
  });

  it('no statusCode → falls back to transient error name → unknown', () => {
    expect(classifyResendError({ name: 'rate_limit_exceeded', message: 'x' })).toBe('unknown');
    expect(classifyResendError({ name: 'internal_server_error', message: 'x' })).toBe('unknown');
    expect(classifyResendError({ statusCode: null, name: 'application_error', message: 'x' })).toBe('unknown');
  });

  it('no statusCode, non-transient/unknown name → rejected (validation-shaped default)', () => {
    expect(classifyResendError({ name: 'validation_error', message: 'x' })).toBe('rejected');
    expect(classifyResendError({ name: '', message: 'x' })).toBe('rejected');
  });
});
