import { describe, it, expect, vi, beforeEach } from 'vitest';

// Toggle-able auth seam. Guest = getAccessToken() === null.
const { mockAuthFetch, mockGetAccessToken } = vi.hoisted(() => ({
  mockAuthFetch: vi.fn(),
  mockGetAccessToken: vi.fn<() => string | null>(),
}));
vi.mock('@/lib/auth/clientSession', () => ({
  authFetch: mockAuthFetch,
  getAccessToken: mockGetAccessToken,
}));

import {
  listConversations,
  createConversation,
  saveMessages,
  deleteConversation,
  clearAllConversations,
  deriveTitle,
} from '../conversationsClient';

const LS_KEY = 'bbvn_planner_convos';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccessToken.mockReturnValue(null); // default: guest
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('conversationsClient — guest (session-only) storage', () => {
  it('writes guest data to sessionStorage ONLY, never localStorage', async () => {
    await createConversation('trip', [{ role: 'user', text: 'đi Sa Pa' }]);
    expect(sessionStorage.getItem(LS_KEY)).not.toBeNull(); // sessionStorage holds it…
    expect(localStorage.getItem(LS_KEY)).toBeNull(); // …localStorage never does
    expect(mockAuthFetch).not.toHaveBeenCalled(); // network never touched for a guest
  });

  it('purges a legacy localStorage copy on read (one-time migration)', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify([{ id: 'legacy', title: 'old', createdAt: 1, updatedAt: 1, messages: [] }]));
    await listConversations();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    // idempotent: second read still clean, no throw
    await listConversations();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('caps guest history at MAX_LOCAL (30), keeping the newest', async () => {
    for (let i = 0; i < 35; i++) {
      await createConversation(`t${i}`, [{ role: 'user', text: `m${i}` }]);
    }
    const metas = await listConversations();
    expect(metas.length).toBe(30);
    // newest (t34) is present, oldest (t0) evicted
    expect(metas.some((m) => m.title === 't34')).toBe(true);
    expect(metas.some((m) => m.title === 't0')).toBe(false);
  });

  it('round-trips a guest conversation through save + list + delete', async () => {
    const c = await createConversation('trip', [{ role: 'user', text: 'a' }]);
    await saveMessages(c.id, [{ role: 'user', text: 'a' }, { role: 'bot', text: 'b' }]);
    let metas = await listConversations();
    expect(metas.find((m) => m.id === c.id)).toBeTruthy();
    await deleteConversation(c.id);
    metas = await listConversations();
    expect(metas.find((m) => m.id === c.id)).toBeUndefined();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('clearAllConversations empties guest storage without a network call', async () => {
    await createConversation('trip', [{ role: 'user', text: 'a' }]);
    await clearAllConversations();
    expect(await listConversations()).toEqual([]);
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('degrades safely when sessionStorage is unavailable (private window / blocked)', async () => {
    const orig = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked');
      },
    });
    try {
      await expect(listConversations()).resolves.toEqual([]);
      await expect(createConversation('t', [{ role: 'user', text: 'x' }])).resolves.toBeTruthy();
    } finally {
      if (orig) Object.defineProperty(window, 'sessionStorage', orig);
    }
  });
});

describe('conversationsClient — authed dispatch', () => {
  it('routes to the API and surfaces a clear error on !ok (regression #528)', async () => {
    mockGetAccessToken.mockReturnValue('token');
    mockAuthFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(createConversation('t', [{ role: 'user', text: 'x' }])).rejects.toThrow('HTTP 500');
    // guest storage untouched on the authed path
    expect(sessionStorage.getItem(LS_KEY)).toBeNull();
  });
});

describe('deriveTitle', () => {
  it('collapses whitespace and caps at 60 chars with an ellipsis', () => {
    expect(deriveTitle('  đi   Sa Pa  ')).toBe('đi Sa Pa');
    const long = 'a'.repeat(80);
    const t = deriveTitle(long);
    expect(t.length).toBe(58); // 57 + ellipsis
    expect(t.endsWith('…')).toBe(true);
  });
  it('falls back for empty input', () => {
    expect(deriveTitle('   ')).toBe('Cuộc trò chuyện mới');
  });
});
