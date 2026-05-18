/**
 * Client-side fetch wrapper for /api/holds.
 *
 * Encapsulates the POST /api/holds request and maps responses to typed results.
 * Used by CustomerForm to create a hold.
 *
 * On 409 SOLD_OUT: the caller shows an error and calls router.refresh() to invalidate the App Router cache (see CustomerForm.tsx).
 */

export interface HoldRequestBody {
  tripId: string;
  ticketCount: number;
  buyerName: string;
  buyerPhone: string;
}

export interface HoldSuccess {
  ok: true;
  holdId: string;
  expiresAt: string;
}

export interface HoldError {
  ok: false;
  code: 'SOLD_OUT' | 'TOO_MANY_REQUESTS' | 'INVALID' | 'NETWORK_ERROR';
  retryAfter?: number; // seconds (for 429)
}

export type HoldResult = HoldSuccess | HoldError;

export async function createHoldRequest(body: HoldRequestBody): Promise<HoldResult> {
  let res: Response;
  try {
    res = await fetch('/api/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, code: 'NETWORK_ERROR' };
  }

  if (res.status === 200) {
    const data = await res.json();
    return { ok: true, holdId: data.holdId, expiresAt: data.expiresAt };
  }

  if (res.status === 409) {
    return { ok: false, code: 'SOLD_OUT' };
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
    return { ok: false, code: 'TOO_MANY_REQUESTS', retryAfter };
  }

  return { ok: false, code: 'INVALID' };
}
