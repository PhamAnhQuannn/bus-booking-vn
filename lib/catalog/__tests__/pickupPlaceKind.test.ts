/**
 * Unit tests for pickupPlaceKindToPickupKind (Issue 110, edge P3-5).
 * Guards the enum-bridge against the `pickup`↔`point` footgun.
 */

import { describe, it, expect } from 'vitest';
import { pickupPlaceKindToPickupKind } from '../pickupPlaceKind';

describe('pickupPlaceKindToPickupKind', () => {
  it('maps station → station', () => {
    expect(pickupPlaceKindToPickupKind('station')).toBe('station');
  });

  it('maps pickup → point (NOT "pickup" — the enums diverge)', () => {
    expect(pickupPlaceKindToPickupKind('pickup')).toBe('point');
  });
});
