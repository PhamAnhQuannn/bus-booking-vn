/**
 * Component test for the register-page resend-OTP cooldown (issue 022).
 *
 * Drives the phone-step form via fireEvent.submit (NOT by typing into the base-ui Input —
 * see the Issue 002 Mistake Log: base-ui Input owns onChange and synthetic keystrokes are
 * flaky). The cooldown behavior is independent of the phone value, so an empty submit is
 * sufficient to reach the OTP step.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import RegisterPage from '../page';

function mockFetchOnce(ok: boolean, body: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);
}

describe('register resend-OTP cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.cookie = 'bb_csrf=testtoken';
    pushMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function reachOtpStep() {
    render(<RegisterPage />);
    const submitBtn = screen.getByRole('button', { name: 'Gửi mã OTP' });
    await act(async () => {
      fireEvent.submit(submitBtn.closest('form')!);
      await vi.advanceTimersByTimeAsync(0); // flush the async sendOtp()
    });
  }

  // Step the 1s cooldown timer `seconds` times. The useEffect reschedules a fresh
  // setTimeout on each decrement, so advance one second per act() to let each
  // re-render settle (a single large jump leaves the recursively-scheduled timers unfired).
  async function tickSeconds(seconds: number) {
    for (let i = 0; i < seconds; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
  }

  it('disables resend with a countdown immediately after OTP is sent, re-enables at 0', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(true));
    await reachOtpStep();

    const resend = screen.getByRole('button', { name: /Gửi lại mã sau 30s/ }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);

    // tick the cooldown to zero
    await tickSeconds(30);

    const ready = screen.getByRole('button', { name: 'Gửi lại mã' }) as HTMLButtonElement;
    expect(ready.disabled).toBe(false);
  });

  it('seeds the cooldown from retryAfter on a rate_limited resend', async () => {
    // first send succeeds → reach OTP step with 30s cooldown
    vi.stubGlobal('fetch', mockFetchOnce(true));
    await reachOtpStep();

    // let cooldown lapse so resend is allowed
    await tickSeconds(30);

    // next send is rate-limited with retryAfter: 45
    vi.stubGlobal('fetch', mockFetchOnce(false, { error: 'rate_limited', retryAfter: 45 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
      await vi.advanceTimersByTimeAsync(0);
    });

    const limited = screen.getByRole('button', { name: /Gửi lại mã sau 45s/ }) as HTMLButtonElement;
    expect(limited.disabled).toBe(true);
  });
});
