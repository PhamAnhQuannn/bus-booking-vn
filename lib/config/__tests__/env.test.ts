/**
 * Unit tests for getEnv()'s boot-time email-stub warning (#337).
 *
 * Email delivery is gated on EMAIL_PROVIDER alone (decoupled from NOTIFY_STUB —
 * see the EMAIL_PROVIDER schema + email.ts). So a real env (NOTIFY_STUB=false →
 * real eSMS) with EMAIL_PROVIDER unset SILENTLY stubs email. getEnv() emits a
 * one-time console.warn for exactly that combination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, _resetEnvCache } from '../env';

// Self-sufficient base so parsing does not depend on the ambient env: force the
// other subsystems to stub mode (so their superRefine credential checks pass)
// and supply the always-required HOLD_SECRET + eSMS creds (eSMS required because
// NOTIFY_STUB=false below). Production-required JWT secrets are gated on
// NODE_ENV=production, so they are not needed in the test runtime.
const BASE = {
  HOLD_SECRET: 'a'.repeat(64), // must be a hex string
  PAYMENTS_STUB: 'true',
  STORAGE_STUB: 'true',
  ESMS_API_KEY: 'k',
  ESMS_SECRET_KEY: 's',
  ESMS_BRANDNAME: 'BBVN',
};

let savedEnv: NodeJS.ProcessEnv;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = { ...process.env };
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  _resetEnvCache();
});

afterEach(() => {
  process.env = savedEnv;
  warnSpy.mockRestore();
  _resetEnvCache();
});

function warned(): boolean {
  return warnSpy.mock.calls.some((c: unknown[]) => String(c[0]).includes('env.email.silently_stubbed'));
}

describe('getEnv — email-stub boot warn (#337)', () => {
  it('warns when NOTIFY_STUB=false and EMAIL_PROVIDER is unset (silently stubbed)', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'false' });
    delete process.env.EMAIL_PROVIDER;

    getEnv();

    expect(warned()).toBe(true);
  });

  it('does NOT warn when EMAIL_PROVIDER=resend (real email wired)', () => {
    Object.assign(process.env, BASE, {
      NOTIFY_STUB: 'false',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
    });

    getEnv();

    expect(warned()).toBe(false);
  });

  it('does NOT warn when NOTIFY_STUB=true (SMS also stubbed — consistent)', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'true' });
    delete process.env.EMAIL_PROVIDER;

    getEnv();

    expect(warned()).toBe(false);
  });
});
