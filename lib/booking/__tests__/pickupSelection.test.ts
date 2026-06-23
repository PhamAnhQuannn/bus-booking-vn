import { describe, it, expect } from 'vitest';
import { validatePickupSelection } from '../pickupSelection';

describe('validatePickupSelection', () => {
  it('accepts station with no detail', () => {
    expect(validatePickupSelection({ kind: 'station' })).toEqual({
      ok: true,
      pickupKind: 'station',
      pickupDetail: null,
    });
  });

  it('accepts a custom request with a trimmed ≥5-char detail', () => {
    expect(
      validatePickupSelection({ kind: 'custom', detail: '  12 Lê Lợi, phường X  ' })
    ).toEqual({
      ok: true,
      pickupKind: 'custom',
      pickupDetail: '12 Lê Lợi, phường X',
    });
  });

  it('rejects a custom request whose detail is shorter than 5 trimmed chars', () => {
    expect(
      validatePickupSelection({ kind: 'custom', detail: 'Cầu' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
    expect(
      validatePickupSelection({ kind: 'custom', detail: '     ' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
    expect(
      validatePickupSelection({ kind: 'custom' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
  });
});
