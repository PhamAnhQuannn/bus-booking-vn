import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getAccessToken,
  setAccessToken,
  getDisplayName,
  setDisplayName,
  getCustomerEmail,
  setCustomerEmail,
  clearSession,
  useIsSignedIn,
  authFetch,
  ensureAuthenticated,
} from '../clientSession';

function fakeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const payload = btoa(JSON.stringify({ sub: 'test', exp }));
  return `${header}.${payload}.fakesig`;
}

const FAR_FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600; // 1h from now
const TOKEN = fakeJwt(FAR_FUTURE_EXP);

beforeEach(() => {
  document.cookie = 'bb_csrf=testcsrf';
});

afterEach(() => {
  clearSession();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('clientSession — flat getters/setters', () => {
  it('getAccessToken / setAccessToken round-trip', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken(TOKEN);
    expect(getAccessToken()).toBe(TOKEN);
  });

  it('getDisplayName / setDisplayName round-trip', () => {
    expect(getDisplayName()).toBeNull();
    setDisplayName('Nguyen Van A');
    expect(getDisplayName()).toBe('Nguyen Van A');
  });

  it('getCustomerEmail / setCustomerEmail round-trip', () => {
    expect(getCustomerEmail()).toBeNull();
    setCustomerEmail('0901234567');
    expect(getCustomerEmail()).toBe('0901234567');
  });

  it('clearSession nulls all three fields', () => {
    setAccessToken(TOKEN);
    setDisplayName('Name');
    setCustomerEmail('0901234567');
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getDisplayName()).toBeNull();
    expect(getCustomerEmail()).toBeNull();
  });
});

describe('clientSession — reactive hooks', () => {
  it('useIsSignedIn reflects sign-in / sign-out', () => {
    const { result } = renderHook(() => useIsSignedIn());
    expect(result.current).toBe(false);

    act(() => {
      setAccessToken(TOKEN);
    });
    expect(result.current).toBe(true);

    act(() => {
      clearSession();
    });
    expect(result.current).toBe(false);
  });
});

describe('authFetch', () => {
  it('attaches Bearer header when token present', async () => {
    setAccessToken(TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/x');

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('omits Bearer header when no token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/x');

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('attaches X-CSRF-Token for POST, omits for GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/x', { method: 'POST' });
    const postHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(postHeaders.get('X-CSRF-Token')).toBe('testcsrf');

    fetchMock.mockClear();
    await authFetch('/api/x', { method: 'GET' });
    const getHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(getHeaders.has('X-CSRF-Token')).toBe(false);
  });

  it('on 401, calls refresh and replays with the new token', async () => {
    setAccessToken(TOKEN);
    const newToken = fakeJwt(FAR_FUTURE_EXP + 100);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // original call
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: newToken }), { status: 200 }),
      ) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 })); // retry
    vi.stubGlobal('fetch', fetchMock);

    const res = await authFetch('/api/x');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1].headers);
    expect(retryHeaders.get('Authorization')).toBe(`Bearer ${newToken}`);
    expect(getAccessToken()).toBe(newToken);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('on 401 + refresh failure, clears the session and returns the original 401', async () => {
    setAccessToken(TOKEN);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // original
      .mockResolvedValueOnce(new Response('{}', { status: 401 })); // refresh fails
    vi.stubGlobal('fetch', fetchMock);

    const res = await authFetch('/api/x');

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no retry attempted
    expect(getAccessToken()).toBeNull();
  });

  it('concurrent 401s share a single refresh call (single-flight)', async () => {
    setAccessToken(TOKEN);
    const newToken = fakeJwt(FAR_FUTURE_EXP + 100);
    let refreshCalls = 0;
    const seenPerUrl: Record<string, number> = {};
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') {
        refreshCalls += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: newToken }), { status: 200 }),
        );
      }
      seenPerUrl[url] = (seenPerUrl[url] ?? 0) + 1;
      const status = seenPerUrl[url] === 1 ? 401 : 200;
      return Promise.resolve(new Response('{}', { status }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const [res1, res2] = await Promise.all([authFetch('/api/a'), authFetch('/api/b')]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(refreshCalls).toBe(1);
  });
});

describe('ensureAuthenticated', () => {
  it('returns true when a token is already present, without calling fetch', async () => {
    setAccessToken(TOKEN);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureAuthenticated()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attempts a refresh when no token is present, returns true on success', async () => {
    const newToken = fakeJwt(FAR_FUTURE_EXP);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ accessToken: newToken }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureAuthenticated()).resolves.toBe(true);
    expect(getAccessToken()).toBe(newToken);
  });

  it('returns false when no token is present and refresh fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureAuthenticated()).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});

describe('proactive refresh timer', () => {
  it('setAccessToken schedules a refresh call ~60s before the token expiry', async () => {
    vi.useFakeTimers();
    const nowSec = Math.floor(Date.now() / 1000);
    const shortExp = nowSec + 120; // 2 min out → fires at (120-60)s = 60s
    const token = fakeJwt(shortExp);
    const newToken = fakeJwt(shortExp + 3600);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ accessToken: newToken }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    setAccessToken(token);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.any(Object));
    expect(getAccessToken()).toBe(newToken);
  });

  it('setAccessToken(null) cancels any pending proactive refresh', async () => {
    vi.useFakeTimers();
    const nowSec = Math.floor(Date.now() / 1000);
    const shortExp = nowSec + 120;
    const token = fakeJwt(shortExp);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    setAccessToken(token);
    setAccessToken(null);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
