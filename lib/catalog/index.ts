// catalog domain public API barrel (SYS20 rule 3).

export { canReduceCapacity } from './capacityGuard';
export { createBus, BusServiceError } from './createBus';
export { createRoute } from './createRoute';
export { deactivateBus } from './deactivateBus';
export { deactivateRoute } from './deactivateRoute';
export { findMaintenanceOverlaps, findTripOverlaps } from './getMaintenanceConflicts';
export { getOperatorBus } from './getOperatorBus';
export { getOperatorBusWithTrips } from './getOperatorBusWithTrips';
export type { BusActiveTrip } from './getOperatorBusWithTrips';
export { getRouteById } from './getRouteById';
export { listOperatorBuses } from './listOperatorBuses';
export type { OperatorBusListItem } from './listOperatorBuses';
export { listRoutes } from './listRoutes';
export { updateBus } from './updateBus';
export type { UpdateBusInput } from './updateBus';
export { updateRoute, RouteServiceError } from './updateRoute';
