/**
 * Integration guard: every non-GET operator client wrapper MUST send the
 * X-CSRF-Token header (read from the bb_csrf cookie via readCsrfToken) so
 * proxy.ts admits it through the CSRF double-submit gate.
 *
 * GET wrappers (listBusesApi, listRoutesApi, listStaffApi, listPayoutsApi,
 * listTripsApi, …) deliberately send NO token and are not exercised here.
 *
 * If a new mutating wrapper is added without the header, add it to the table
 * below — a missing entry is a silent CSRF regression (proxy.ts 403s in prod
 * but unit tests stay green).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth/csrfClient', () => ({
  readCsrfToken: () => CSRF_TOKEN,
}));

const CSRF_TOKEN = 'test-csrf-token';

import * as buses from '../busesClient';
import * as routes from '../routesClient';
import * as staff from '../staffClient';
import * as reports from '../reportsClient';
import * as trips from '../tripsClient';

/** A single mutating wrapper invocation with the minimal valid args. */
interface Case {
  name: string;
  invoke: () => Promise<unknown>;
}

const CASES: Case[] = [
  // busesClient
  { name: 'createBusApi', invoke: () => buses.createBusApi({ licensePlate: '51A-12345', capacity: 40, busType: 'coach' }) },
  { name: 'patchCapacityApi', invoke: () => buses.patchCapacityApi('bus-1', 36) },
  { name: 'deactivateBusApi', invoke: () => buses.deactivateBusApi('bus-1') },
  { name: 'addMaintenanceApi', invoke: () => buses.addMaintenanceApi('bus-1', { startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-02T00:00:00Z' }) },
  { name: 'deleteMaintenanceApi', invoke: () => buses.deleteMaintenanceApi('bus-1', 'm-1') },

  // routesClient
  { name: 'createRouteApi', invoke: () => routes.createRouteApi({ origin: 'Hà Nội', destination: 'Sa Pa', durationMinutes: 300 }) },
  { name: 'patchRouteApi', invoke: () => routes.patchRouteApi('route-1', { durationMinutes: 320 }) },
  { name: 'deactivateRouteApi', invoke: () => routes.deactivateRouteApi('route-1') },

  // staffClient
  { name: 'createStaffApi', invoke: () => staff.createStaffApi({ name: 'Nguyễn Văn A', phone: '0912000111' }) },
  { name: 'renameStaffApi', invoke: () => staff.renameStaffApi('staff-1', 'Tên mới') },
  { name: 'disableStaffApi', invoke: () => staff.disableStaffApi('staff-1') },
  { name: 'assignServiceApi', invoke: () => staff.assignServiceApi('staff-1', 'trip-1') },

  // reportsClient
  { name: 'retryPayoutApi', invoke: () => reports.retryPayoutApi('payout-1') },

  // tripsClient
  { name: 'createTripApi', invoke: () => trips.createTripApi({ routeId: 'route-1', busId: 'bus-1', departureAt: '2026-06-01T07:00:00Z', price: 250000 }) },
  { name: 'patchTripApi', invoke: () => trips.patchTripApi('trip-1', { price: 260000 }) },
  { name: 'reassignBusApi', invoke: () => trips.reassignBusApi('trip-1', 'bus-2') },
  { name: 'cancelTripApi', invoke: () => trips.cancelTripApi('trip-1', 'Hỏng xe, huỷ chuyến') },
  { name: 'salesToggleApi', invoke: () => trips.salesToggleApi('trip-1', true) },
  { name: 'departTripApi', invoke: () => trips.departTripApi('trip-1') },
  { name: 'completeTripApi', invoke: () => trips.completeTripApi('trip-1') },
  { name: 'createTemplateApi', invoke: () => trips.createTemplateApi({ routeId: 'route-1', busId: 'bus-1', price: 250000, departureLocalTime: '07:00', daysOfMask: 127, validFrom: '2026-06-01', validUntil: '2026-12-31' }) },
  { name: 'patchTemplateApi', invoke: () => trips.patchTemplateApi('tpl-1', { price: 260000 }) },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('operator client wrappers — CSRF double-submit', () => {
  it.each(CASES)('$name sends X-CSRF-Token on a non-GET request', async ({ invoke }) => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await invoke();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // Mutating wrapper: never a GET, always carries the token + same-origin creds.
    expect(init.method).not.toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': CSRF_TOKEN });
  });
});
