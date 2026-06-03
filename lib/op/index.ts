// op domain public API barrel (SYS20 rule 3).

export { getDefaultDateRange, getDefaultTodayRange, serverNow } from './dateRanges';
export { getActivityFeed } from './getActivityFeed';
export { getOperatorFleet } from './getOperatorFleet';
export { getOperatorProfile } from './getOperatorProfile';
export type { OperatorProfile } from './getOperatorProfile';
export { getOperatorSession } from './getOperatorSession';
export { getOperatorStaff } from './getOperatorStaff';
export { getStaffDashboard } from './getStaffDashboard';
export { getTodaySnapshot } from './getTodaySnapshot';
export { listRoutesForTripIds } from './listRoutesForTripIds';
export {
  bookingStatusDisplay,
  busTypeLabel,
  busTypeWithCapacity,
  contactStatusDisplay,
  payoutStatusDisplay,
  routeActiveDisplay,
  tripStatusDisplay,
} from './statusLabels';
