import type { Prisma } from '@prisma/client';

const DEFAULT_DATE = new Date('2030-01-01T00:00:00.000Z');

export function makeOperator(
  overrides: Partial<Prisma.OperatorUncheckedCreateInput> = {},
): Prisma.OperatorUncheckedCreateInput {
  return {
    legalName: 'Test Operator LLC',
    brandName: 'Test Operator',
    contactName: 'Test Contact',
    address: '1 Test Street',
    routesSummary: 'Test routes',
    provinceCode: '79',
    provinceName: 'Ho Chi Minh City',
    contactPhone: '+8490xxxxxx1',
    contactEmail: 'operator@example.com',
    notificationPhone: '+8490xxxxxx2',
    taxClassification: 'company',
    ...overrides,
  };
}

export function makeBus(
  overrides: Partial<Prisma.BusUncheckedCreateInput> = {},
): Prisma.BusUncheckedCreateInput {
  return {
    operatorId: 'cmakeoperator0000000000000',
    capacity: 40,
    licensePlate: '29B-12345',
    busType: 'coach',
    ...overrides,
  };
}

export function makeRoute(
  overrides: Partial<Prisma.RouteUncheckedCreateInput> = {},
): Prisma.RouteUncheckedCreateInput {
  return {
    origin: 'Ha Noi',
    destination: 'Sai Gon',
    operatorId: 'cmakeoperator0000000000000',
    durationMinutes: 960,
    ...overrides,
  };
}

export function makeTrip(
  overrides: Partial<Prisma.TripUncheckedCreateInput> = {},
): Prisma.TripUncheckedCreateInput {
  return {
    routeId: 'cmakeroute0000000000000000',
    busId: 'cmakebus000000000000000000',
    operatorId: 'cmakeoperator0000000000000',
    departureAt: DEFAULT_DATE,
    price: 120000,
    status: 'scheduled',
    salesClosed: false,
    blockedSeats: 0,
    ...overrides,
  };
}
