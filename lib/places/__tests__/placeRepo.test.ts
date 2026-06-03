/**
 * Unit tests for placeRepo (Issue 044).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockPlaceCreate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockPlaceCreate: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    place: { create: mockPlaceCreate },
  },
}));

import { resolveOrCreatePlace, listSearchablePlaces } from '../placeRepo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveOrCreatePlace', () => {
  it('returns an existing place when found by name/alias (no create)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'p1', canonicalName: 'Hà Nội' }]);

    const result = await resolveOrCreatePlace('Hà Nội');

    expect(result).toEqual({ id: 'p1', canonicalName: 'Hà Nội' });
    expect(mockPlaceCreate).not.toHaveBeenCalled();
  });

  it('creates a new place when none matches', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no match
    mockPlaceCreate.mockResolvedValueOnce({ id: 'p2', canonicalName: 'Sa Pa' });

    const result = await resolveOrCreatePlace('Sa Pa');

    expect(mockPlaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { canonicalName: 'Sa Pa', aliases: [] },
      })
    );
    expect(result).toEqual({ id: 'p2', canonicalName: 'Sa Pa' });
  });

  it('trims surrounding whitespace before matching/creating', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    mockPlaceCreate.mockResolvedValueOnce({ id: 'p3', canonicalName: 'Đà Lạt' });

    await resolveOrCreatePlace('  Đà Lạt  ');

    // The raw match query receives the trimmed value as a bound param.
    const matchCall = mockQueryRaw.mock.calls[0][0];
    expect(JSON.stringify(matchCall.values)).toContain('Đà Lạt');
    expect(JSON.stringify(matchCall.values)).not.toContain('  Đà Lạt  ');
    // Create is called with the trimmed canonicalName.
    expect(mockPlaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { canonicalName: 'Đà Lạt', aliases: [] } })
    );
  });

  it('re-reads and returns the winning row when create races (catch path)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]) // first match: none
      .mockResolvedValueOnce([{ id: 'p4', canonicalName: 'Huế' }]); // re-read after race
    mockPlaceCreate.mockRejectedValueOnce(new Error('boom'));

    const result = await resolveOrCreatePlace('Huế');

    expect(result).toEqual({ id: 'p4', canonicalName: 'Huế' });
  });
});

describe('listSearchablePlaces', () => {
  it('returns the flattened place strings from the union query', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { place: 'Hà Nội' },
      { place: 'Sa Pa' },
      { place: 'TP.HCM' },
    ]);

    const result = await listSearchablePlaces();

    expect(result).toEqual(['Hà Nội', 'Sa Pa', 'TP.HCM']);
  });
});
