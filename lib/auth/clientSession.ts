/**
 * Client-safe customer session state (Issue 170 + Issue 168).
 *
 * Plain module (not a component) backed by a Zustand store — holds the
 * in-memory access token / display name / customer phone, a proactive
 * refresh timer keyed off the JWT `exp` claim, a single-flight refresh
 * against POST /api/auth/refresh, and an `authFetch` wrapper that attaches
 * the Bearer + CSRF headers and retries once on a 401.
 *
 * NO server-only imports here — this module (and its only dependency,
 * csrfClient) must stay safe for 'use client' components to deep-import.
 * Client components MUST import this file directly, never through the
 * `@/lib/auth` barrel (see AGENTS.md operator-smoke 2026-06-04 entry).
 */

import { create } from 'zustand';
import { readCsrfToken } from '@/lib/auth/csrfClient';

interface SessionState {
  accessToken: string | null;
  displayName: string | null;
  customerEmail: string | null;
}

const useSessionStore = create<SessionState>(() => ({
  accessToken: null,
  displayName: null,
  customerEmail: null,
}));

// ---- proactive refresh timer -----------------------------------------------

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/** Decode the `exp` claim (seconds since epoch) out of a JWT without verifying it. */
function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh(token: string): void {
  clearRefreshTimer();
  const exp = decodeExp(token);
  if (exp === null) return;
  const delayMs = (exp - Math.floor(Date.now() / 1000) - 60) * 1000;
  if (delayMs > 0) {
    refreshTimer = setTimeout(() => {
      void attemptRefresh();
    }, delayMs);
  }
}

// ---- flat get/set API (backward-compatible with the old module getters) ---

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}

export function setAccessToken(t: string | null): void {
  useSessionStore.setState({ accessToken: t });
  if (t) {
    scheduleProactiveRefresh(t);
  } else {
    clearRefreshTimer();
  }
}

export function getDisplayName(): string | null {
  return useSessionStore.getState().displayName;
}

export function setDisplayName(n: string | null): void {
  useSessionStore.setState({ displayName: n });
}

export function getCustomerEmail(): string | null {
  return useSessionStore.getState().customerEmail;
}

export function setCustomerEmail(p: string | null): void {
  useSessionStore.setState({ customerEmail: p });
}

export function clearSession(): void {
  clearRefreshTimer();
  useSessionStore.setState({ accessToken: null, displayName: null, customerEmail: null });
}

// ---- reactive hooks ---------------------------------------------------------

export function useIsSignedIn(): boolean {
  return useSessionStore((s) => s.accessToken !== null);
}

export function useDisplayName(): string | null {
  return useSessionStore((s) => s.displayName);
}

// ---- single-flight refresh --------------------------------------------------

let inFlight: Promise<string | null> | null = null;

function attemptRefresh(): Promise<string | null> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const json = await res.json();
      setAccessToken(json.accessToken);
      return json.accessToken as string;
    } catch {
      return null; // network error — don't clear session, token may still be valid
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// ---- authFetch ---------------------------------------------------------------

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', readCsrfToken());
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status !== 401) return res;

  // Attempt refresh + retry once
  const newToken = await attemptRefresh();
  if (!newToken) return res; // return original 401

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  if (method !== 'GET' && method !== 'HEAD') {
    if (!retryHeaders.has('X-CSRF-Token')) retryHeaders.set('X-CSRF-Token', readCsrfToken());
  }
  return fetch(input, { ...init, headers: retryHeaders });
}

// ---- ensureAuthenticated ------------------------------------------------------

export async function ensureAuthenticated(): Promise<boolean> {
  if (getAccessToken()) return true;
  const token = await attemptRefresh();
  return token !== null;
}
