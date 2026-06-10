import { describe, it, expect } from 'vitest';
import { validatePickupSelection } from '../pickupSelection';

const TRIP_AREAS = ['area-1', 'area-2'];

describe('validatePickupSelection', () => {
  it('accepts station with no detail', () => {
    expect(validatePickupSelection(TRIP_AREAS, { kind: 'station' })).toEqual({
      ok: true,
      pickupKind: 'station',
      pickupAreaId: null,
      pickupDetail: null,
    });
  });

  it('accepts an in-set area with a trimmed detail note', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'point', areaId: 'area-1', detail: '  12 Lê Lợi  ' })
    ).toEqual({ ok: true, pickupKind: 'point', pickupAreaId: 'area-1', pickupDetail: '12 Lê Lợi' });
  });

  it('accepts an in-set area with no detail (named point — detail optional)', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'point', areaId: 'area-1' })
    ).toEqual({ ok: true, pickupKind: 'point', pickupAreaId: 'area-1', pickupDetail: null });
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'point', areaId: 'area-1', detail: '   ' })
    ).toEqual({ ok: true, pickupKind: 'point', pickupAreaId: 'area-1', pickupDetail: null });
  });

  it('rejects an area not in the trip set', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'point', areaId: 'area-9', detail: 'somewhere' })
    ).toMatchObject({ ok: false, code: 'pickup_area_invalid' });
  });

  it('rejects a missing areaId', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'point', detail: 'somewhere' })
    ).toMatchObject({ ok: false, code: 'pickup_area_invalid' });
  });

  it('accepts a custom request with a trimmed ≥5-char detail (no areaId)', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'custom', detail: '  12 Lê Lợi, phường X  ' })
    ).toEqual({
      ok: true,
      pickupKind: 'custom',
      pickupAreaId: null,
      pickupDetail: '12 Lê Lợi, phường X',
    });
  });

  it('rejects a custom request whose detail is shorter than 5 trimmed chars', () => {
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'custom', detail: 'Cầu' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'custom', detail: '     ' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
    expect(
      validatePickupSelection(TRIP_AREAS, { kind: 'custom' })
    ).toMatchObject({ ok: false, code: 'pickup_custom_detail_required' });
  });
});
