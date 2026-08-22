/**
 * RTL/unit test for the customer login page (#480) — the page had no component test; all auth
 * coverage hit /api/auth/login directly. Covers the DOM affordances + client-side branches:
 * field rendering, password eye-toggle, the credential/lockout/rate-limit error mapping, the
 * Google-callback error banner, and a successful login stashing the token + redirecting.
 *
 * FormData is read from the DOM (handleLogin does `new FormData(e.currentTarget)`), so inputs are
 * populated by setting the native value directly + fireEvent.submit — avoids the base-ui Input
 * synthetic-keystroke flakiness noted in the Issue 002 mistake log.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let currentParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => currentParams,
}));

const setAccessTokenMock = vi.fn();
const setDisplayNameMock = vi.fn();
const setCustomerEmailMock = vi.fn();
vi.mock('@/lib/auth/clientSession', () => ({
  setAccessToken: (...a: unknown[]) => setAccessTokenMock(...a),
  setDisplayName: (...a: unknown[]) => setDisplayNameMock(...a),
  setCustomerEmail: (...a: unknown[]) => setCustomerEmailMock(...a),
  useAuthStatus: () => 'guest', // never 'authed' → no redirect-away in the mount effect
}));

vi.mock('@/lib/auth/csrfClient', () => ({ readCsrfToken: () => 'testtoken' }));

// GoogleSignInButton pulls client OAuth wiring; stub it to a plain button so this stays a
// login-form unit test (the Google round trip is covered by an e2e).
vi.mock('@/components/auth/GoogleSignInButton', async () => {
  const React = await import('react');
  return {
    GoogleSignInButton: () =>
      React.createElement('button', { type: 'button', 'data-testid': 'google-btn' }, 'Google'),
  };
});

import LoginPage from '../page';

function fillAndSubmit(email: string, password: string) {
  const emailInput = screen.getByLabelText('Địa chỉ email') as HTMLInputElement;
  const pwInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
  emailInput.value = email;
  pwInput.value = password;
  fireEvent.submit(emailInput.closest('form')!);
}

function mockFetch(ok: boolean, status: number, body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, json: async () => body } as Response));
}

describe('LoginPage', () => {
  beforeEach(() => {
    currentParams = new URLSearchParams();
    pushMock.mockClear();
    replaceMock.mockClear();
    setAccessTokenMock.mockClear();
    document.cookie = 'bb_csrf=testtoken';
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the email + password fields, submit, and auth links', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Địa chỉ email')).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Đăng ký ngay/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Đăng nhập nhà xe/ })).toBeTruthy();
    expect(screen.getByTestId('google-btn')).toBeTruthy();
  });

  it('password eye-toggle flips the input between password and text', () => {
    render(<LoginPage />);
    const pw = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(pw.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(pw.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(pw.type).toBe('password');
  });

  it('shows the credential error on a 401', async () => {
    mockFetch(false, 401, { error: 'invalid_credentials' });
    render(<LoginPage />);
    await act(async () => {
      fillAndSubmit('a@example.com', 'WrongPass1');
    });
    await waitFor(() => expect(screen.getByText('Email hoặc mật khẩu không đúng.')).toBeTruthy());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows the lockout message on a 429 LOCKED_OUT', async () => {
    mockFetch(false, 429, { error: 'LOCKED_OUT' });
    render(<LoginPage />);
    await act(async () => {
      fillAndSubmit('a@example.com', 'WrongPass1');
    });
    await waitFor(() => expect(screen.getByText(/tạm khóa/)).toBeTruthy());
  });

  it('stashes the token + redirects on a successful login', async () => {
    mockFetch(true, 200, { accessToken: 'tok-123', customer: { displayName: 'Quân', email: 'a@example.com' } });
    render(<LoginPage />);
    await act(async () => {
      fillAndSubmit('a@example.com', 'Password1');
    });
    await waitFor(() => expect(setAccessTokenMock).toHaveBeenCalledWith('tok-123'));
    expect(pushMock).toHaveBeenCalled();
  });

  it('shows the Google-callback error banner when ?error=google', () => {
    currentParams = new URLSearchParams('error=google');
    render(<LoginPage />);
    expect(screen.getByText(/Đăng nhập Google thất bại/)).toBeTruthy();
  });
});
